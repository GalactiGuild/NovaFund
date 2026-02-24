use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::StellarAssetClient,
    Address, Bytes, Env, Vec,
};

// Helper function to create test environment with registered contract
fn setup_test_env() -> (
    Env,
    GovernanceContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    let contract_id = env.register_contract(None, GovernanceContract);
    let client = GovernanceContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let creator = Address::generate(&env);
    let voter1 = Address::generate(&env);

    // Mock auth for all addresses
    env.mock_all_auths();

    (env, client, admin, creator, voter1)
}

// Helper to initialize contract
fn initialize_contract(client: &GovernanceContractClient, admin: &Address, total_voters: u32) {
    client.initialize(admin, &total_voters);
}

// Helper to create a proposal
fn create_test_proposal(
    env: &Env,
    client: &GovernanceContractClient,
    creator: &Address,
    start_offset: u64,
    end_offset: u64,
) -> u64 {
    let current_time = env.ledger().timestamp();
    let payload = Bytes::from_slice(env, b"ipfs://QmTest123");

    client.create_proposal(
        creator,
        &payload,
        &(current_time + start_offset),
        &(current_time + end_offset),
    )
}

#[test]
fn test_initialize() {
    let (_, client, admin, _, _) = setup_test_env();
    client.initialize(&admin, &100);
    let total_voters = client.get_total_voters();
    assert_eq!(total_voters, 100);
}

#[test]
fn test_initialize_rejects_zero_voters() {
    let (_, client, admin, _, _) = setup_test_env();

    let result = client.try_initialize(&admin, &0);
    assert!(result.is_err());
}

#[test]
fn test_initialize_prevents_reinitialization() {
    let (_, client, admin, _, _) = setup_test_env();
    client.initialize(&admin, &100);
    let result = client.try_initialize(&admin, &200);
    assert!(result.is_err());
}

#[test]
fn test_create_proposal_success() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let current_time = env.ledger().timestamp();
    let payload = Bytes::from_slice(&env, b"ipfs://QmTest123");

    let proposal_id = client.create_proposal(
        &creator,
        &payload,
        &(current_time + 100),
        &(current_time + 1000),
    );

    assert_eq!(proposal_id, 0);

    // Verify proposal was stored correctly
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.id, 0);
    assert_eq!(proposal.creator, creator);
    assert_eq!(proposal.yes_votes, 0);
    assert_eq!(proposal.no_votes, 0);
    assert!(!proposal.executed);
}

#[test]
fn test_create_proposal_invalid_time_window() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let current_time = env.ledger().timestamp();
    let payload = Bytes::from_slice(&env, b"ipfs://QmTest123");

    let result = client.try_create_proposal(
        &creator,
        &payload,
        &(current_time + 1000),
        &(current_time + 1000),
    );
    assert!(result.is_err());
}

#[test]
fn test_create_proposal_start_time_in_past() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let current_time = env.ledger().timestamp();
    let payload = Bytes::from_slice(&env, b"ipfs://QmTest123");

    let result = client.try_create_proposal(
        &creator,
        &payload,
        &(current_time - 100),
        &(current_time + 1000),
    );
    assert!(result.is_err());
}

#[test]
fn test_create_proposal_empty_payload() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let current_time = env.ledger().timestamp();
    let empty_payload = Bytes::new(&env);

    let result = client.try_create_proposal(
        &creator,
        &empty_payload,
        &(current_time + 100),
        &(current_time + 1000),
    );
    assert!(result.is_err());
}

#[test]
fn test_vote_success() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 1000);

    client.vote(&proposal_id, &voter, &true);
    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes, 1);
    assert_eq!(proposal.no_votes, 0);

    assert!(client.has_voted(&proposal_id, &voter));
}

#[test]
fn test_vote_before_start_time() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let proposal_id = create_test_proposal(&env, &client, &creator, 500, 1000);

    let result = client.try_vote(&proposal_id, &voter, &true);
    assert!(result.is_err());
}

#[test]
fn test_vote_after_end_time() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let current_time = env.ledger().timestamp();
    let payload = Bytes::from_slice(&env, b"ipfs://QmTest123");

    let proposal_id =
        client.create_proposal(&creator, &payload, &current_time, &(current_time + 10));

    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 100;
    });
    let result = client.try_vote(&proposal_id, &voter, &true);
    assert!(result.is_err());
}

#[test]
fn test_double_voting_prevention() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 1000);

    client.vote(&proposal_id, &voter, &true);

    let result = client.try_vote(&proposal_id, &voter, &false);
    assert!(result.is_err());
}

#[test]
fn test_vote_on_nonexistent_proposal() {
    let (env, client, admin, _, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    env.mock_all_auths();

    let result = client.try_vote(&999, &voter, &true);
    assert!(result.is_err());
}

#[test]
fn test_finalize_with_quorum_and_majority() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Cast 25 yes votes (25% participation, above 20% quorum)
    for _ in 0..25 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    // Cast 5 no votes (total 30% participation)
    for _ in 0..5 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &false);
    }

    // Advance time past end_time
    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    client.finalize(&proposal_id);

    let proposal = client.get_proposal(&proposal_id);
    assert!(proposal.executed);
}

