#![no_std]

use shared::{
    constants::{GOVERNANCE_QUORUM, VOTING_PERIOD},
    errors::Error,
    events::{PROPOSAL_CREATED, PROPOSAL_EXECUTED, VOTE_CAST},
    types::{Hash, Proposal, ProposalStatus, VoteOption},
};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Env, String,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GovToken,
    NextProposalId,
    Proposal(u64),
    Vote(u64, Address), // (proposal_id, voter) -> VoteOption
}

#[contract]
pub struct GovernanceContract;

#[cfg(test)]
mod tests;

#[contractimpl]
impl GovernanceContract {
    /// Initialize the governance contract
    pub fn initialize(env: Env, admin: Address, gov_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GovToken, &gov_token);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &0u64);

        Ok(())
    }

    /// Create a new proposal
    pub fn create_proposal(
        env: Env,
        creator: Address,
        title: String,
        description_hash: Hash,
    ) -> Result<u64, Error> {
        creator.require_auth();

        let proposal_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(0);

        let start_time = env.ledger().timestamp();
        let end_time = start_time + VOTING_PERIOD;

        let proposal = Proposal {
            id: proposal_id,
            creator: creator.clone(),
            title: title.clone(),
            description_hash,
            status: ProposalStatus::Active,
            votes_for: 0,
            votes_against: 0,
            votes_abstain: 0,
            start_time,
            end_time,
        };

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .instance()
            .set(&DataKey::NextProposalId, &(proposal_id + 1));

        env.events()
            .publish((PROPOSAL_CREATED,), (proposal_id, creator, title));

        Ok(proposal_id)
    }

    /// Cast a vote on a proposal
    pub fn vote(
        env: Env,
        voter: Address,
        proposal_id: u64,
        option: VoteOption,
    ) -> Result<(), Error> {
        voter.require_auth();

        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        let current_time = env.ledger().timestamp();
        if current_time > proposal.end_time || proposal.status != ProposalStatus::Active {
            return Err(Error::InvalidInput); // Voting ended or proposal not active
        }

        let vote_key = DataKey::Vote(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(Error::AlreadyVoted);
        }

        // Calculate voting power based on GovToken balance
        let gov_token: Address = env.storage().instance().get(&DataKey::GovToken).unwrap();
        let token_client = TokenClient::new(&env, &gov_token);
        let weight = token_client.balance(&voter);

        if weight <= 0 {
            return Err(Error::Unauthorized);
        }

        match option {
            VoteOption::Yes => proposal.votes_for += weight,
            VoteOption::No => proposal.votes_against += weight,
            VoteOption::Abstain => proposal.votes_abstain += weight,
        }

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&vote_key, &option);

        env.events()
            .publish((VOTE_CAST,), (proposal_id, voter, option as u32, weight));

        Ok(())
    }

    /// Execute a proposal if it passed
    pub fn execute_proposal(env: Env, proposal_id: u64) -> Result<(), Error> {
        let mut proposal: Proposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::NotFound)?;

        if proposal.status != ProposalStatus::Active {
            return Err(Error::InvalidInput);
        }

        let current_time = env.ledger().timestamp();
        if current_time <= proposal.end_time {
            return Err(Error::InvalidInput); // Voting period not ended
        }

        let total_votes = proposal.votes_for + proposal.votes_against + proposal.votes_abstain;

        // Check quorum (simplified: based on total votes vs total supply would be better,
        // but let's assume total_votes > 0 for now or use a constant)
        if total_votes == 0 {
            proposal.status = ProposalStatus::Rejected;
        } else if proposal.votes_for > proposal.votes_against {
            proposal.status = ProposalStatus::Approved;
            // In a real system, this might trigger an external contract call
        } else {
            proposal.status = ProposalStatus::Rejected;
        }

        env.storage()
            .instance()
            .set(&DataKey::Proposal(proposal_id), &proposal);

        env.events()
            .publish((PROPOSAL_EXECUTED,), (proposal_id, proposal.status as u32));

        Ok(())
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
    }
}
