#![no_std]

use shared::{
    constants::GOVERNANCE_QUORUM,
    errors::Error,
    events::{PROPOSAL_CREATED, PROPOSAL_EXECUTED, VOTE_CAST},
    types::Proposal,
};
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    NextProposalId,
    Proposal(u64),
    HasVoted(u64, Address),
    TotalVoters,
}

#[contract]
pub struct GovernanceContract;

#[cfg(test)]
mod tests;

#[contractimpl]
impl GovernanceContract {
    pub fn initialize(env: Env, admin: Address, total_voters: u32) -> Result<(), Error> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::TotalVoters) {
            return Err(Error::InvalidInput);
        }

        if total_voters == 0 {
            return Err(Error::InvalidInput);
        }

        env.storage()
            .instance()
            .set(&DataKey::TotalVoters, &total_voters);

        Ok(())
    }

    pub fn create_proposal(
        env: Env,
        creator: Address,
        payload_ref: Bytes,
        start_time: u64,
        end_time: u64,
    ) -> Result<u64, Error> {
        creator.require_auth();

        let current_time = env.ledger().timestamp();

        if end_time <= start_time {
            return Err(Error::InvalidInput);
        }

        if start_time < current_time {
            return Err(Error::InvalidInput);
        }
        if payload_ref.len() == 0 {
            return Err(Error::InvalidInput);
        }

        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(0);

        let proposal = Proposal {
            id: proposal_id,
            creator: creator.clone(),
            payload_ref: payload_ref.clone(),
            start_time,
            end_time,
            yes_votes: 0,
            no_votes: 0,
            executed: false,
        };

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &(proposal_id + 1));

        // Emit proposal created event
        env.events()
            .publish((PROPOSAL_CREATED,), (proposal_id, creator, payload_ref));

        Ok(proposal_id)
    }

    pub fn vote(env: Env, proposal_id: u64, voter: Address, support: bool) -> Result<(), Error> {
        voter.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        let current_time = env.ledger().timestamp();

        if proposal.executed {
            return Err(Error::ProposalAlreadyExecuted);
        }

        if current_time < proposal.start_time || current_time > proposal.end_time {
            return Err(Error::InvalidInput);
        }

        let vote_key = DataKey::HasVoted(proposal_id, voter.clone());
        if env.storage().instance().has(&vote_key) {
            return Err(Error::AlreadyVoted);
        }

        if support {
            proposal.yes_votes += 1;
        } else {
            proposal.no_votes += 1;
        }

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.storage().instance().set(&vote_key, &true);

        // Emit vote cast event
        env.events()
            .publish((VOTE_CAST,), (proposal_id, voter, support));

        Ok(())
    }

    pub fn finalize(env: Env, proposal_id: u64) -> Result<(), Error> {
        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        let current_time = env.ledger().timestamp();

        if current_time <= proposal.end_time {
            return Err(Error::InvalidInput);
        }

        if proposal.executed {
            return Err(Error::ProposalAlreadyExecuted);
        }

        let total_votes = proposal.yes_votes + proposal.no_votes;

        let total_voters: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVoters)
            .unwrap_or(100);

        // Calculate minimum votes needed for quorum
        // GOVERNANCE_QUORUM is in basis points (e.g., 2000 = 20%)
        // Formula: (total_voters * GOVERNANCE_QUORUM) / 10000
        let min_votes_needed = (total_voters as u64 * GOVERNANCE_QUORUM as u64) / 10000;

        if (total_votes as u64) < min_votes_needed {
            return Err(Error::QuorumNotReached);
        }

        if proposal.yes_votes > proposal.no_votes {
            proposal.executed = true;
        } else {
            proposal.executed = false;
        }

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        // Emit execution event
        env.events()
            .publish((PROPOSAL_EXECUTED,), (proposal_id, proposal.executed));

        Ok(())
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)
    }

    pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool {
        let vote_key = DataKey::HasVoted(proposal_id, voter);
        env.storage().instance().has(&vote_key)
    }

    pub fn get_total_voters(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::TotalVoters)
            .unwrap_or(0)
    }
}
