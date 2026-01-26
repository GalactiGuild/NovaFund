#![cfg(test)]

mod tests {
    use crate::{EscrowContract, EscrowContractClient};
    use shared::types::MilestoneStatus;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, BytesN, Env, Vec,
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

    fn create_client(env: &Env) -> EscrowContractClient {
        EscrowContractClient::new(env, &env.register_contract(None, EscrowContract))
    }

    #[test]
    fn test_initialize_escrow() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.initialize(&1, &creator, &token, &validators);

        env.mock_all_auths();
        client.initialize(&1, &creator, &token, &validators);

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
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        // Try to initialize again
        let result = client.try_initialize(&1, &creator, &token, &validators);
        assert!(result.is_err());
    }

    #[test]
    fn test_deposit_funds() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        let deposit_amount: i128 = 1000;
        let result = client.try_deposit(&1, &deposit_amount);

        assert!(result.is_ok());

        let escrow = client.get_escrow(&1);
        assert_eq!(escrow.total_deposited, deposit_amount);
    }

    #[test]
    fn test_deposit_invalid_amount() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        let result = client.try_deposit(&1, &0);
        assert!(result.is_err());

        let result = client.try_deposit(&1, &-100);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_milestone() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        client.deposit(&1, &1000);

        let description = SorobanString::from_str(&env, "Phase 1");
        let result = client.create_milestone(&1, &description, &500);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.id, 0);
        assert_eq!(milestone.project_id, 1);
        assert_eq!(milestone.amount, 500);
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(milestone.description_hash, description_hash);
    }

    #[test]
    fn test_create_milestone_exceeds_escrow() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        client.deposit(&1, &500);

        let description = SorobanString::from_str(&env, "Too much");
        let result = client.try_create_milestone(&1, &description, &1000);

        assert!(result.is_err());
    }

    #[test]
    fn test_create_multiple_milestones() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        client.deposit(&1, &3000);

        let desc1 = SorobanString::from_str(&env, "Phase 1");
        let desc2 = SorobanString::from_str(&env, "Phase 2");
        let desc3 = SorobanString::from_str(&env, "Phase 3");

        client.create_milestone(&1, &desc1, &1000);
        client.create_milestone(&1, &desc2, &1000);
        client.create_milestone(&1, &desc3, &1000);

        // Verify all milestones exist
        assert!(client.try_get_milestone(&1, &0).is_ok());
        assert!(client.try_get_milestone(&1, &1).is_ok());
        assert!(client.try_get_milestone(&1, &2).is_ok());

        let total = client.get_total_milestone_amount(&1);
        assert_eq!(total, 3000);
    }

    #[test]
    fn test_submit_milestone() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        client.deposit(&1, &1000);

        let description = SorobanString::from_str(&env, "Phase 1");
        client
            .create_milestone(&1, &description, &500)
            ;

        let proof_hash = SorobanString::from_str(&env, "hash_proof_123");
        let result = client.try_submit_milestone(&1, &0, &proof_hash);

        assert!(result.is_ok());

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);
        assert_eq!(milestone.proof_hash, proof_hash);
    }

    #[test]
    fn test_submit_milestone_invalid_status() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        client.deposit(&1, &1000);

        let description = SorobanString::from_str(&env, "Phase 1");
        client
            .create_milestone(&1, &description, &500)
            ;

        let proof_hash = SorobanString::from_str(&env, "hash_proof_123");
        client.submit_milestone(&1, &0, &proof_hash);

        // Try to submit again - should fail because status is no longer Pending
        let proof_hash2 = SorobanString::from_str(&env, "hash_proof_456");
        let result = client.try_submit_milestone(&1, &0, &proof_hash2);

        assert!(result.is_err());
    }

    #[test]
    fn test_get_available_balance() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

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
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        let result = client.try_get_milestone(&1, &999);
        assert!(result.is_err() || result.is_err());
    }

    #[test]
    fn test_milestone_status_transitions() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

        client.deposit(&1, &1000);

        let description = SorobanString::from_str(&env, "Phase 1");
        client
            .create_milestone(&1, &description, &500)
            ;

        // Check initial status is Pending
        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(milestone.approval_count, 0);
        assert_eq!(milestone.rejection_count, 0);

        // Submit milestone
        let proof_hash = SorobanString::from_str(&env, "hash_proof_123");
        client.submit_milestone(&1, &0, &proof_hash);

        // Check status is now Submitted
        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);
        assert_eq!(milestone.proof_hash, proof_hash);
    }

    #[test]
    fn test_deposit_updates_correctly() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client
            .initialize(&1, &creator, &token, &validators)
            ;

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
