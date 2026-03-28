use crate::storage::{get_vesting_schedule, set_vesting_schedule, remove_vesting_schedule};
use shared::types::{Amount, VestingSchedule};
use shared::errors::Error;
use soroban_sdk::{Address, Env};

pub fn calculate_unlocked(env: &Env, schedule: &VestingSchedule) -> Amount {
    let now = env.ledger().timestamp();
    if now <= schedule.start_time {
        return 0;
    }
    
    let elapsed = now - schedule.start_time;
    if elapsed >= schedule.duration {
        return schedule.total_amount;
    }
    
    // Linear vesting: total_amount * elapsed / duration
    (schedule.total_amount * elapsed as i128) / schedule.duration as i128
}

pub fn create_vesting(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    beneficiary: Address,
    amount: Amount,
    duration: u64,
) {
    let schedule = VestingSchedule {
        project_id,
        milestone_id,
        beneficiary,
        total_amount: amount,
        claimed_amount: 0,
        start_time: env.ledger().timestamp(),
        duration,
    };
    set_vesting_schedule(env, project_id, milestone_id, &schedule);
}

pub fn internal_claim_unlocked(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
) -> Result<(Address, Amount), Error> {
    let mut schedule = get_vesting_schedule(env, project_id, milestone_id)?;
    schedule.beneficiary.require_auth();

    let unlocked = calculate_unlocked(env, &schedule);
    let claimable = unlocked - schedule.claimed_amount;

    if claimable <= 0 {
        return Err(Error::NoClaim);
    }

    schedule.claimed_amount += claimable;
    let beneficiary = schedule.beneficiary.clone();
    
    if schedule.claimed_amount >= schedule.total_amount {
        remove_vesting_schedule(env, project_id, milestone_id);
    } else {
        set_vesting_schedule(env, project_id, milestone_id, &schedule);
    }

    Ok((beneficiary, claimable))
}

pub fn get_vesting(env: &Env, project_id: u64, milestone_id: u64) -> Result<VestingSchedule, Error> {
    get_vesting_schedule(env, project_id, milestone_id)
}
