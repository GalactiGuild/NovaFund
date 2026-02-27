#![cfg(test)]

mod tests {
    use crate::{EscrowContract, EscrowContractClient};
    use shared::types::{DisputeResolution, MilestoneStatus};
    use soroban_sdk::{
        contract, contractimpl,
        testutils::{Address as _, Ledger},
        Address, BytesN, Env, Vec,
    };

    #[contract]
    pub struct MockToken;

    #[contractimpl]
    impl MockToken {
        pub fn transfer(_env: Env, _from: Address, _to: Address, _amount: i128) {}
    }

    fn create_mock_token(env: &Env) -> Address {
        env.register_contract(None, MockToken)
    }

    fn create_test_env() -> (Env, Address, Address, Address, Vec<Address>) {
        let env = Env::default();
        env.ledger().set_timestamp(1000);

        let creator = Address::generate(&env);
        let token = create_mock_token(&env);
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

    #[test]
    fn test_juror_registration() {
        let (env, _, _, _, _) = create_test_env();
        let client = create_client(&env);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize_admin(&admin);

        let juror_token = create_mock_token(&env);
        client.configure_dispute_token(&juror_token);

        let juror = Address::generate(&env);
        let stake: i128 = 500_0000000;

        client.register_as_juror(&juror, &stake);
        assert!(client.try_register_as_juror(&juror, &stake).is_err());

        client.deregister_as_juror(&juror);
        assert!(client.try_deregister_as_juror(&juror).is_err());
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

    #[test]
    fn test_dispute_happy_path() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize_admin(&admin);

        let juror_token = create_mock_token(&env);
        client.configure_dispute_token(&juror_token);

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        let v1 = validators.get(0).unwrap();
        let v2 = validators.get(1).unwrap();
        let v3 = validators.get(2).unwrap();

        let mut jurors = Vec::new(&env);
        for _ in 0..7 {
            let j = Address::generate(&env);
            client.register_as_juror(&j, &500_0000000);
            jurors.push_back(j);
        }

        client.deposit(&1, &1000);
        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

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

    #[test]
    fn test_dispute_appeals_path() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize_admin(&admin);

        let juror_token = create_mock_token(&env);
        client.configure_dispute_token(&juror_token);

        client.initialize(&1, &creator, &token, &validators, &DEFAULT_THRESHOLD);

        let v1 = validators.get(0).unwrap();
        let v2 = validators.get(1).unwrap();

        let mut jurors = Vec::new(&env);
        for _ in 0..20 {
            let j = Address::generate(&env);
            client.register_as_juror(&j, &500_0000000);
            jurors.push_back(j);
        }

        client.deposit(&1, &1000);
        let description_hash = BytesN::from_array(&env, &[1u8; 32]);
        client.create_milestone(&1, &description_hash, &500);

        let proof_hash = BytesN::from_array(&env, &[9u8; 32]);
        client.submit_milestone(&1, &0, &proof_hash);

        client.vote_milestone(&1, &0, &validators.get(0).unwrap(), &false);
        client.vote_milestone(&1, &0, &validators.get(1).unwrap(), &false);

        let project_contract = Address::generate(&env);
        let dispute_id = client.initiate_dispute(&1, &0, &creator, &project_contract);

        client.select_jury(&dispute_id);

        let mut salt_buf = [0u8; 32];
        for i in 0..32 {
            salt_buf[i] = 123;
        }
        let salt = soroban_sdk::Bytes::from_array(&env, &salt_buf);

        let assigned_jurors = client.get_juror_assignments(&dispute_id);
        for i in 0..7 {
            let juror_addr = assigned_jurors.get(i).unwrap();

            let mut b = soroban_sdk::Bytes::new(&env);
            b.push_back(0); // ReleaseFunds
            b.append(&salt);
            let h = env.crypto().sha256(&b);

            client.commit_vote(&dispute_id, &juror_addr, &h.into());
        }

        env.ledger()
            .set_timestamp(env.ledger().timestamp() + 259201);

        for j in 0..7 {
            let juror_addr = assigned_jurors.get(j).unwrap();
            client.reveal_vote(
                &dispute_id,
                &juror_addr,
                &DisputeResolution::RelFunds,
                &0,
                &salt,
            );
        }

        env.ledger()
            .set_timestamp(env.ledger().timestamp() + 172801);
        client.tally_votes(&dispute_id);

        // File appeal
        let appellant = Address::generate(&env);
        client.file_appeal(&dispute_id, &appellant);

        // We can do another commit-reveal phase for the 13 jurors
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
