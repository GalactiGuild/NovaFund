#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{Address, Env, Map};

fn setup_test() -> (Env, MultiPartyPaymentClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, MultiPartyPayment);
    let client = MultiPartyPaymentClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = env.register_stellar_asset_contract(admin.clone());

    (env, client, admin, token)
}

#[test]
fn test_multi_party_payment_flow() {
    let (env, client, admin, token) = setup_test();
    let token_admin = StellarAssetClient::new(&env, &token);

    client.initialize(&admin);

    let party1 = Address::generate(&env);
    let party2 = Address::generate(&env);

    let mut stakeholders = Map::new(&env);
    stakeholders.set(party1.clone(), 7000); // 70%
    stakeholders.set(party2.clone(), 3000); // 30%

    client.setup_payment(&1, &token, &stakeholders);

    let payer = Address::generate(&env);
    token_admin.mint(&payer, &1000);

    // Receive payment: 1000
    client.receive_payment(&1, &payer, &1000);

    assert_eq!(client.get_balance(&1, &party1), 700);
    assert_eq!(client.get_balance(&1, &party2), 300);

    // Party 1 withdraws
    client.withdraw(&1, &party1);
    assert_eq!(client.get_balance(&1, &party1), 0);

    // Receive more: 500
    token_admin.mint(&payer, &500);
    client.receive_payment(&1, &payer, &500);

    assert_eq!(client.get_balance(&1, &party1), 350); // 70% of 500
    assert_eq!(client.get_balance(&1, &party2), 450); // 300 + 30% of 500 = 300 + 150 = 450
}
