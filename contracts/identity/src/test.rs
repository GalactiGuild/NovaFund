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
    
    assert_eq!(client.is_verified(&user, &Jurisdiction::UnitedStates), false);
    
    // Simulate valid proof (mocked to just non-empty bytes)
    let proof = Bytes::from_slice(&env, &[1, 2, 3]);
    let public_inputs = Bytes::from_slice(&env, &[0]);
    
    client.verify_identity(&user, &Jurisdiction::UnitedStates, &proof, &public_inputs);
    
    assert_eq!(client.is_verified(&user, &Jurisdiction::UnitedStates), true);
    
    // Test revocation
    client.revoke_verification(&user, &Jurisdiction::UnitedStates);
    assert_eq!(client.is_verified(&user, &Jurisdiction::UnitedStates), false);
}
