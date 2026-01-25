use soroban_sdk::{Env, Address};
use shared::types::{EscrowInfo, Milestone, Amount};
use shared::errors::Error;

/// Storage keys for escrow data structures
const ESCROW_PREFIX: &str = "escrow";
const MILESTONE_PREFIX: &str = "milestone";
const MILESTONE_COUNTER_PREFIX: &str = "m_counter";
const VALIDATOR_VOTE_PREFIX: &str = "v_vote";

/// Store escrow information
pub fn set_escrow(env: &Env, project_id: u64, escrow: &EscrowInfo) {
    let key = (ESCROW_PREFIX, project_id);
    env.storage().persistent().set(&key, escrow);
}

/// Retrieve escrow information
pub fn get_escrow(env: &Env, project_id: u64) -> Result<EscrowInfo, Error> {
    let key = (ESCROW_PREFIX, project_id);
    env.storage()
        .persistent()
        .get::<(&str, u64), EscrowInfo>(&key)
        .ok_or(Error::NotFound)
}

/// Check if escrow exists
pub fn escrow_exists(env: &Env, project_id: u64) -> bool {
    let key = (ESCROW_PREFIX, project_id);
    env.storage()
        .persistent()
        .has(&key)
}

/// Store milestone information
pub fn set_milestone(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    milestone: &Milestone,
) {
    let key = (MILESTONE_PREFIX, project_id, milestone_id);
    env.storage().persistent().set(&key, milestone);
}

/// Retrieve milestone information
pub fn get_milestone(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
) -> Result<Milestone, Error> {
    let key = (MILESTONE_PREFIX, project_id, milestone_id);
    env.storage()
        .persistent()
        .get::<(&str, u64, u64), Milestone>(&key)
        .ok_or(Error::NotFound)
}

/// Store milestone counter for a project
pub fn set_milestone_counter(env: &Env, project_id: u64, counter: u64) {
    let key = (MILESTONE_COUNTER_PREFIX, project_id);
    env.storage().persistent().set(&key, &counter);
}

/// Retrieve milestone counter for a project
pub fn get_milestone_counter(env: &Env, project_id: u64) -> Result<u64, Error> {
    let key = (MILESTONE_COUNTER_PREFIX, project_id);
    env.storage()
        .persistent()
        .get::<(&str, u64), u64>(&key)
        .ok_or(Error::NotFound)
}

/// Record that a validator voted on a milestone
pub fn set_validator_vote(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    validator: &Address,
) -> Result<(), Error> {
    let key = (VALIDATOR_VOTE_PREFIX, project_id, milestone_id, validator);
    env.storage().persistent().set(&key, &true);
    Ok(())
}

/// Check if a validator has already voted on a milestone
pub fn has_validator_voted(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    validator: &Address,
) -> Result<bool, Error> {
    let key = (VALIDATOR_VOTE_PREFIX, project_id, milestone_id, validator);
    Ok(env.storage()
        .persistent()
        .has(&key))
}

/// Clear all validator votes for a milestone (used when resubmitting)
pub fn clear_milestone_voters(env: &Env, project_id: u64, milestone_id: u64) {
    // Get the escrow to know how many validators there are
    if let Ok(escrow) = get_escrow(env, project_id) {
        for validator in escrow.validators.iter() {
            let key = (VALIDATOR_VOTE_PREFIX, project_id, milestone_id, validator);
            env.storage().persistent().remove(&key);
        }
    }
}

/// Update vote counts for a milestone (alternative approach if needed)
pub fn set_milestone_votes(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    approvals: u32,
    rejections: u32,
) {
    let mut milestone = match get_milestone(env, project_id, milestone_id) {
        Ok(m) => m,
        Err(_) => return,
    };

    milestone.approval_count = approvals;
    milestone.rejection_count = rejections;
    set_milestone(env, project_id, milestone_id, &milestone);
}

/// Calculate total amount allocated to approved and submitted milestones
pub fn get_total_milestone_amount(env: &Env, project_id: u64) -> Result<Amount, Error> {
    // Get milestone counter to know how many milestones exist
    let counter = get_milestone_counter(env, project_id)?;
    let mut total: Amount = 0;

    for milestone_id in 0..counter {
        if let Ok(milestone) = get_milestone(env, project_id, milestone_id) {
            total = total
                .checked_add(milestone.amount)
                .ok_or(Error::InvalidInput)?;
        }
    }

    Ok(total)
}

