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

    fn create_client(env: &Env) -> EscrowContractClient<'_> {
        EscrowContractClient::new(env, &env.register_contract(None, EscrowContract))
    }

    // ======== NEW tests for Emergency Pause/Resume ========

    /// Helper: sets up an env with an admin registered and one escrow initialized.
    fn setup_with_admin(
        env: &Env,
    ) -> (Address, Address, Address, Vec<Address>, EscrowContractClient<'_>) {
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
        client.initialize(&1, &creator, &token, &validators);

        (admin, creator, token, validators, client)
    }


    #[test]
    fn test_initialize_escrow() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

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

        let result = client.try_initialize(&1, &creator, &token, &validators);
        assert!(result.is_err());
    }

    #[test]
    fn test_deposit_funds() {
        let (env, creator, token, _, validators) = create_test_env();
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
        let (env, creator, token, _, validators) = create_test_env();
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
        let (env, creator, token, _, validators) = create_test_env();
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
        let (env, creator, token, _, validators) = create_test_env();
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
        let (env, creator, token, _, validators) = create_test_env();
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

        assert!(client.get_milestone(&1, &0).id == 0);
        assert!(client.get_milestone(&1, &1).id == 1);
        assert!(client.get_milestone(&1, &2).id == 2);

        let total = client.get_total_milestone_amount(&1);
        assert_eq!(total, 3000);
    }

    #[test]
    fn test_submit_milestone() {
        let (env, creator, token, _, validators) = create_test_env();
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
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        let proof_hash2 = BytesN::from_array(&env, &[10u8; 32]);
        let result = client.try_submit_milestone(&1, &0, &proof_hash2);

        assert!(result.is_err());
    }

    #[test]
    fn test_get_available_balance() {
        let (env, creator, token, _, validators) = create_test_env();
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
        assert!(result.is_err());
    }

    #[test]
    fn test_milestone_not_found() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        let result = client.try_get_milestone(&1, &999);
        assert!(result.is_err());
    }

    #[test]
    fn test_milestone_status_transitions() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Pending);
        assert_eq!(milestone.approval_count, 0);
        assert_eq!(milestone.rejection_count, 0);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        let milestone = client.get_milestone(&1, &0);
        assert_eq!(milestone.status, MilestoneStatus::Submitted);
        assert_eq!(milestone.proof_hash, proof_hash);
    }

    #[test]
    fn test_deposit_updates_correctly() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        client.deposit(&1, &500);
        assert_eq!(client.get_escrow(&1).total_deposited, 500);

        client.deposit(&1, &300);
        assert_eq!(client.get_escrow(&1).total_deposited, 800);

        client.deposit(&1, &200);
        assert_eq!(client.get_escrow(&1).total_deposited, 1000);
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

        client.initialize(&1, &creator, &token, &validators);

        let escrow1 = client.get_escrow(&1);
        assert_eq!(escrow1.project_id, 1);
    }

    // ======== NEW tests for Emergency Pause/Resume ========
    
    #[test]
    fn test_is_paused_defaults_to_false() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (_, _, _, _, client) = setup_with_admin(&env);

        assert!(!client.get_is_paused());
    }

    #[test]
    fn test_pause_sets_paused_state() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);
        assert!(client.get_is_paused());
    }

    #[test]
    fn test_pause_blocks_deposit() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);

        let result = client.try_deposit(&1, &500);
        assert!(result.is_err(), "deposit should be blocked when paused");
    }

    #[test]
    fn test_pause_blocks_create_milestone() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.deposit(&1, &1000);
        client.pause(&admin);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        let result = client.try_create_milestone(&1, &description_hash, &500);
        assert!(result.is_err(), "create_milestone should be blocked when paused");
    }

    #[test]
    fn test_pause_blocks_submit_milestone() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.deposit(&1, &1000);
        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);
        client.pause(&admin);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        let result = client.try_submit_milestone(&1, &0, &proof_hash);
        assert!(result.is_err(), "submit_milestone should be blocked when paused");
    }

    #[test]
    fn test_pause_blocks_vote_milestone() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, validators, client) = setup_with_admin(&env);

        client.deposit(&1, &1000);
        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);
        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);
        client.pause(&admin);

        let voter = validators.get(0).unwrap();
        let result = client.try_vote_milestone(&1, &0, &voter, &true);
        assert!(result.is_err(), "vote_milestone should be blocked when paused");
    }

    #[test]
    fn test_resume_before_time_delay_fails() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);

        // Only 1 hour later — within the 24hr lock
        env.ledger().set_timestamp(1000 + 3600);
        let result = client.try_resume(&admin);
        assert!(result.is_err(), "resume should fail before time delay expires");
    }

    #[test]
    fn test_resume_after_time_delay_succeeds() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);

        // Advance past the 24hr delay
        env.ledger().set_timestamp(1000 + 86400 + 1);
        let result = client.try_resume(&admin);
        assert!(result.is_ok(), "resume should succeed after time delay");
        assert!(!client.get_is_paused());
    }

    #[test]
    fn test_operations_work_after_resume() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);
        env.ledger().set_timestamp(1000 + 86400 + 1);
        client.resume(&admin);

        let result = client.try_deposit(&1, &500);
        assert!(result.is_ok(), "deposit should work after resume");
    }

    #[test]
    fn test_only_admin_can_pause() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (_, _, _, _, client) = setup_with_admin(&env);

        let random = Address::generate(&env);
        let result = client.try_pause(&random);
        assert!(result.is_err(), "non-admin should not be able to pause");
    }

    #[test]
    fn test_only_admin_can_resume() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        client.pause(&admin);
        env.ledger().set_timestamp(1000 + 86400 + 1);

        let random = Address::generate(&env);
        let result = client.try_resume(&random);
        assert!(result.is_err(), "non-admin should not be able to resume");
    }
}