#[test]
fn test_finalize_quorum_not_reached() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100); // 100 total voters, need 20 votes (20%)

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Cast only 15 votes (15% participation, below 20% quorum)
    for _ in 0..15 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    // Advance time past end_time
    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    // Finalize should fail due to quorum not reached
    let result = client.try_finalize(&proposal_id);
    assert!(result.is_err());
}

#[test]
fn test_finalize_majority_not_reached() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Cast 10 yes votes and 15 no votes (25% participation, quorum reached)
    for _ in 0..10 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    for _ in 0..15 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &false);
    }

    // Advance time past end_time
    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    // Finalize should succeed but proposal should not be executed (no majority)
    client.finalize(&proposal_id);

    let proposal = client.get_proposal(&proposal_id);
    assert!(!proposal.executed); // Rejected due to no majority
}

#[test]
fn test_finalize_before_end_time() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 1000);

    // Cast enough votes
    for _ in 0..25 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    // Try to finalize before end_time (should fail)
    let result = client.try_finalize(&proposal_id);
    assert!(result.is_err());
}

#[test]
fn test_finalize_already_executed() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Cast enough votes
    for _ in 0..25 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    // Advance time and finalize
    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    client.finalize(&proposal_id);

    // Try to finalize again (should fail)
    let result = client.try_finalize(&proposal_id);
    assert!(result.is_err());
}

#[test]
fn test_vote_on_executed_proposal() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Cast votes and finalize
    for _ in 0..25 {
        let voter = Address::generate(&env);
        env.mock_all_auths();
        client.vote(&proposal_id, &voter, &true);
    }

    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    client.finalize(&proposal_id);

    // Try to vote after finalization (should fail)
    let late_voter = Address::generate(&env);
    env.mock_all_auths();
    let result = client.try_vote(&proposal_id, &late_voter, &true);
    assert!(result.is_err());
}

#[test]
fn test_multiple_proposals() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    // Create multiple proposals
    let proposal_id_1 = create_test_proposal(&env, &client, &creator, 0, 1000);
    let proposal_id_2 = create_test_proposal(&env, &client, &creator, 0, 1000);
    let proposal_id_3 = create_test_proposal(&env, &client, &creator, 0, 1000);

    assert_eq!(proposal_id_1, 0);
    assert_eq!(proposal_id_2, 1);
    assert_eq!(proposal_id_3, 2);

    // Vote on different proposals
    let voter = Address::generate(&env);
    env.mock_all_auths();

    client.vote(&proposal_id_1, &voter, &true);
    client.vote(&proposal_id_2, &voter, &false);
    client.vote(&proposal_id_3, &voter, &true);

    // Verify votes are separate
    let prop1 = client.get_proposal(&proposal_id_1);
    let prop2 = client.get_proposal(&proposal_id_2);
    let prop3 = client.get_proposal(&proposal_id_3);

    assert_eq!(prop1.yes_votes, 1);
    assert_eq!(prop2.no_votes, 1);
    assert_eq!(prop3.yes_votes, 1);
}

#[test]
fn test_has_voted_helper() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    let voter = Address::generate(&env);
    let non_voter = Address::generate(&env);
    env.mock_all_auths();

    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 1000);

    // Before voting
    assert!(!client.has_voted(&proposal_id, &voter));

    // Vote
    client.vote(&proposal_id, &voter, &true);

    // After voting
    assert!(client.has_voted(&proposal_id, &voter));
    assert!(!client.has_voted(&proposal_id, &non_voter));
}

#[test]
fn test_token_weighted_voting_and_quorum_with_timelock() {
    let (env, client, admin, creator, _) = setup_test_env();
    initialize_contract(&client, &admin, 100);

    // Register governance token with admin as token holder
    let token_admin = admin.clone();
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let gov_token = token_id.address();

    // Configure governance token with a timelock delay
    client.configure_token(&admin, &gov_token, &60u64);

    // Mint tokens to admin and distribute to two voters
    let token_admin_client = StellarAssetClient::new(&env, &gov_token);
    token_admin_client.mint(&token_admin, &1_000i128);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let recipients = Vec::from_array(&env, [voter1.clone(), voter2.clone()]);
    let amounts = Vec::from_array(&env, [600_i128, 400_i128]);

    client.distribute_tokens(&admin, &recipients, &amounts);

    // Stake tokens for both voters
    env.mock_all_auths();
    client.stake(&voter1, &600_i128);
    client.stake(&voter2, &400_i128);

    let total_stake = client.get_total_stake();
    assert_eq!(total_stake, 1_000_i128);

    // Create a proposal that is immediately active
    let proposal_id = create_test_proposal(&env, &client, &creator, 0, 100);

    // Voter1 votes yes with weight 600, voter2 votes no with weight 400
    client.vote(&proposal_id, &voter1, &true);
    client.vote(&proposal_id, &voter2, &false);

    let proposal = client.get_proposal(&proposal_id);
    assert_eq!(proposal.yes_votes, 600_i128);
    assert_eq!(proposal.no_votes, 400_i128);

    // Move past end_time and finalize
    let current_time = env.ledger().timestamp();
    env.ledger().with_mut(|li| {
        li.timestamp = current_time + 200;
    });

    client.finalize(&proposal_id);

    let proposal = client.get_proposal(&proposal_id);
    assert!(proposal.executed);

    // Timelock should be recorded
    let timelock = client.get_proposal_timelock(&proposal_id).unwrap();
    assert!(timelock > current_time);
}
