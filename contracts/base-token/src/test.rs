#![cfg(test)]

use super::*;
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_transfer_with_fees() {
    let env = Env::default();
    let contract_id = env.register_contract(None, BaseToken);
    let token_client = TokenClient::new(&env, &contract_id);
    let base_token_client = BaseTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    // Init with 500 BPS (5%) fee
    base_token_client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Nova Token"),
        &String::from_str(&env, "NOVA"),
        &treasury,
        &500,
    );

    base_token_client.mint(&user1, &1000);

    assert_eq!(token_client.balance(&user1), 1000);

    // Transfer 100: 5% fee means 5 to treasury, 95 to user2
    token_client.transfer(&user1, &user2, &100);

    assert_eq!(token_client.balance(&user1), 900);
    assert_eq!(token_client.balance(&treasury), 5);
    assert_eq!(token_client.balance(&user2), 95);
}

#[test]
fn test_transfer_dust() {
    let env = Env::default();
    let contract_id = env.register_contract(None, BaseToken);
    let token_client = TokenClient::new(&env, &contract_id);
    let base_token_client = BaseTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    // 10 BPS (0.1%)
    base_token_client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Nova Token"),
        &String::from_str(&env, "NOVA"),
        &treasury,
        &10,
    );

    base_token_client.mint(&user1, &100);

    // Transfer amount = 2.
    // 2 * 10 / 10000 = 0
    // But dust protection kicks in: amount > 1 and bps > 0 -> fee = 1
    token_client.transfer(&user1, &user2, &2);

    assert_eq!(token_client.balance(&user1), 98);
    assert_eq!(token_client.balance(&treasury), 1); // Minimum fee extracted
    assert_eq!(token_client.balance(&user2), 1);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_transfer_insufficient_balance() {
    let env = Env::default();
    let contract_id = env.register_contract(None, BaseToken);
    let token_client = TokenClient::new(&env, &contract_id);
    let base_token_client = BaseTokenClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    env.mock_all_auths();

    base_token_client.initialize(
        &admin,
        &7,
        &String::from_str(&env, "Nova Token"),
        &String::from_str(&env, "NOVA"),
        &treasury,
        &100,
    );

    base_token_client.mint(&user1, &50);

    token_client.transfer(&user1, &user2, &100); // Should panic
}
