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

    // ====== NEW tests for Emergency Pause/Resume ======

    fn setup_with_admin(
        env: &Env,
    ) -> (Address, Address, Address, Vec<Address>, EscrowContractClient) {
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

    /// Default threshold used by all existing tests (67%).
    const DEFAULT_THRESHOLD: u32 = 6700;

    // ── existing tests (approval_threshold argument added to every initialize call) ──

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

    #[test]
    fn test_initialize_with_insufficient_validators() {
        let env = Env::default();
        let creator = Address::generate(&env);
        let token = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(Address::generate(&env));

        let client = create_client(&env);
        let result = client.try_initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        assert!(result.is_err());
    }

    #[test]
    fn test_initialize_duplicate_escrow() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        let result = client.try_initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
        assert!(result.is_err());
    }

    #[test]
    fn test_deposit_funds() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

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
        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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
        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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
        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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
        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        let result = client.try_get_milestone(&1, &999);
        assert!(result.is_err());
    }

    #[test]
    fn test_milestone_status_transitions() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);
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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

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

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        let escrow1 = client.get_escrow(&1);
        assert_eq!(escrow1.project_id, 1);
    }

    // ── NEW tests for Issue #39: Customizable Validator Thresholds ────────────

    #[test]
    fn test_initialize_with_low_threshold() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.try_initialize(&1, &creator, &token, &validators, &5000);
        assert!(result.is_err(), "threshold below 51% should be rejected");
    }

    #[test]
    fn test_initialize_with_threshold_above_100() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.try_initialize(&1, &creator, &token, &validators, &10100);
        assert!(result.is_err(), "threshold above 100% should be rejected");
    }

    #[test]
    fn test_minimum_valid_threshold_accepted() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.try_initialize(&1, &creator, &token, &validators, &5100);
        assert!(result.is_ok(), "5100 basis points (51%) should be accepted");
    }

    #[test]
    fn test_maximum_valid_threshold_accepted() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        let result = client.try_initialize(&1, &creator, &token, &validators, &10000);
        assert!(result.is_ok(), "10000 basis points (100%) should be accepted");
    }

    #[test]
    fn test_different_projects_have_independent_thresholds() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(Address::generate(&env));
        validators.push_back(Address::generate(&env));
        validators.push_back(Address::generate(&env));

        let client = create_client(&env);

        client.initialize(&1, &creator, &token, &validators, &6700);
        client.initialize(&2, &creator, &token, &validators, &10000);

        assert_eq!(client.get_escrow(&1).approval_threshold, 6700);
        assert_eq!(client.get_escrow(&2).approval_threshold, 10000);
    }

    /// 100% unanimous threshold — all 3 validators must approve.
    /// Votes 1 and 2 must leave milestone as Submitted; vote 3 triggers Approved.
    #[test]
    fn test_custom_threshold_enforced_unanimous() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let v3 = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(v1.clone());
        validators.push_back(v2.clone());
        validators.push_back(v3.clone());

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&contract_id, &1000);

        client.initialize(&1, &creator, &token, &validators, &10000);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        client.vote_milestone(&1, &0, &v1, &true);
        assert_eq!(
            client.get_milestone(&1, &0).status,
            MilestoneStatus::Submitted,
            "one approval should not be enough with unanimous threshold"
        );

        client.vote_milestone(&1, &0, &v2, &true);
        assert_eq!(
            client.get_milestone(&1, &0).status,
            MilestoneStatus::Submitted,
            "two approvals should not be enough with unanimous threshold"
        );

        client.vote_milestone(&1, &0, &v3, &true);
        assert_eq!(
            client.get_milestone(&1, &0).status,
            MilestoneStatus::Approved,
            "all three approvals should trigger approval with unanimous threshold"
        );
    }

    /// 67% threshold — 2 out of 3 validators are required.
    /// (3 * 6700) / 10000 = 2 (integer division).
    /// Vote 1 must leave milestone as Submitted; vote 2 triggers Approved.
    #[test]
    fn test_majority_threshold_enforced() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();

        let creator = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(token_admin.clone())
            .address();

        let v1 = Address::generate(&env);
        let v2 = Address::generate(&env);
        let v3 = Address::generate(&env);

        let mut validators = Vec::new(&env);
        validators.push_back(v1.clone());
        validators.push_back(v2.clone());
        validators.push_back(v3.clone());

        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&contract_id, &1000);

        client.initialize(&1, &creator, &token, &validators, &6700);
        client.deposit(&1, &1000);

        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        client.vote_milestone(&1, &0, &v1, &true);
        assert_eq!(
            client.get_milestone(&1, &0).status,
            MilestoneStatus::Submitted,
            "one approval should not meet the 67% threshold with 3 validators"
        );

        client.vote_milestone(&1, &0, &v2, &true);
        assert_eq!(
            client.get_milestone(&1, &0).status,
            MilestoneStatus::Approved,
            "two approvals should meet the 67% threshold with 3 validators"
        );
    }


    // ====== NEW tests for Emergency Pause/Resume ======
    #[test]
    fn test_is_paused_defaults_to_false() {
        let env = Env::default();
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

        client.deposit(&1, &1000); // deposit before pausing
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

        // Try to resume only 1 hour later — well within the 24hr lock
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

        // Advance time past the 24hr delay
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

        // deposit should work again
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

    // ---------- Upgrade (time-lock, requires pause) ----------
    #[test]
    fn test_schedule_upgrade_succeeds() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        let wasm_hash = BytesN::from_array(&env, &[42u8; 32]);
        let result = client.try_schedule_upgrade(&admin, &wasm_hash);
        assert!(result.is_ok());

        let pending = client.get_pending_upgrade();
        assert!(pending.is_some());
        let p = pending.unwrap();
        assert_eq!(p.wasm_hash, wasm_hash);
        assert_eq!(p.execute_not_before, 1000 + shared::UPGRADE_TIME_LOCK_SECS);
    }

    #[test]
    fn test_execute_upgrade_too_early_fails() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        let wasm_hash = BytesN::from_array(&env, &[42u8; 32]);
        client.schedule_upgrade(&admin, &wasm_hash);
        client.pause(&admin);

        // Only 1 hour later — before 48h time-lock
        env.ledger().set_timestamp(1000 + 3600);
        let result = client.try_execute_upgrade(&admin);
        assert!(result.is_err(), "execute_upgrade should fail before 48h");
    }

    #[test]
    fn test_execute_upgrade_without_pause_fails() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        let wasm_hash = BytesN::from_array(&env, &[42u8; 32]);
        client.schedule_upgrade(&admin, &wasm_hash);

        env.ledger().set_timestamp(1000 + shared::UPGRADE_TIME_LOCK_SECS + 1);
        let result = client.try_execute_upgrade(&admin);
        assert!(result.is_err(), "execute_upgrade should fail when not paused");
    }

    #[test]
    fn test_cancel_upgrade_clears_pending() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (admin, _, _, _, client) = setup_with_admin(&env);

        let wasm_hash = BytesN::from_array(&env, &[42u8; 32]);
        client.schedule_upgrade(&admin, &wasm_hash);
        assert!(client.get_pending_upgrade().is_some());

        client.cancel_upgrade(&admin);
        assert!(client.get_pending_upgrade().is_none());
    }

    #[test]
    fn test_only_admin_can_schedule_upgrade() {
        let env = Env::default();
        env.ledger().set_timestamp(1000);
        env.mock_all_auths();
        let (_, _, _, _, client) = setup_with_admin(&env);

        let wasm_hash = BytesN::from_array(&env, &[42u8; 32]);
        let random = Address::generate(&env);
        let result = client.try_schedule_upgrade(&random, &wasm_hash);
        assert!(result.is_err());
    }
}
