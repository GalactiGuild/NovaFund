#![no_std]

use shared::{
    constants::{MIN_VALIDATORS, RESUME_TIME_DELAY, UPGRADE_TIME_LOCK_SECS},
    errors::Error,
    events::*,
    types::{
        Amount, Dispute, DisputeResolution, DisputeStatus, EscrowInfo, Hash, JurorInfo, Milestone,
        MilestoneStatus, PauseState, PendingUpgrade, VoteCommitment,
    },
    MIN_APPROVAL_THRESHOLD, MAX_APPROVAL_THRESHOLD,
};
use soroban_sdk::{contract, contractimpl, token::TokenClient, Address, BytesN, Env, IntoVal, Vec};

mod storage;
mod validation;

#[cfg(test)]
mod tests;

use storage::*;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the contract with an admin address
    pub fn initialize_admin(env: Env, admin: Address) -> Result<(), Error> {
        if has_admin(&env) {
            return Err(Error::AlreadyInit);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        Ok(())
    }

    /// Initialize an escrow for a project
    ///
    /// # Arguments
    /// * `project_id` - Unique project identifier
    /// * `creator` - Address of the project creator
    /// * `token` - Token address for the escrow
    /// * `validators` - List of validator addresses for milestone approval
    pub fn initialize(
        env: Env,
        project_id: u64,
        creator: Address,
        token: Address,
        validators: Vec<Address>,
        approval_threshold: u32,
    ) -> Result<(), Error> {
        creator.require_auth();

        // Validate inputs
        if (validators.len() as u32) < MIN_VALIDATORS {
            return Err(Error::InvInput);
        }

        // Check if escrow already exists
        if escrow_exists(&env, project_id) {
            return Err(Error::AlreadyInit);
        }

        if approval_threshold < MIN_APPROVAL_THRESHOLD || approval_threshold > MAX_APPROVAL_THRESHOLD {
            return Err(Error::InvInput);
        }

        // Create escrow info
        let escrow = EscrowInfo {
            project_id,
            creator: creator.clone(),
            token: token.clone(),
            total_deposited: 0,
            released_amount: 0,
            validators,
            approval_threshold,
        };

        // Store escrow
        set_escrow(&env, project_id, &escrow);

        // Initialize milestone counter
        set_milestone_counter(&env, project_id, 0);

        // Emit event
        env.events()
            .publish((ESCROW_INITIALIZED,), (project_id, creator, token));

        Ok(())
    }

    /// Deposit funds into the escrow
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `amount` - Amount to deposit (note: actual token transfer would be handled separately)
    pub fn deposit(env: Env, project_id: u64, amount: Amount) -> Result<(), Error> {
        // Get escrow
        let mut escrow = get_escrow(&env, project_id)?;

        // Validate amount
        if amount <= 0 {
            return Err(Error::InvInput);
        }

        if is_paused(&env) {
            return Err(Error::Paused);
        }

        // Update total deposited
        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(amount)
            .ok_or(Error::InvInput)?;

        // Store updated escrow
        set_escrow(&env, project_id, &escrow);

        // Emit event
        env.events().publish((FUNDS_LOCKED,), (project_id, amount));

        Ok(())
    }

    /// Create a new milestone
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `description_hash` - Hash of the milestone description
    /// * `amount` - Amount to be released when milestone is approved
    pub fn create_milestone(
        env: Env,
        project_id: u64,
        description_hash: Hash,
        amount: Amount,
    ) -> Result<(), Error> {
        // Get escrow to verify it exists and get creator
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        // Validate amount
        if amount <= 0 {
            return Err(Error::InvInput);
        }

        // Validate that total milestone amounts don't exceed escrow total
        let total_milestones = get_total_milestone_amount(&env, project_id)?;
        let new_total = total_milestones
            .checked_add(amount)
            .ok_or(Error::InvInput)?;

        if new_total > escrow.total_deposited {
            return Err(Error::EscrowInsuf);
        }

        if is_paused(&env) {
            return Err(Error::Paused);
        }

        // Get next milestone ID
        let milestone_id = get_milestone_counter(&env, project_id)?;
        let next_id = milestone_id.checked_add(1).ok_or(Error::InvInput)?;

        // Create milestone (with empty proof hash)
        let empty_hash = BytesN::from_array(&env, &[0u8; 32]);
        let milestone = Milestone {
            id: milestone_id,
            project_id,
            description_hash: description_hash.clone(),
            amount,
            status: MilestoneStatus::Pending,
            proof_hash: empty_hash,
            approval_count: 0,
            rejection_count: 0,
            created_at: env.ledger().timestamp(),
        };

        // Store milestone
        set_milestone(&env, project_id, milestone_id, &milestone);
        set_milestone_counter(&env, project_id, next_id);

        // Emit event
        env.events().publish(
            (MILESTONE_CREATED,),
            (project_id, milestone_id, amount, description_hash),
        );

        Ok(())
    }

    /// Submit a milestone with proof
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `milestone_id` - Milestone identifier
    /// * `proof_hash` - Hash of the milestone proof
    pub fn submit_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        proof_hash: Hash,
    ) -> Result<(), Error> {
        // Get escrow to verify it exists and get creator
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        // Get milestone
        let mut milestone = get_milestone(&env, project_id, milestone_id)?;

        // Validate milestone status
        if milestone.status != MilestoneStatus::Pending {
            return Err(Error::MstoneInv);
        }

        if is_paused(&env) {
            return Err(Error::Paused);
        }

        // Update milestone
        milestone.status = MilestoneStatus::Submitted;
        milestone.proof_hash = proof_hash.clone();

        // Store updated milestone
        set_milestone(&env, project_id, milestone_id, &milestone);

        // Reset vote counts for new submission
        set_milestone_votes(&env, project_id, milestone_id, 0, 0);

        // Clear previous validators who voted
        clear_milestone_voters(&env, project_id, milestone_id);

        // Emit event
        env.events().publish(
            (MILESTONE_SUBMITTED,),
            (project_id, milestone_id, proof_hash),
        );

        Ok(())
    }

    /// Vote on a milestone (approve or reject)
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `milestone_id` - Milestone identifier
    /// * `voter` - Address of the voter
    /// * `approve` - True to approve, false to reject
    pub fn vote_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        voter: Address,
        approve: bool,
    ) -> Result<(), Error> {
        voter.require_auth();

        // Get escrow
        let mut escrow = get_escrow(&env, project_id)?;
        validation::validate_validator(&escrow, &voter)?;

        // Get milestone
        let mut milestone = get_milestone(&env, project_id, milestone_id)?;

        // Validate milestone status
        if milestone.status != MilestoneStatus::Submitted {
            return Err(Error::MstoneInv);
        }

        // Check if validator already voted
        if has_validator_voted(&env, project_id, milestone_id, &voter)? {
            return Err(Error::AlreadyVoted);
        }

        // Update vote counts
        if approve {
            milestone.approval_count = milestone
                .approval_count
                .checked_add(1)
                .ok_or(Error::InvInput)?;
        } else {
            milestone.rejection_count = milestone
                .rejection_count
                .checked_add(1)
                .ok_or(Error::InvInput)?;
        }

        if is_paused(&env) {
            return Err(Error::Paused);
        }

        // Record that this validator voted
        set_validator_vote(&env, project_id, milestone_id, &voter)?;

        // Check if milestone is approved or rejected
        let _total_votes = milestone.approval_count as u32 + milestone.rejection_count as u32;
        // let required_approvals =
        //     (escrow.validators.len() as u32 * MILESTONE_APPROVAL_THRESHOLD) / 10000;
        let required_approvals =
            (escrow.validators.len() as u32 * escrow.approval_threshold) / 10000;

        // Check for majority approval
        if milestone.approval_count as u32 >= required_approvals {
            milestone.status = MilestoneStatus::Approved;

            // Release funds
            release_milestone_funds(&env, &mut escrow, &milestone)?;

            // Perform token transfer to creator
            let token_client = TokenClient::new(&env, &escrow.token);
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.creator,
                &milestone.amount,
            );

            // Store updated escrow
            set_escrow(&env, project_id, &escrow);

            // Store updated milestone
            set_milestone(&env, project_id, milestone_id, &milestone);

            // Emit approval event
            env.events().publish(
                (MILESTONE_APPROVED,),
                (project_id, milestone_id, milestone.approval_count),
            );

            // Emit fund release event
            env.events().publish(
                (FUNDS_RELEASED,),
                (project_id, milestone_id, milestone.amount),
            );
        } else if milestone.rejection_count as u32
            > escrow.validators.len() as u32 - required_approvals
        {
            // Majority has rejected
            milestone.status = MilestoneStatus::Rejected;
            set_milestone(&env, project_id, milestone_id, &milestone);

            // Emit rejection event
            env.events().publish(
                (MILESTONE_REJECTED,),
                (project_id, milestone_id, milestone.rejection_count),
            );
        } else {
            // Store updated milestone (vote recorded, but not yet finalized)
            set_milestone(&env, project_id, milestone_id, &milestone);
        }

        Ok(())
    }

    /// Get escrow information
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    pub fn get_escrow(env: Env, project_id: u64) -> Result<EscrowInfo, Error> {
        get_escrow(&env, project_id)
    }

    /// Get milestone information
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `milestone_id` - Milestone identifier
    pub fn get_milestone(env: Env, project_id: u64, milestone_id: u64) -> Result<Milestone, Error> {
        get_milestone(&env, project_id, milestone_id)
    }

    /// Get the total amount allocated to milestones
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    pub fn get_total_milestone_amount(env: Env, project_id: u64) -> Result<Amount, Error> {
        get_total_milestone_amount(&env, project_id)
    }

    /// Get remaining available balance in escrow
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    pub fn get_available_balance(env: Env, project_id: u64) -> Result<Amount, Error> {
        let escrow = get_escrow(&env, project_id)?;
        Ok(escrow.total_deposited - escrow.released_amount)
    }

    /// Update validators for an escrow
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `new_validators` - New list of validator addresses
    pub fn update_validators(
        env: Env,
        project_id: u64,
        new_validators: Vec<Address>,
    ) -> Result<(), Error> {
        // Get admin
        let admin = get_admin(&env)?;
        admin.require_auth();

        // Validate new validators
        if (new_validators.len() as u32) < MIN_VALIDATORS {
            return Err(Error::InvInput);
        }

        // Get escrow
        let mut escrow = get_escrow(&env, project_id)?;

        // Update validators
        escrow.validators = new_validators.clone();

        // Store updated escrow
        set_escrow(&env, project_id, &escrow);

        // Emit event
        env.events()
            .publish((VALIDATORS_UPDATED,), (project_id, new_validators));

        Ok(())
    }

    // ==================== Dispute Resolution System ====================

    /// Configure the global token used for juror staking
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `token` - Token address
    ///
    /// # Errors
    /// * `Unauthorized` - Caller is not admin
    pub fn configure_dispute_token(env: Env, token: Address) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        set_juror_token(&env, &token);
        Ok(())
    }

    /// Register to be a juror
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `juror` - Address of the juror
    /// * `stake_amount` - Amount of tokens to stake
    ///
    /// # Errors
    /// * `InsufficientJurorStake` - Stake is below minimum
    /// * `AlreadyRegisteredAsJuror` - Juror is already registered
    pub fn register_as_juror(env: Env, juror: Address, stake_amount: Amount) -> Result<(), Error> {
        juror.require_auth();

        if stake_amount < shared::constants::MIN_JUROR_STAKE {
            return Err(Error::JurorStakeL);
        }

        // Check if already registered
        if get_juror(&env, &juror).is_ok() {
            return Err(Error::JurorReg);
        }

        let token = get_juror_token(&env)?;
        let token_client = TokenClient::new(&env, &token);

        // Transfer stake from juror to contract
        token_client.transfer(&juror, &env.current_contract_address(), &stake_amount);

        // Save juror info
        let juror_info = JurorInfo {
            address: juror.clone(),
            staked_amount: stake_amount,
            active_disputes: 0,
            successful_votes: 0,
            missed_votes: 0,
        };
        set_juror(&env, &juror, &juror_info);

        // Add to active jurors list
        let mut active_jurors = get_active_jurors(&env);
        active_jurors.push_back(juror.clone());
        set_active_jurors(&env, &active_jurors);

        Ok(())
    }

    /// Pause the contract — halts all critical operations instantly
    ///
    /// # Arguments
    /// * `admin` - Must be the platform admin
    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = get_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();

        let now = env.ledger().timestamp();
        let state = PauseState {
            paused: true,
            paused_at: now,
            resume_not_before: now + RESUME_TIME_DELAY,
        };

        set_pause_state(&env, &state);

        env.events().publish((CONTRACT_PAUSED,), (admin, now));

        Ok(())
    }

    /// Deregister as a juror
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `juror` - Address of the juror
    ///
    /// # Errors
    /// * `NotAJuror` - Caller is not a registered juror
    /// * `JurorHasActiveDispute` - Juror is assigned to an active dispute
    pub fn deregister_as_juror(env: Env, juror: Address) -> Result<(), Error> {
        juror.require_auth();

        let juror_info = get_juror(&env, &juror)?;

        if juror_info.active_disputes > 0 {
            return Err(Error::JurorAct);
        }

        let token = get_juror_token(&env)?;
        let token_client = TokenClient::new(&env, &token);

        // Transfer stake back to juror
        token_client.transfer(
            &env.current_contract_address(),
            &juror,
            &juror_info.staked_amount,
        );

        // Remove from storage
        remove_juror(&env, &juror);

        // Remove from active jurors list
        let mut active_jurors = get_active_jurors(&env);
        if let Some(index) = active_jurors.first_index_of(juror.clone()) {
            active_jurors.remove(index);
            set_active_jurors(&env, &active_jurors);
        }

        Ok(())
    }

    /// Resume the contract — only allowed after the time delay has passed
    ///
    /// # Arguments
    /// * `admin` - Must be the platform admin
    pub fn resume(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = get_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();

        let state = get_pause_state(&env);

        let now = env.ledger().timestamp();
        if now < state.resume_not_before {
            return Err(Error::ResTooEarly);
        }

        let new_state = PauseState {
            paused: false,
            paused_at: state.paused_at,
            resume_not_before: state.resume_not_before,
        };

        set_pause_state(&env, &new_state);

        env.events().publish((CONTRACT_RESUMED,), (admin, now));

        Ok(())
    }

    /// Initiate a dispute on a milestone
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `project_id` - Project identifier
    /// * `milestone_id` - Milestone identifier
    /// * `initiator` - Address initiating the dispute
    /// * `project_contract` - Contract address for project launch (to verify backers)
    ///
    /// # Errors
    /// * `MilestoneNotContested` - Milestone is not in a contested state
    /// * `Unauthorized` - Initiator is not creator or valid backer
    pub fn initiate_dispute(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        initiator: Address,
        project_contract: Address,
    ) -> Result<u64, Error> {
        initiator.require_auth();

        let escrow = get_escrow(&env, project_id)?;
        let milestone = get_milestone(&env, project_id, milestone_id)?;

        if milestone.status != MilestoneStatus::Rejected
            && milestone.status != MilestoneStatus::Submitted
        {
            return Err(Error::MstoneContest);
        }

        // Verify initiator is creator or qualifying funder
        if initiator != escrow.creator {
            let args: Vec<soroban_sdk::Val> =
                soroban_sdk::vec![&env, project_id.into_val(&env), initiator.into_val(&env)];
            let contribution: Amount = env.invoke_contract(
                &project_contract,
                &soroban_sdk::Symbol::new(&env, "get_user_contribution"),
                args,
            );

            if contribution < shared::constants::MIN_CONTRIBUTION {
                return Err(Error::Unauthorized);
            }
        }

        let dispute_id = get_next_dispute_id(&env);
        let dispute = Dispute {
            id: dispute_id,
            milestone_id,
            project_id,
            initiator: initiator.clone(),
            status: DisputeStatus::Pending,
            created_at: env.ledger().timestamp(),
            resolution: DisputeResolution::NoRes,
            resolution_payload: 0,
            appeal_count: 0,
        };

        set_dispute(&env, dispute_id, &dispute);
        set_next_dispute_id(&env, dispute_id + 1);

        Ok(dispute_id)
    }

    /// Select jury for a dispute using verifiable on-chain randomness
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    ///
    /// # Events
    /// * `JURY_SELECTED` - Emitted when jury selection completes
    ///
    /// # Errors
    /// * `InvalidInput` - Dispute state invalid or not enough jurors
    /// * `ConflictOfInterest` - Not enough eligible jurors after excluding conflicts
    pub fn select_jury(env: Env, dispute_id: u64) -> Result<(), Error> {
        let mut dispute = get_dispute(&env, dispute_id)?;

        if dispute.status != DisputeStatus::Pending && dispute.status != DisputeStatus::Appealed {
            return Err(Error::InvInput);
        }

        let jury_size = if dispute.status == DisputeStatus::Appealed {
            shared::constants::APPEAL_JURY_SIZE
        } else {
            shared::constants::JURY_SIZE
        };

        let active_jurors = get_active_jurors(&env);
        if active_jurors.len() < jury_size {
            return Err(Error::InvInput); // Not enough jurors
        }

        let mut selected_jurors = Vec::new(&env);
        let mut available_jurors = active_jurors.clone();

        let escrow = get_escrow(&env, dispute.project_id)?;

        let existing_jurors = if dispute.appeal_count > 0 {
            get_juror_assignments(&env, dispute_id).unwrap_or(Vec::new(&env))
        } else {
            Vec::new(&env)
        };

        let prng = env.prng();

        while selected_jurors.len() < jury_size && available_jurors.len() > 0 {
            let index = prng.gen_range::<u64>(0..available_jurors.len() as u64) as u32;
            let juror = available_jurors.get(index).unwrap();

            // Conflict of interest exclusion: creator, initiator, and previous jurors
            if juror != escrow.creator
                && juror != dispute.initiator
                && !existing_jurors.contains(&juror)
            {
                selected_jurors.push_back(juror.clone());
            }

            available_jurors.remove(index);
        }

        if selected_jurors.len() < jury_size {
            return Err(Error::ConflictInt);
        }

        // Increment active disputes count for jurors
        for juror in selected_jurors.iter() {
            let mut info = get_juror(&env, &juror)?;
            info.active_disputes += 1;
            set_juror(&env, &juror, &info);
        }

        set_juror_assignments(&env, dispute_id, &selected_jurors);

        dispute.status = DisputeStatus::Voting;
        dispute.created_at = env.ledger().timestamp();
        set_dispute(&env, dispute_id, &dispute);

        env.events()
            .publish((JURY_SELECTED,), (dispute_id, selected_jurors));

        Ok(())
    }

    /// Get the assigned jurors for a dispute
    pub fn get_juror_assignments(env: Env, dispute_id: u64) -> Result<Vec<Address>, Error> {
        get_juror_assignments(&env, dispute_id)
    }

    /// Commit a blinded vote for a dispute
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    /// * `juror` - Address of the juror
    /// * `commitment_hash` - Blinded hash of vote + salt
    ///
    /// # Events
    /// * `VOTE_COMMITTED` - Emitted when vote is committed
    ///
    /// # Errors
    /// * `VotingPeriodNotActive` - Not in commit phase
    /// * `NotAJuror` - Juror is not on panel
    /// * `AlreadyVoted` - Vote already committed
    pub fn commit_vote(
        env: Env,
        dispute_id: u64,
        juror: Address,
        commitment_hash: Hash,
    ) -> Result<(), Error> {
        juror.require_auth();

        // panic!("CV2");
        let dispute = get_dispute(&env, dispute_id)?;

        // panic!("CV3");
        if dispute.status != DisputeStatus::Voting {
            return Err(Error::VoteNA);
        }

        let current_time = env.ledger().timestamp();
        if current_time > dispute.created_at + shared::constants::VOTING_COMMIT_PERIOD {
            return Err(Error::VoteNA);
        }

        let assignments = get_juror_assignments(&env, dispute_id)?;
        if !assignments.contains(&juror) {
            return Err(Error::NotJuror);
        }

        if get_dispute_vote(&env, dispute_id, &juror).is_ok() {
            return Err(Error::AlreadyVoted);
        }

        let commitment = VoteCommitment {
            hash: commitment_hash.clone(),
            revealed: false,
            vote: DisputeResolution::NoRes,
            vote_payload: 0,
        };

        set_dispute_vote(&env, dispute_id, &juror, &commitment);

        env.events().publish((VOTE_COMMITTED,), (dispute_id, juror));

        Ok(())
    }

    /// Reveal a committed vote
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    /// * `juror` - Address of the juror
    /// * `vote` - Plaintext vote
    /// * `salt` - Byte array salt
    ///
    /// # Events
    /// * `VOTE_REVEALED` - Emitted when vote is correctly revealed
    ///
    /// # Errors
    /// * `RevealPeriodNotActive` - Not in reveal phase
    /// * `AlreadyVoted` - Vote already revealed
    /// * `InvalidVoteReveal` - Hash mismatch
    pub fn reveal_vote(
        env: Env,
        dispute_id: u64,
        juror: Address,
        vote: DisputeResolution,
        payload: u32,
        salt: soroban_sdk::Bytes,
    ) -> Result<(), Error> {
        juror.require_auth();

        let dispute = get_dispute(&env, dispute_id)?;

        let current_time = env.ledger().timestamp();
        let commit_end = dispute.created_at + shared::constants::VOTING_COMMIT_PERIOD;
        let reveal_end = commit_end + shared::constants::VOTING_REVEAL_PERIOD;

        if current_time <= commit_end || current_time > reveal_end {
            return Err(Error::RevealNA);
        }

        let mut commitment = get_dispute_vote(&env, dispute_id, &juror)?;

        if commitment.revealed {
            return Err(Error::AlreadyVoted);
        }

        if commitment.vote != vote {
            return Err(Error::AlreadyVoted); // Revert the duplicate we mistakenly added earlier
        }

        // Construct preimage: variant_index + (optional payload) + salt
        let mut b = soroban_sdk::Bytes::new(&env);
        match vote {
            DisputeResolution::RelFunds => b.push_back(0),
            DisputeResolution::RefBackers => b.push_back(1),
            DisputeResolution::PartRel => {
                b.push_back(2);
                for byte in payload.to_be_bytes() {
                    b.push_back(byte);
                }
            }
            DisputeResolution::NoRes => return Err(Error::InvInput),
        }
        b.append(&salt);

        let expected_hash = env.crypto().sha256(&b);

        if commitment.hash.to_array() != expected_hash.to_array() {
            return Err(Error::InvReveal);
        }

        commitment.revealed = true;
        commitment.vote = vote.clone();
        commitment.vote_payload = payload;
        set_dispute_vote(&env, dispute_id, &juror, &commitment);

        env.events().publish((VOTE_REVEALED,), (dispute_id, juror));

        Ok(())
    }

    /// Tally revealed votes, reward majority, slash minority/non-revealers
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    ///
    /// # Events
    /// * `DISPUTE_RESOLVED` - Emitted when outcome is tallied
    /// * `JUROR_SLASHED` - Emitted for each slashed juror
    /// * `APPEAL_RESOLVED` - Emitted if max appeals reached and enforced
    ///
    /// # Errors
    /// * `VotingPeriodNotActive` - Reveal period not ended
    pub fn tally_votes(env: Env, dispute_id: u64) -> Result<(), Error> {
        let mut dispute = get_dispute(&env, dispute_id)?;

        if dispute.status != DisputeStatus::Voting {
            return Err(Error::VoteNA);
        }

        let current_time = env.ledger().timestamp();
        let reveal_end = dispute.created_at
            + shared::constants::VOTING_COMMIT_PERIOD
            + shared::constants::VOTING_REVEAL_PERIOD;

        if current_time <= reveal_end {
            return Err(Error::VoteNA); // Wait for reveal period to end
        }

        let assignments = get_juror_assignments(&env, dispute_id)?;
        let mut votes: soroban_sdk::Map<soroban_sdk::Val, u32> = soroban_sdk::Map::new(&env);
        let mut payloads: soroban_sdk::Map<soroban_sdk::Val, u32> = soroban_sdk::Map::new(&env);
        let mut winning_vote = DisputeResolution::NoRes;
        let mut winning_payload: u32 = 0;
        let mut max_votes: u32 = 0;

        for juror in assignments.iter() {
            if let Ok(commitment) = get_dispute_vote(&env, dispute_id, &juror) {
                if commitment.revealed {
                    let vote = commitment.vote.clone();
                    let v_val: soroban_sdk::Val = vote.clone().into_val(&env);
                    let count = votes.get(v_val.clone()).unwrap_or(0);
                    votes.set(v_val.clone(), count + 1);
                    payloads.set(v_val.clone(), commitment.vote_payload);

                    if count + 1 > max_votes {
                        max_votes = count + 1;
                        winning_vote = vote;
                        winning_payload = commitment.vote_payload;
                    }
                }
            }
        }

        // Default to RefBackers if no one voted
        let mut resolution = winning_vote;
        if resolution == DisputeResolution::NoRes {
            resolution = DisputeResolution::RefBackers;
        }
        let resolution_payload = winning_payload;

        let mut majority_jurors = Vec::new(&env);

        for juror in assignments.iter() {
            let mut is_majority = false;
            if let Ok(commitment) = get_dispute_vote(&env, dispute_id, &juror) {
                if commitment.revealed {
                    if commitment.vote == resolution {
                        is_majority = true;
                    }
                }
            }

            if is_majority {
                majority_jurors.push_back(juror.clone());
                let mut info = get_juror(&env, &juror)?;
                info.successful_votes += 1;
                info.active_disputes -= 1;
                set_juror(&env, &juror, &info);
            } else {
                let mut info = get_juror(&env, &juror)?;
                info.missed_votes += 1;
                info.active_disputes -= 1;
                set_juror(&env, &juror, &info);

                // Slash 10% of MIN_JUROR_STAKE as a penalty
                let slash_amount = shared::constants::MIN_JUROR_STAKE / 10;
                Self::slash_juror(&env, juror.clone(), slash_amount, 0)?;
            }
        }

        Self::reward_jurors(&env, &majority_jurors)?;

        dispute.resolution = resolution.clone();
        dispute.resolution_payload = resolution_payload;
        dispute.status = DisputeStatus::Resolved;
        dispute.created_at = env.ledger().timestamp(); // Reset time for appeal window
        set_dispute(&env, dispute_id, &dispute);

        env.events()
            .publish((DISPUTE_RESOLVED,), (dispute_id, resolution.clone()));

        // Enforce immediately if max appeals reached
        if dispute.appeal_count >= shared::constants::MAX_APPEALS as u32 {
            dispute.status = DisputeStatus::FinalResolved;
            set_dispute(&env, dispute_id, &dispute);
            Self::enforce_resolution(&env, &dispute, &resolution)?;
            env.events()
                .publish((APPEAL_RESOLVED,), (dispute_id, resolution));
        }

        Ok(())
    }

    /// Execute resolution after appeal window closes
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    ///
    /// # Events
    /// * `APPEAL_RESOLVED` - Emitted when final enforcement is done
    ///
    /// # Errors
    /// * `InvalidInput` - Dispute not resolved
    /// * `AppealWindowClosed` - Appeal window still open
    pub fn execute_resolution(env: Env, dispute_id: u64) -> Result<(), Error> {
        let mut dispute = get_dispute(&env, dispute_id)?;

        if dispute.status != DisputeStatus::Resolved {
            return Err(Error::InvInput);
        }

        let current_time = env.ledger().timestamp();
        if current_time <= dispute.created_at + shared::constants::APPEAL_WINDOW_PERIOD {
            return Err(Error::AppealWinCl); // Reusing for window still open
        }

        dispute.status = DisputeStatus::FinalResolved;
        set_dispute(&env, dispute_id, &dispute);

        let res = dispute.resolution.clone();
        Self::enforce_resolution(&env, &dispute, &res)?;
        env.events().publish((APPEAL_RESOLVED,), (dispute_id, res));

        Ok(())
    }

    // ==================== Internal Helpers ====================

    fn slash_juror(env: &Env, juror: Address, amount: Amount, _reason: u32) -> Result<(), Error> {
        let mut info = get_juror(env, &juror)?;

        let slashed = if info.staked_amount < amount {
            info.staked_amount
        } else {
            amount
        };

        info.staked_amount -= slashed;
        set_juror(env, &juror, &info);

        let pool = get_dispute_fee_pool(env);
        set_dispute_fee_pool(env, pool + slashed);

        env.events().publish((JUROR_SLASHED,), (juror, slashed));
        Ok(())
    }

    fn reward_jurors(env: &Env, majority_jurors: &Vec<Address>) -> Result<(), Error> {
        let count = majority_jurors.len() as i128;
        if count == 0 {
            return Ok(());
        }

        let pool = get_dispute_fee_pool(env);
        if pool > 0 {
            let reward_per_juror = pool / count;
            for j in majority_jurors.iter() {
                let mut info = get_juror(env, &j)?;
                info.staked_amount += reward_per_juror;
                set_juror(env, &j, &info);
            }
            set_dispute_fee_pool(env, pool % count);
        }
        Ok(())
    }

    fn enforce_resolution(
        env: &Env,
        dispute: &Dispute,
        resolution: &DisputeResolution,
    ) -> Result<(), Error> {
        let mut escrow = get_escrow(env, dispute.project_id)?;
        let mut milestone = get_milestone(env, dispute.project_id, dispute.milestone_id)?;

        let amount = milestone.amount;
        let release_amount;

        match resolution {
            DisputeResolution::RelFunds => {
                release_amount = amount;
                milestone.status = MilestoneStatus::Approved;
            }
            DisputeResolution::RefBackers => {
                release_amount = 0;
                milestone.status = MilestoneStatus::Rejected;
            }
            DisputeResolution::PartRel => {
                let pct = dispute.resolution_payload;
                let p = (pct as i128).clamp(0, 10000);
                release_amount = (amount * p) / 10000;
                milestone.status = MilestoneStatus::Approved;
            }
            _ => {
                release_amount = 0;
            }
        }

        if release_amount > 0 {
            let virtual_milestone = Milestone {
                amount: release_amount,
                ..milestone.clone()
            };
            let mut virtual_escrow = escrow.clone();
            release_milestone_funds(&env, &mut virtual_escrow, &virtual_milestone)?;
            escrow.released_amount = virtual_escrow.released_amount;

            let token_client = TokenClient::new(&env, &escrow.token);
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.creator,
                &release_amount,
            );
        }

        set_milestone(env, dispute.project_id, dispute.milestone_id, &milestone);
        set_escrow(env, dispute.project_id, &escrow);

        Ok(())
    }

    /// File an appeal on a resolved dispute
    ///
    /// # Arguments
    /// * `env` - Execution environment
    /// * `dispute_id` - Dispute identifier
    /// * `appellant` - Address filing the appeal
    ///
    /// # Events
    /// * `DISPUTE_APPEALED` - Emitted when an appeal is successfully filed
    ///
    /// # Errors
    /// * `InvalidInput` - Dispute not in resolved state
    /// * `AppealWindowClosed` - Over time limit
    /// * `MaxAppealsReached` - Capped out
    pub fn file_appeal(env: Env, dispute_id: u64, appellant: Address) -> Result<(), Error> {
        appellant.require_auth();

        let mut dispute = get_dispute(&env, dispute_id)?;

        if dispute.status != DisputeStatus::Resolved {
            return Err(Error::InvInput);
        }

        let current_time = env.ledger().timestamp();
        if current_time > dispute.created_at + shared::constants::APPEAL_WINDOW_PERIOD {
            return Err(Error::AppealWinCl);
        }

        if dispute.appeal_count >= shared::constants::MAX_APPEALS as u32 {
            return Err(Error::MaxAppeals);
        }

        let token = get_juror_token(&env)?;
        let token_client = TokenClient::new(&env, &token);

        let fee = shared::constants::APPEAL_FEE;

        token_client.transfer(&appellant, &env.current_contract_address(), &fee);

        let pool = get_dispute_fee_pool(&env);
        set_dispute_fee_pool(&env, pool + fee);

        dispute.appeal_count += 1;
        dispute.status = DisputeStatus::Appealed;
        set_dispute(&env, dispute_id, &dispute);

        env.events()
            .publish((DISPUTE_APPEALED,), (dispute_id, appellant));

        Self::select_jury(env.clone(), dispute_id)?;

        Ok(())
    }

    /// Returns whether the contract is currently paused
    pub fn get_is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    // ---------- Upgrade (time-locked, admin only, requires pause) ----------
    /// Schedule an upgrade. Admin only. Executable after UPGRADE_TIME_LOCK_SECS (48h).
    pub fn schedule_upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let stored_admin = get_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        let now = env.ledger().timestamp();
        let pending = PendingUpgrade {
            wasm_hash: new_wasm_hash.clone(),
            execute_not_before: now + UPGRADE_TIME_LOCK_SECS,
        };
        set_pending_upgrade(&env, &pending);
        env.events()
            .publish((UPGRADE_SCHEDULED,), (admin, new_wasm_hash, pending.execute_not_before));
        Ok(())
    }

    /// Execute a scheduled upgrade. Admin only. Contract must be paused. Only after time-lock.
    pub fn execute_upgrade(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = get_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        if !is_paused(&env) {
            return Err(Error::UpgReqPause);
        }
        let pending = get_pending_upgrade(&env).ok_or(Error::UpgNotSched)?;
        let now = env.ledger().timestamp();
        if now < pending.execute_not_before {
            return Err(Error::UpgTooEarly);
        }
        env.deployer().update_current_contract_wasm(pending.wasm_hash.clone());
        clear_pending_upgrade(&env);
        env.events().publish((UPGRADE_EXECUTED,), (admin, pending.wasm_hash));
        Ok(())
    }

    /// Cancel a scheduled upgrade. Admin only.
    pub fn cancel_upgrade(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin = get_admin(&env)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        if !has_pending_upgrade(&env) {
            return Err(Error::UpgNotSched);
        }
        clear_pending_upgrade(&env);
        env.events().publish((UPGRADE_CANCELLED,), admin);
        Ok(())
    }

    /// Get pending upgrade info, if any.
    pub fn get_pending_upgrade(env: Env) -> Option<PendingUpgrade> {
        storage::get_pending_upgrade(&env)
    }
}

/// Helper function to release milestone funds
fn release_milestone_funds(
    _env: &Env,
    escrow: &mut EscrowInfo,
    milestone: &Milestone,
) -> Result<(), Error> {
    // Verify funds are not released more than once
    let new_released = escrow
        .released_amount
        .checked_add(milestone.amount)
        .ok_or(Error::InvInput)?;

    if new_released > escrow.total_deposited {
        return Err(Error::EscrowInsuf);
    }

    escrow.released_amount = new_released;
    Ok(())
}
