use shared::errors::Error;
use shared::types::{Amount, Dispute, EscrowInfo, JurorInfo, Milestone, VoteCommitment};
use soroban_sdk::{Address, Env, Vec};

/// Storage keys for escrow data structures
const ESCROW_PREFIX: &str = "escrow";
const MILESTONE_PREFIX: &str = "milestone";
const MILESTONE_COUNTER_PREFIX: &str = "m_counter";
const VALIDATOR_VOTE_PREFIX: &str = "v_vote";
const ADMIN_KEY: &str = "admin";

// Dispute Storage Keys
const JUROR_TOKEN_KEY: &str = "j_token";
const DISPUTE_ID_KEY: &str = "d_id";
const DISPUTE_FEE_POOL: &str = "d_fee_pool";
const DISPUTE_PREFIX: &str = "dispute";
const JUROR_PREFIX: &str = "juror";
const DISPUTE_VOTE_PREFIX: &str = "d_vote";
const JUROR_ASSIGNMENTS_PREFIX: &str = "j_assign";
const ACTIVE_JURORS_KEY: &str = "act_jurors";

/// Store platform admin
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN_KEY, admin);
}

/// Retrieve platform admin
pub fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get::<&str, Address>(&ADMIN_KEY)
        .ok_or(Error::NotInitialized)
}

/// Check if admin is set
pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&ADMIN_KEY)
}

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
    env.storage().persistent().has(&key)
}

/// Store milestone information
pub fn set_milestone(env: &Env, project_id: u64, milestone_id: u64, milestone: &Milestone) {
    let key = (MILESTONE_PREFIX, project_id, milestone_id);
    env.storage().persistent().set(&key, milestone);
}

/// Retrieve milestone information
pub fn get_milestone(env: &Env, project_id: u64, milestone_id: u64) -> Result<Milestone, Error> {
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
    let key = (
        VALIDATOR_VOTE_PREFIX,
        project_id,
        milestone_id,
        validator.clone(),
    );
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
    let key = (
        VALIDATOR_VOTE_PREFIX,
        project_id,
        milestone_id,
        validator.clone(),
    );
    Ok(env.storage().persistent().has(&key))
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

// ==================== Dispute Resolution Storage ====================

/// Store the token used for juror staking
pub fn set_juror_token(env: &Env, token: &Address) {
    env.storage().instance().set(&JUROR_TOKEN_KEY, token);
}

/// Retrieve the token used for juror staking
pub fn get_juror_token(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get::<&str, Address>(&JUROR_TOKEN_KEY)
        .ok_or(Error::NotInitialized)
}

/// Store the next dispute ID
pub fn set_next_dispute_id(env: &Env, id: u64) {
    env.storage().persistent().set(&DISPUTE_ID_KEY, &id);
}

/// Retrieve the next dispute ID, defaults to 1
pub fn get_next_dispute_id(env: &Env) -> u64 {
    env.storage()
        .persistent()
        .get::<&str, u64>(&DISPUTE_ID_KEY)
        .unwrap_or(1)
}

/// Retrieve the total dispute fee pool
pub fn get_dispute_fee_pool(env: &Env) -> Amount {
    env.storage()
        .persistent()
        .get::<&str, Amount>(&DISPUTE_FEE_POOL)
        .unwrap_or(0)
}

/// Update the total dispute fee pool
pub fn set_dispute_fee_pool(env: &Env, amount: Amount) {
    env.storage().persistent().set(&DISPUTE_FEE_POOL, &amount);
}

/// Store a dispute
pub fn set_dispute(env: &Env, dispute_id: u64, dispute: &Dispute) {
    let key = (DISPUTE_PREFIX, dispute_id);
    env.storage().persistent().set(&key, dispute);
}

/// Retrieve a dispute
pub fn get_dispute(env: &Env, dispute_id: u64) -> Result<Dispute, Error> {
    let key = (DISPUTE_PREFIX, dispute_id);
    env.storage()
        .persistent()
        .get::<(&str, u64), Dispute>(&key)
        .ok_or(Error::DispNF)
}

/// Store a juror's information
pub fn set_juror(env: &Env, juror_address: &Address, juror: &JurorInfo) {
    let key = (JUROR_PREFIX, juror_address.clone());
    env.storage().persistent().set(&key, juror);
}

/// Retrieve a juror's information
pub fn get_juror(env: &Env, juror_address: &Address) -> Result<JurorInfo, Error> {
    let key = (JUROR_PREFIX, juror_address.clone());
    env.storage()
        .persistent()
        .get::<(&str, Address), JurorInfo>(&key)
        .ok_or(Error::NotJuror)
}

/// Remove a juror's information
pub fn remove_juror(env: &Env, juror_address: &Address) {
    let key = (JUROR_PREFIX, juror_address.clone());
    env.storage().persistent().remove(&key);
}

/// Store a vote commitment for a dispute
pub fn set_dispute_vote(
    env: &Env,
    dispute_id: u64,
    juror_address: &Address,
    commitment: &VoteCommitment,
) {
    let key = (DISPUTE_VOTE_PREFIX, dispute_id, juror_address.clone());
    env.storage().persistent().set(&key, commitment);
}

/// Retrieve a vote commitment for a dispute
pub fn get_dispute_vote(
    env: &Env,
    dispute_id: u64,
    juror_address: &Address,
) -> Result<VoteCommitment, Error> {
    let key = (DISPUTE_VOTE_PREFIX, dispute_id, juror_address.clone());
    env.storage()
        .persistent()
        .get::<(&str, u64, Address), VoteCommitment>(&key)
        .ok_or(Error::NotFound)
}

/// Store the assigned jurors for a given dispute
pub fn set_juror_assignments(env: &Env, dispute_id: u64, jurors: &Vec<Address>) {
    let key = (JUROR_ASSIGNMENTS_PREFIX, dispute_id);
    env.storage().persistent().set(&key, jurors);
}

/// Retrieve the assigned jurors for a given dispute
pub fn get_juror_assignments(env: &Env, dispute_id: u64) -> Result<Vec<Address>, Error> {
    let key = (JUROR_ASSIGNMENTS_PREFIX, dispute_id);
    env.storage()
        .persistent()
        .get::<(&str, u64), Vec<Address>>(&key)
        .ok_or(Error::NotFound)
}

/// Retrieve the active juror addresses list
pub fn get_active_jurors(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get::<&str, Vec<Address>>(&ACTIVE_JURORS_KEY)
        .unwrap_or(Vec::new(&env))
}

/// Store the active juror addresses list
pub fn set_active_jurors(env: &Env, jurors: &Vec<Address>) {
    env.storage().persistent().set(&ACTIVE_JURORS_KEY, jurors);
}
