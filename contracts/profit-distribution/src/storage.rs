use soroban_sdk::{Address, Env};

use crate::types::{DataKey, InvestorShare};

pub fn set_project_token(env: &Env, project_id: u64, token: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::ProjectToken(project_id), token);
}

pub fn get_project_token(env: &Env, project_id: u64) -> Option<Address> {
    env.storage()
        .persistent()
        .get(&DataKey::ProjectToken(project_id))
}

pub fn set_investor_share(env: &Env, project_id: u64, investor: &Address, share: &InvestorShare) {
    env.storage()
        .persistent()
        .set(&DataKey::InvestorShare(project_id, investor.clone()), share);
}

pub fn get_investor_share(env: &Env, project_id: u64, investor: &Address) -> Option<InvestorShare> {
    env.storage()
        .persistent()
        .get(&DataKey::InvestorShare(project_id, investor.clone()))
}

pub fn set_total_shares(env: &Env, project_id: u64, total_shares: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::TotalShares(project_id), &total_shares);
}

pub fn get_total_shares(env: &Env, project_id: u64) -> Option<u32> {
    env.storage()
        .persistent()
        .get(&DataKey::TotalShares(project_id))
}

pub fn set_acc_profit_per_share(env: &Env, project_id: u64, acc: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::AccProfitPerShare(project_id), &acc);
}

pub fn get_acc_profit_per_share(env: &Env, project_id: u64) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::AccProfitPerShare(project_id))
        .unwrap_or(0)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::Admin)
}
