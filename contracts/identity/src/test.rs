#![cfg(test)]

use crate::{IdentityContract, IdentityContractClient};
use shared::types::Jurisdiction;
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

#[test]
fn test_verification_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityContract);
    let client = IdentityContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();

    client.initialize(&admin);

    assert_eq!(client.get_tier(&user, &Jurisdiction::UnitedStates), 0);
    assert!(!client.is_verified(&user, &Jurisdiction::UnitedStates));

    // Simulate valid proof (mocked to just non-empty bytes)
    let proof = Bytes::from_slice(&env, &[1, 2, 3]);
    let public_inputs = Bytes::from_slice(&env, &[0]);

    // Verify as Tier 1
    client.verify_identity(
        &user,
        &Jurisdiction::UnitedStates,
        &proof,
        &public_inputs,
        &1,
    );

    assert_eq!(client.get_tier(&user, &Jurisdiction::UnitedStates), 1);
    assert!(client.is_verified(&user, &Jurisdiction::UnitedStates));

    // Test revocation
    client.revoke_verification(&user, &Jurisdiction::UnitedStates);
    assert!(!client.is_verified(&user, &Jurisdiction::UnitedStates));
}

#[test]
fn test_oracle_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityContract);
    let client = IdentityContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    // Initial state: not an oracle
    assert!(!client.is_oracle(&oracle));

    // Admin adds oracle
    client.add_oracle(&admin, &oracle);
    assert!(client.is_oracle(&oracle));

    // Oracle updates user status
    let proof_hash = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);
    client.update_status_via_oracle(&oracle, &user, &Jurisdiction::Global, &2, &proof_hash);

    // Verify user status
    assert_eq!(client.get_tier(&user, &Jurisdiction::Global), 2);
    assert!(client.is_verified(&user, &Jurisdiction::Global));

    // Admin removes oracle
    client.remove_oracle(&admin, &oracle);
    assert!(!client.is_oracle(&oracle));

    // Removed oracle attempts to update status (should panic)
    let result =
        client.try_update_status_via_oracle(&oracle, &user, &Jurisdiction::Global, &3, &proof_hash);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "Unauthorized: Not an authorized oracle")]
fn test_unauthorized_oracle_update_panics() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityContract);
    let client = IdentityContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fake_oracle = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);

    let proof_hash = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);
    client.update_status_via_oracle(&fake_oracle, &user, &Jurisdiction::Global, &2, &proof_hash);
}
