// src/lib.rs

#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Address};

mod storage;
mod auth;
mod events;

use storage::DataKey;

#[contract]
pub struct RwaOracleContract;

#[contractimpl]
impl RwaOracleContract {

    // -------------------------------------
    // INIT
    // -------------------------------------
    pub fn initialize(env: Env, admin: Address, initial_nav: i128) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::CurrentNAV, &initial_nav);
        env.storage().instance().set(&DataKey::LastUpdated, &env.ledger().timestamp());
    }

    // -------------------------------------
    // UPDATE NAV (CORE FUNCTION)
    // -------------------------------------
    pub fn update_nav(env: Env, admin: Address, new_value: i128) {
        auth::require_admin(&env, &admin);

        if new_value <= 0 {
            panic!("NAV must be positive");
        }

        let old_value: i128 = env
            .storage()
            .instance()
            .get(&DataKey::CurrentNAV)
            .unwrap();

        env.storage().instance().set(&DataKey::CurrentNAV, &new_value);
        env.storage().instance().set(&DataKey::LastUpdated, &env.ledger().timestamp());

        // 🔥 Emit event for frontend + analytics
        events::nav_updated(&env, old_value, new_value);
    }

    // -------------------------------------
    // GET CURRENT NAV
    // -------------------------------------
    pub fn get_nav(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::CurrentNAV)
            .unwrap()
    }

    // -------------------------------------
    // GET LAST UPDATED
    // -------------------------------------
    pub fn get_last_updated(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LastUpdated)
            .unwrap()
    }
}