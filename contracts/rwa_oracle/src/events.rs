// src/events.rs

use soroban_sdk::{Env, symbol_short};

pub fn nav_updated(env: &Env, old_value: i128, new_value: i128) {
    env.events().publish(
        (symbol_short!("nav_update"),),
        (old_value, new_value),
    );
}