#![no_std]

use shared::{
    constants::{
        ESCROW_INITIALIZED, MAX_BATCH_SIZE, MILESTONE_APPROVAL_THRESHOLD, MILESTONE_APPROVED,
        MILESTONE_CREATED, MILESTONE_REJECTED, MILESTONE_SUBMITTED, MIN_VALIDATORS,
    },
    errors::Error,
    events::*,
    types::{Amount, BatchResult, EscrowInfo, Hash, Milestone, MilestoneStatus},
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

        // Create escrow info
        let escrow = EscrowInfo {
            project_id,
            creator: creator.clone(),
            token: token.clone(),
            total_deposited: 0,
            released_amount: 0,
            validators,
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

        // Verify voter is a validator
        if !escrow.validators.iter().any(|v| v == voter) {
            return Err(Error::NotAValidator);
        }

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

        // Record that this validator voted
        set_validator_vote(&env, project_id, milestone_id, &voter)?;

        // Check if milestone is approved or rejected
        let _total_votes = milestone.approval_count as u32 + milestone.rejection_count as u32;
        let required_approvals =
            (escrow.validators.len() as u32 * MILESTONE_APPROVAL_THRESHOLD) / 10000;

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

    // ==================== Batch Operations ====================

    /// Create multiple milestones for a project in a single call
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `milestones` - Vec of (description_hash, amount) tuples
    pub fn batch_create_milestones(
        env: Env,
        project_id: u64,
        milestones: Vec<(Hash, Amount)>,
    ) -> Result<BatchResult, Error> {
        let count = milestones.len() as u32;
        if count == 0 {
            return Err(Error::BatchEmpty);
        }
        if count > MAX_BATCH_SIZE {
            return Err(Error::BatchLimitExceeded);
        }

        // Get escrow and authenticate creator once
        let escrow = get_escrow(&env, project_id)?;
        escrow.creator.require_auth();

        let mut successful: u32 = 0;
        let mut failed: u32 = 0;
        let mut milestone_id = get_milestone_counter(&env, project_id)?;
        let mut running_total = get_total_milestone_amount(&env, project_id)?;

        for i in 0..milestones.len() {
            let (description_hash, amount) = milestones.get(i).unwrap();

            // Validate amount
            if amount <= 0 {
                failed += 1;
                env.events()
                    .publish((BATCH_ITEM_FAILED,), (project_id, i as u32));
                continue;
            }

            // Validate total doesn't exceed escrow balance
            let new_total = match running_total.checked_add(amount) {
                Some(t) => t,
                None => {
                    failed += 1;
                    env.events()
                        .publish((BATCH_ITEM_FAILED,), (project_id, i as u32));
                    continue;
                }
            };

            if new_total > escrow.total_deposited {
                failed += 1;
                env.events()
                    .publish((BATCH_ITEM_FAILED,), (project_id, i as u32));
                continue;
            }

            // Create milestone
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

            set_milestone(&env, project_id, milestone_id, &milestone);
            running_total = new_total;
            milestone_id += 1;
            successful += 1;

            env.events().publish(
                (MILESTONE_CREATED,),
                (project_id, milestone.id, amount, description_hash),
            );
        }

        // Update the milestone counter once
        set_milestone_counter(&env, project_id, milestone_id);

        env.events().publish(
            (BATCH_COMPLETED,),
            (project_id, successful, failed),
        );

        Ok(BatchResult {
            total: count,
            successful,
            failed,
        })
    }

    /// Vote on multiple milestones in a single call
    ///
    /// # Arguments
    /// * `project_id` - Project identifier
    /// * `votes` - Vec of (milestone_id, approve) tuples
    /// * `voter` - Address of the voter
    pub fn batch_vote_milestones(
        env: Env,
        project_id: u64,
        votes: Vec<(u64, bool)>,
        voter: Address,
    ) -> Result<BatchResult, Error> {
        let count = votes.len() as u32;
        if count == 0 {
            return Err(Error::BatchEmpty);
        }
        if count > MAX_BATCH_SIZE {
            return Err(Error::BatchLimitExceeded);
        }

        // Authenticate voter once
        voter.require_auth();

        // Get escrow and verify voter is a validator
        let mut escrow = get_escrow(&env, project_id)?;
        if !escrow.validators.iter().any(|v| v == voter) {
            return Err(Error::NotAValidator);
        }

        let mut successful: u32 = 0;
        let mut failed: u32 = 0;

        for i in 0..votes.len() {
            let (milestone_id, approve) = votes.get(i).unwrap();

            // Get milestone - skip if not found
            let mut milestone = match get_milestone(&env, project_id, milestone_id) {
                Ok(m) => m,
                Err(_) => {
                    failed += 1;
                    env.events()
                        .publish((BATCH_ITEM_FAILED,), (project_id, milestone_id));
                    continue;
                }
            };

            // Validate milestone status
            if milestone.status != MilestoneStatus::Submitted {
                failed += 1;
                env.events()
                    .publish((BATCH_ITEM_FAILED,), (project_id, milestone_id));
                continue;
            }

            // Check if already voted
            if has_validator_voted(&env, project_id, milestone_id, &voter).unwrap_or(false) {
                failed += 1;
                env.events()
                    .publish((BATCH_ITEM_FAILED,), (project_id, milestone_id));
                continue;
            }

            // Update vote counts
            if approve {
                milestone.approval_count = milestone
                    .approval_count
                    .checked_add(1)
                    .unwrap_or(milestone.approval_count);
            } else {
                milestone.rejection_count = milestone
                    .rejection_count
                    .checked_add(1)
                    .unwrap_or(milestone.rejection_count);
            }

            // Record vote
            let _ = set_validator_vote(&env, project_id, milestone_id, &voter);

            // Check for milestone finalization
            let required_approvals =
                (escrow.validators.len() as u32 * MILESTONE_APPROVAL_THRESHOLD) / 10000;

            if milestone.approval_count as u32 >= required_approvals {
                milestone.status = MilestoneStatus::Approved;

                // Release funds
                if release_milestone_funds(&env, &mut escrow, &milestone).is_ok() {
                    let token_client = TokenClient::new(&env, &escrow.token);
                    token_client.transfer(
                        &env.current_contract_address(),
                        &escrow.creator,
                        &milestone.amount,
                    );
                    set_escrow(&env, project_id, &escrow);

                    env.events().publish(
                        (MILESTONE_APPROVED,),
                        (project_id, milestone_id, milestone.approval_count),
                    );
                    env.events().publish(
                        (FUNDS_RELEASED,),
                        (project_id, milestone_id, milestone.amount),
                    );
                }
            } else if milestone.rejection_count as u32
                > escrow.validators.len() as u32 - required_approvals
            {
                milestone.status = MilestoneStatus::Rejected;
                env.events().publish(
                    (MILESTONE_REJECTED,),
                    (project_id, milestone_id, milestone.rejection_count),
                );
            }

            set_milestone(&env, project_id, milestone_id, &milestone);
            successful += 1;
        }

        env.events()
            .publish((BATCH_COMPLETED,), (project_id, successful, failed));

        Ok(BatchResult {
            total: count,
            successful,
            failed,
        })
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
