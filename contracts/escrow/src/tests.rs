// FIX: Module inception error removed by deleting "mod tests {" wrapper
use crate::{EscrowContract, EscrowContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, Vec,
};

fn create_test_env() -> (Env, Address, Address, Address, Vec<Address>) {
    let env = Env::default();
    env.ledger().set_timestamp(1000);

    let creator = Address::generate(&env);
    let token = Address::generate(&env);
    let validator1 = Address::generate(&env);
    let validator2 = Address::generate(&env);
    let validator3 = Address::generate(&env);

    let mut validators = Vec::new(&env);
    validators.push_back(validator1);
    validators.push_back(validator2);
    validators.push_back(validator3.clone());

    (env, creator, token, validator3, validators)
}

// FIX: Added lifetime elision to client
fn create_client(env: &Env) -> EscrowContractClient<'_> {
    EscrowContractClient::new(env, &env.register_contract(None, EscrowContract))
}

#[allow(dead_code)]
fn setup_with_admin(
    env: &Env,
) -> (
    Address,
    Address,
    Address,
    Vec<Address>,
    EscrowContractClient<'_>, // FIX: Added lifetime elision
) {
    let admin = Address::generate(env);
    let creator = Address::generate(env);
    let token = Address::generate(env);

    let mut validators = Vec::new(env);
    validators.push_back(Address::generate(env));
    validators.push_back(Address::generate(env));
    validators.push_back(Address::generate(env));

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_id);

    client.initialize_admin(&admin);
    client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

    (admin, creator, token, validators, client)
}

const DEFAULT_THRESHOLD: u32 = 6700;

#[test]
fn test_initialize_escrow() {
    let (env, creator, token, _, validators) = create_test_env();
    let client = create_client(&env);
    env.mock_all_auths();

    client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

    let escrow = client.get_escrow(&1);
    assert_eq!(escrow.project_id, 1);
    assert_eq!(escrow.creator, creator);
    assert_eq!(escrow.token, token);
    assert_eq!(escrow.total_deposited, 0);
    assert_eq!(escrow.released_amount, 0);
    assert_eq!(escrow.approval_threshold, DEFAULT_THRESHOLD);
}

// ... other tests follow the same pattern
