// tests/nav.rs

use soroban_sdk::{Env, Address};
use crate::RwaOracleContract;

#[test]
fn test_update_nav() {
    let env = Env::default();
    let admin = Address::generate(&env);

    let contract_id = env.register_contract(None, RwaOracleContract);
    let client = RwaOracleContractClient::new(&env, &contract_id);

    client.initialize(&admin, &1000);

    client.update_nav(&admin, &1200);

    let nav = client.get_nav();
    assert_eq!(nav, 1200);
}