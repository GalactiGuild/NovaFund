// src/auth.rs

use soroban_sdk::{Env, Address};

pub fn require_admin(env: &Env, admin: &Address) {
    admin.require_auth();

    let stored_admin: Address = env
        .storage()
        .instance()
        .get(&super::storage::DataKey::Admin)
        .unwrap();

    if &stored_admin != admin {
        panic!("Unauthorized: not admin");
    }
}