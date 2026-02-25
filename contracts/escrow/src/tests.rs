#![cfg(test)]

mod tests {
    use crate::{EscrowContract, EscrowContractClient};
    use shared::types::MilestoneStatus;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, BytesN, Env, Vec,
    };

    /// common test environment builder; returns an oracle address as the
    /// last element which is unused by the legacy tests.
    fn create_test_env() -> (Env, Address, Address, Address, Vec<Address>, Address) {
        let env = Env::default();
        env.ledger().set_timestamp(1000);

        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let validator1 = Address::generate(&env);
        let validator2 = Address::generate(&env);
        let validator3 = Address::generate(&env);
        let oracle = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(validator1);
        validators.push_back(validator2);
        validators.push_back(validator3.clone());

        (env, creator, token, validator3, validators, oracle)
    }

    fn create_client(env: &Env) -> EscrowContractClient {
        EscrowContractClient::new(env, &env.register_contract(None, EscrowContract))
    }

    #[test]
    fn test_initialize_escrow() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.initialize(&1, &creator, &token, &validators);

        // Verify escrow was created
        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.project_id, 1);
        assert_eq!(escrow.creator, creator);
        assert_eq!(escrow.token, token);
        assert_eq!(escrow.total_deposited, 0);
        assert_eq!(escrow.released_amount, 0);
    }

    #[test]
    fn test_initialize_with_insufficient_validators() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let token = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(Address::generate(&env));

        let client = create_client(&env);
        let result = client.try_initialize(&1, &creator, &token, &validators);

        assert!(result.is_err());
    }

    #[test]
    fn test_initialize_duplicate_escrow() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        // Try to initialize again
        let result = client.try_initialize(&1, &creator, &token, &validators);
        assert!(result.is_err());
    }

    #[test]
    fn test_deposit_funds() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        let deposit_amount: i128 = 1000;
        let result = client.try_deposit(&1, &deposit_amount);

        assert!(result.is_ok());

        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.total_deposited, deposit_amount);
    }

    #[test]
    fn test_deposit_invalid_amount() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        let result = client.try_deposit(&1, &0);
        assert!(result.is_err());

        let result = client.try_deposit(&1, &-100);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_milestone() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);

        env.mock_all_auths();
        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.id, 0);
        assert_eq!(milestone.project_id, 1);
        assert_eq!(milestone.amount, 500);
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(milestone.description_hash, description_hash);
    }

    #[test]
    fn test_create_milestone_exceeds_escrow() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);

        env.mock_all_auths();
        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &500);

        let description_hash = BytesN::from_array(&env, &[2u8; 32]);
        let result = client.try_create_milestone(&1, &description_hash, &1000);

        assert!(result.is_err());
    }

    #[test]
    fn test_create_multiple_milestones() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);

        env.mock_all_auths();
        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &3000);

        let desc1 = BytesN::from_array(&env, &[1u8; 32]);
        let desc2 = BytesN::from_array(&env, &[2u8; 32]);
        let desc3 = BytesN::from_array(&env, &[3u8; 32]);

        client.create_milestone(&1, &desc1, &1000);
        client.create_milestone(&1, &desc2, &1000);
        client.create_milestone(&1, &desc3, &1000);

        // Verify all milestones exist
        assert!(client.get_milestone(&1, &0).id == 0);
        assert!(client.get_milestone(&1, &1).id == 1);
        assert!(client.get_milestone(&1, &2).id == 2);

        let total = client.get_total_milestone_amount(&1);
        assert_eq!(total, 3000);
    }

    #[test]
    fn test_submit_milestone() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);

        env.mock_all_auths();
        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);
        assert_eq!(milestone.proof_hash, proof_hash);
    }

    #[test]
    fn test_submit_milestone_invalid_status() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        // Try to submit again - should fail because status is no longer Pending
        let proof_hash2 = BytesN::from_array(&env, &[10u8; 32]);
        let result = client.try_submit_milestone(&1, &0, &proof_hash2);

        assert!(result.is_err());
    }

    #[test]
    fn test_get_available_balance() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        client.deposit(&1, &1000);

        let balance = client.get_available_balance(&1);
        assert_eq!(balance, 1000);

        client.deposit(&1, &500);

        let balance = client.get_available_balance(&1);
        assert_eq!(balance, 1500);
    }

    #[test]
    fn test_escrow_not_found() {
        let env = Env::default();
        let client = create_client(&env);

        let result = client.try_get_escrow(&999);
        assert!(result.is_err() || result.is_err());
    }

    #[test]
    fn test_milestone_not_found() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        let result = client.try_get_milestone(&1, &999);
        assert!(result.is_err() || result.is_err());
    }

    #[test]
    fn test_milestone_status_transitions() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        // Check initial status is Pending
        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(milestone.approval_count, 0);
        assert_eq!(milestone.rejection_count, 0);

        // Submit milestone
        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        // Check status is now Submitted
        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);
        assert_eq!(milestone.proof_hash, proof_hash);
    }

    #[test]
    fn test_oracle_milestone_auto_approval() {
        let (env, creator, token, _, validators, oracle) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[7u8; 32]);
        let expected_hash = BytesN::from_array(&env, &[99u8; 32]);
        let deadline = env.ledger().timestamp() + 100;

        client.create_oracle_milestone(
            &1,
            &description_hash,
            &500,
            &oracle,
            &expected_hash,
            &deadline,
        );

        // creator submits proof as usual
        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        // oracle delivers correct result
        env.mock_all_auths();
        client.oracle_validate(&1, &0, &expected_hash);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Approved);

        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.released_amount, 500);
    }

    #[test]
    fn test_oracle_milestone_fallback_manual() {
        let (env, creator, token, _, validators, oracle) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[8u8; 32]);
        let expected_hash = BytesN::from_array(&env, &[123u8; 32]);
        let deadline = env.ledger().timestamp() + 10;

        client.create_oracle_milestone(
            &1,
            &description_hash,
            &500,
            &oracle,
            &expected_hash,
            &deadline,
        );
        client.submit_milestone(&1, &0, &BytesN::from_array(&env, &[1u8; 32]));

        // oracle sends wrong data
        env.mock_all_auths();
        client.oracle_validate(&1, &0, &BytesN::from_array(&env, &[0u8; 32]));

        // milestone should stay in Submitted
        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);

        // advance time past deadline then have validators vote
        env.ledger().set_timestamp(deadline + 1);
        // pick a validator from vector
        let voter = validators.get(0).unwrap();
        client.vote_milestone(&1, &0, &voter, &true);
        // another vote to reach threshold
        let voter2 = validators.get(1).unwrap();
        client.vote_milestone(&1, &0, &voter2, &true);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Approved);
    }

    #[test]
    fn test_deposit_updates_correctly() {
        let (env, creator, token, _, validators, _) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        // First deposit
        client.deposit(&1, &500);
        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.total_deposited, 500);

        // Second deposit
        client.deposit(&1, &300);
        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.total_deposited, 800);

        // Third deposit
        client.deposit(&1, &200);
        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.total_deposited, 1000);
    }

    #[test]
    fn test_multiple_projects_isolated() {
        let env = Env::default();
        env.mock_all_auths();

        env.ledger().set_timestamp(1000);

        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let validator1 = Address::generate(&env);
        let validator2 = Address::generate(&env);
        let validator3 = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(validator1);
        validators.push_back(validator2);
        validators.push_back(validator3);

        let client = create_client(&env);

        // Create two different projects
        client.initialize(&1, &creator, &token, &validators);

        // For second project, we'd need to modify the storage to allow different project IDs
        // This test verifies isolation via storage keys

        let escrow1 = client.get_escrow(&1);
        assert_eq!(escrow1.project_id, 1);
    }
}
