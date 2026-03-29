#![cfg(test)]

use crate::identity_registry::{IdentityRegistryContract, IdentityRegistryContractClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn test_initialization() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    env.mock_all_auths();

    // Initialize
    client.init_registry(&admin);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_double_initialization_should_panic() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    env.mock_all_auths();

    client.init_registry(&admin);
    client.init_registry(&admin); // Should panic
}

#[test]
fn test_add_and_verify_identity() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.init_registry(&admin);

    // Create a mock hash
    let mut hash_data = [0u8; 32];
    hash_data[0] = 1;
    let hash = BytesN::from_array(&env, &hash_data);

    assert!(!client.verify(&user));

    client.add(&admin, &user, &hash, &1);

    assert!(client.verify(&user));
    assert_eq!(client.get_registry_tier(&user), 1);
}

#[test]
fn test_remove_identity() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.init_registry(&admin);

    let mut hash_data = [0u8; 32];
    hash_data[1] = 2;
    let hash = BytesN::from_array(&env, &hash_data);

    client.add(&admin, &user, &hash, &1);
    assert!(client.verify(&user));

    client.remove(&admin, &user);
    assert!(!client.verify(&user));
}

#[test]
#[should_panic(expected = "Unauthorized: Only admin can add identities")]
fn test_unauthorized_add_identity() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fake_admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.init_registry(&admin);

    let mut hash_data = [0u8; 32];
    hash_data[0] = 5;
    let hash = BytesN::from_array(&env, &hash_data);

    // Only the real admin can add, should panic
    client.add(&fake_admin, &user, &hash, &1);
}

#[test]
#[should_panic(expected = "Unauthorized: Only admin can remove identities")]
fn test_unauthorized_remove_identity() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fake_admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.init_registry(&admin);

    let mut hash_data = [0u8; 32];
    hash_data[0] = 5;
    let hash = BytesN::from_array(&env, &hash_data);

    client.add(&admin, &user, &hash, &1);

    // Fake admin attempts to remove, should panic
    client.remove(&fake_admin, &user);
}

#[test]
#[should_panic(expected = "Invalid hash: cannot be all zeros")]
fn test_invalid_hash_should_panic() {
    let env = Env::default();
    let contract_id = env.register_contract(None, IdentityRegistryContract);
    let client = IdentityRegistryContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user = Address::generate(&env);

    env.mock_all_auths();
    client.init_registry(&admin);

    let zero_hash = BytesN::from_array(&env, &[0u8; 32]);

    // Should panic
    client.add(&admin, &user, &zero_hash, &1);
}
