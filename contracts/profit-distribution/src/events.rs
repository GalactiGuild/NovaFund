use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
pub enum EventType {
    ProfitDeposited(u64, i128),  // project_id, amount
    DividendClaimed(u64, Address, i128), // project_id, investor, amount
}

pub fn emit_deposit_event(env: &Env, project_id: u64, amount: i128) {
    env.events().publish(
        (EventType::ProfitDeposited(project_id, amount),),
        (),
    );
}

pub fn emit_claim_event(env: &Env, project_id: u64, investor: &Address, amount: i128) {
    env.events().publish(
        (EventType::DividendClaimed(project_id, investor.clone(), amount),),
        (),
    );
}