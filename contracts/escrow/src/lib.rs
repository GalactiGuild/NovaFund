#![no_std]

use shared::{
    constants::{MIN_VALIDATORS, RESUME_TIME_DELAY, UPGRADE_TIME_LOCK_SECS},
    errors::Error,
    events::*,
    types::{Amount, EscrowInfo, Hash, Milestone, MilestoneStatus, PauseState, PendingUpgrade},
    MIN_APPROVAL_THRESHOLD, MAX_APPROVAL_THRESHOLD,
};
use soroban_sdk::{contract, contractimpl, token::TokenClient, Address, BytesN, Env, Vec};

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
            return Err(Error::AlreadyInitialized);
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
            return Err(Error::InvalidInput);
        }

        // Check if escrow already exists
        if escrow_exists(&env, project_id) {
            return Err(Error::AlreadyInitialized);
        }

        if approval_threshold < MIN_APPROVAL_THRESHOLD || approval_threshold > MAX_APPROVAL_THRESHOLD {
            return Err(Error::InvalidInput);
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
            return Err(Error::InvalidInput);
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
        }

        // Update total deposited
        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(amount)
            .ok_or(Error::InvalidInput)?;

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
            return Err(Error::InvalidInput);
        }

        // Validate that total milestone amounts don't exceed escrow total
        let total_milestones = get_total_milestone_amount(&env, project_id)?;
        let new_total = total_milestones
            .checked_add(amount)
            .ok_or(Error::InvalidInput)?;

        if new_total > escrow.total_deposited {
            return Err(Error::InsufficientEscrowBalance);
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
        }

        // Get next milestone ID
        let milestone_id = get_milestone_counter(&env, project_id)?;
        let next_id = milestone_id.checked_add(1).ok_or(Error::InvalidInput)?;

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
            return Err(Error::InvalidMilestoneStatus);
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
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
            return Err(Error::InvalidMilestoneStatus);
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
                .ok_or(Error::InvalidInput)?;
        } else {
            milestone.rejection_count = milestone
                .rejection_count
                .checked_add(1)
                .ok_or(Error::InvalidInput)?;
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
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
            return Err(Error::InvalidInput);
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
            return Err(Error::ResumeTooEarly);
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
            return Err(Error::UpgradeRequiresPause);
        }
        let pending = get_pending_upgrade(&env).ok_or(Error::UpgradeNotScheduled)?;
        let now = env.ledger().timestamp();
        if now < pending.execute_not_before {
            return Err(Error::UpgradeTooEarly);
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
            return Err(Error::UpgradeNotScheduled);
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
        .ok_or(Error::InvalidInput)?;

    if new_released > escrow.total_deposited {
        return Err(Error::InsufficientEscrowBalance);
    }

    escrow.released_amount = new_released;
    Ok(())
}
