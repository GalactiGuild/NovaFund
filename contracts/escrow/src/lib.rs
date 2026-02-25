#![no_std]

use shared::{
    constants::{MIN_VALIDATORS, RESUME_TIME_DELAY, UPGRADE_TIME_LOCK_SECS},
    errors::Error,
    events::*,
    types::{Amount, EscrowInfo, Hash, Milestone, MilestoneStatus, ValidationType},
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
    pub fn initialize(
        env: Env,
        project_id: u64,
        creator: Address,
        token: Address,
        validators: Vec<Address>,
        approval_threshold: u32,
    ) -> Result<(), Error> {
        creator.require_auth();

        // FIX: Removed unnecessary cast
        if validators.len() < MIN_VALIDATORS {
            return Err(Error::InvalidInput);
        }

        if escrow_exists(&env, project_id) {
            return Err(Error::AlreadyInitialized);
        }

        if !(MIN_APPROVAL_THRESHOLD..=MAX_APPROVAL_THRESHOLD).contains(&approval_threshold) {
            return Err(Error::InvalidInput);
        }

        let escrow = EscrowInfo {
            project_id,
            creator: creator.clone(),
            token: token.clone(),
            total_deposited: 0,
            released_amount: 0,
            validators,
            approval_threshold,
        };

        set_escrow(&env, project_id, &escrow);
        set_milestone_counter(&env, project_id, 0);

        env.events()
            .publish((ESCROW_INITIALIZED,), (project_id, creator, token));

        Ok(())
    }

    pub fn deposit(env: Env, project_id: u64, amount: Amount) -> Result<(), Error> {
        let mut escrow = get_escrow(&env, project_id)?;

        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
        }

        escrow.total_deposited = escrow
            .total_deposited
            .checked_add(amount)
            .ok_or(Error::InvalidInput)?;

        set_escrow(&env, project_id, &escrow);
        env.events().publish((FUNDS_LOCKED,), (project_id, amount));

        Ok(())
    }

    pub fn create_milestone(
        env: Env,
        project_id: u64,
        description_hash: Hash,
        amount: Amount,
    ) -> Result<(), Error> {
        // backward-compatible manual milestone creation
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

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

        let milestone_id = get_milestone_counter(&env, project_id)?;
        let next_id = milestone_id.checked_add(1).ok_or(Error::InvalidInput)?;

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
            validation_type: ValidationType::Manual,
            oracle_address: None,
            oracle_expected_hash: None,
            oracle_deadline: None,
        };

        set_milestone(&env, project_id, milestone_id, &milestone);
        set_milestone_counter(&env, project_id, next_id);

        env.events().publish(
            (MILESTONE_CREATED,),
            (project_id, milestone_id, amount, description_hash),
        );

        Ok(())
    }

    pub fn submit_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        proof_hash: Hash,
    ) -> Result<(), Error> {
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        let mut milestone = get_milestone(&env, project_id, milestone_id)?;

        if milestone.status != MilestoneStatus::Pending {
            return Err(Error::InvalidMilestoneStatus);
        }

        if is_paused(&env) {
            return Err(Error::ContractPaused);
        }

        milestone.status = MilestoneStatus::Submitted;
        milestone.proof_hash = proof_hash.clone();

        set_milestone(&env, project_id, milestone_id, &milestone);
        set_milestone_votes(&env, project_id, milestone_id, 0, 0);
        clear_milestone_voters(&env, project_id, milestone_id);

        env.events().publish(
            (MILESTONE_SUBMITTED,),
            (project_id, milestone_id, proof_hash),
        );

        Ok(())
    }

    pub fn vote_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        voter: Address,
        approve: bool,
    ) -> Result<(), Error> {
        voter.require_auth();

        let mut escrow = get_escrow(&env, project_id)?;
        validation::validate_validator(&escrow, &voter)?;

        let mut milestone = get_milestone(&env, project_id, milestone_id)?;

        // Oracle milestones cannot be voted on until deadline has passed
        if milestone.validation_type == ValidationType::Oracle {
            if let Some(deadline) = milestone.oracle_deadline {
                if env.ledger().timestamp() < deadline {
                    return Err(Error::OracleDeadlineNotReached);
                }
            }
        }

        // Validate milestone status
        if milestone.status != MilestoneStatus::Submitted {
            return Err(Error::InvalidMilestoneStatus);
        }

        if has_validator_voted(&env, project_id, milestone_id, &voter)? {
            return Err(Error::AlreadyVoted);
        }

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

        set_validator_vote(&env, project_id, milestone_id, &voter)?;

        let required_approvals = (escrow.validators.len() * escrow.approval_threshold) / 10000;

        if milestone.approval_count as u32 >= required_approvals {
            milestone.status = MilestoneStatus::Approved;

            release_milestone_funds(&env, &mut escrow, &milestone)?;

            let token_client = TokenClient::new(&env, &escrow.token);
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.creator,
                &milestone.amount,
            );

            set_escrow(&env, project_id, &escrow);
            set_milestone(&env, project_id, milestone_id, &milestone);

            env.events().publish(
                (MILESTONE_APPROVED,),
                (project_id, milestone_id, milestone.approval_count),
            );

            env.events().publish(
                (FUNDS_RELEASED,),
                (project_id, milestone_id, milestone.amount),
            );
        } else if milestone.rejection_count as u32 > escrow.validators.len() - required_approvals {
            milestone.status = MilestoneStatus::Rejected;
            set_milestone(&env, project_id, milestone_id, &milestone);

            env.events().publish(
                (MILESTONE_REJECTED,),
                (project_id, milestone_id, milestone.rejection_count),
            );
        } else {
            set_milestone(&env, project_id, milestone_id, &milestone);
        }

        Ok(())
    }

    pub fn get_escrow(env: Env, project_id: u64) -> Result<EscrowInfo, Error> {
        get_escrow(&env, project_id)
    }

    pub fn get_milestone(env: Env, project_id: u64, milestone_id: u64) -> Result<Milestone, Error> {
        get_milestone(&env, project_id, milestone_id)
    }

    pub fn get_total_milestone_amount(env: Env, project_id: u64) -> Result<Amount, Error> {
        get_total_milestone_amount(&env, project_id)
    }

    pub fn get_available_balance(env: Env, project_id: u64) -> Result<Amount, Error> {
        let escrow = get_escrow(&env, project_id)?;
        Ok(escrow.total_deposited - escrow.released_amount)
    }

    /// Create an oracle‑backed milestone. The oracle address will be the only
    /// actor authorized to deliver the objective validation result before the
    /// deadline. After the deadline (or on oracle failure) standard validator
    /// voting is allowed as a fallback.
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `description_hash` - Hash of the milestone description
    /// * `amount` - Amount to be released when milestone is approved
    /// * `oracle` - Address of the oracle service
    /// * `expected_hash` - Expected data hash that the oracle will return
    /// * `deadline` - UNIX timestamp after which validators may vote as a fallback
    pub fn create_oracle_milestone(
        env: Env,
        project_id: u64,
        description_hash: Hash,
        amount: Amount,
        oracle: Address,
        expected_hash: Hash,
        deadline: u64,
    ) -> Result<(), Error> {
        // basic sanity checks are same as manual milestone
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidInput);
        }
        let total_milestones = get_total_milestone_amount(&env, project_id)?;
        let new_total = total_milestones
            .checked_add(amount)
            .ok_or(Error::InvalidInput)?;
        if new_total > escrow.total_deposited {
            return Err(Error::InsufficientEscrowBalance);
        }

        let milestone_id = get_milestone_counter(&env, project_id)?;
        let next_id = milestone_id.checked_add(1).ok_or(Error::InvalidInput)?;

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
            validation_type: ValidationType::Oracle,
            oracle_address: Some(oracle.clone()),
            oracle_expected_hash: Some(expected_hash.clone()),
            oracle_deadline: Some(deadline),
        };

        set_milestone(&env, project_id, milestone_id, &milestone);
        set_milestone_counter(&env, project_id, next_id);

        env.events().publish(
            (MILESTONE_CREATED,),
            (project_id, milestone_id, amount, description_hash),
        );

        Ok(())
    }

    /// Oracle callback to validate an objective milestone.
    /// Only the specified oracle address may call this before the deadline.
    /// If the returned hash matches the expected value the milestone is
    /// immediately approved and funds released. A mismatch emits a failure
    /// event and leaves the milestone open for validator voting after the
    /// deadline.
    pub fn oracle_validate(
        env: Env,
        project_id: u64,
        milestone_id: u64,
        result_hash: Hash,
    ) -> Result<(), Error> {
        // retrieve milestone
        let mut milestone = get_milestone(&env, project_id, milestone_id)?;
        if milestone.validation_type != ValidationType::Oracle {
            return Err(Error::InvalidInput);
        }
        // only configured oracle may call
        let oracle_addr = milestone
            .oracle_address
            .clone()
            .ok_or(Error::InvalidInput)?;
        oracle_addr.require_auth();

        // must be in submitted state
        if milestone.status != MilestoneStatus::Submitted {
            return Err(Error::InvalidMilestoneStatus);
        }

        // compare result
        if let Some(expected) = milestone.oracle_expected_hash.clone() {
            if result_hash == expected {
                // automatic approval path
                milestone.status = MilestoneStatus::Approved;
                // release funds
                let mut escrow = get_escrow(&env, project_id)?;
                release_milestone_funds(&env, &mut escrow, &milestone)?;
                let token_client = TokenClient::new(&env, &escrow.token);
                token_client.transfer(
                    &env.current_contract_address(),
                    &escrow.creator,
                    &milestone.amount,
                );
                set_escrow(&env, project_id, &escrow);
                set_milestone(&env, project_id, milestone_id, &milestone);
                env.events().publish(
                    (MILESTONE_ORACLE_APPROVED,),
                    (project_id, milestone_id),
                );
                env.events().publish(
                    (FUNDS_RELEASED,),
                    (project_id, milestone_id, milestone.amount),
                );
            } else {
                // mismatch: emit failure but keep submitted so validators can vote
                env.events().publish(
                    (MILESTONE_ORACLE_FAILED,),
                    (project_id, milestone_id),
                );
                set_milestone(&env, project_id, milestone_id, &milestone);
            }
        } else {
            return Err(Error::InvalidInput);
        }
        Ok(())
    }
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `new_validators` - New list of validator addresses
    pub fn update_validators(
        env: Env,
        project_id: u64,
        new_validators: Vec<Address>,
    ) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        // FIX: Removed unnecessary cast
        if new_validators.len() < MIN_VALIDATORS {
            return Err(Error::InvalidInput);
        }

        let mut escrow = get_escrow(&env, project_id)?;
        escrow.validators = new_validators.clone();
        set_escrow(&env, project_id, &escrow);

        env.events()
            .publish((VALIDATORS_UPDATED,), (project_id, new_validators));

        Ok(())
    }

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

    pub fn get_is_paused(env: Env) -> bool {
        is_paused(&env)
    }

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
        env.events().publish(
            (UPGRADE_SCHEDULED,),
            (admin, new_wasm_hash, pending.execute_not_before),
        );
        Ok(())
    }

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
        env.deployer()
            .update_current_contract_wasm(pending.wasm_hash.clone());
        clear_pending_upgrade(&env);
        env.events()
            .publish((UPGRADE_EXECUTED,), (admin, pending.wasm_hash));
        Ok(())
    }

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

    pub fn get_pending_upgrade(env: Env) -> Option<PendingUpgrade> {
        storage::get_pending_upgrade(&env)
    }
}

fn release_milestone_funds(
    _env: &Env,
    escrow: &mut EscrowInfo,
    milestone: &Milestone,
) -> Result<(), Error> {
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
