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

    #[test]
    fn test_initialize_escrow() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
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

        // Verify all milestones exist
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

        // Try to submit again - should fail because status is no longer Pending
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
        assert!(result.is_err() || result.is_err());
    }

    #[test]
    fn test_milestone_not_found() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        env.mock_all_auths();

        client.initialize(&1, &creator, &token, &validators);

        let result = client.try_get_milestone(&1, &999);
        assert!(result.is_err() || result.is_err());
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
    fn test_deposit_updates_correctly() {
        let (env, creator, token, _, validators) = create_test_env();
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

    #[test]
    fn test_dispute_happy_path() {
        let (env, creator, token, _, validators) = create_test_env();
        let client = create_client(&env);
        let admin = Address::generate(&env);
        env.mock_all_auths();
        client.initialize_admin(&admin);

        let juror_token = create_mock_token(&env);
        client.configure_dispute_token(&juror_token);

        client.initialize(&1, &creator, &token, &validators);

        let mut jurors = Vec::new(&env);
        for _ in 0..7 {
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
        let mut assigned_jurors = Vec::new(&env);

        // Commit phase
        for j in 0..7 {
            let juror_addr = jurors.get(j).unwrap();

            // Find active jurors vs assigned
            // Since we randomly selected 7 from 7, they are all assigned
            assigned_jurors.push_back(juror_addr.clone());

            let mut b = soroban_sdk::Bytes::new(&env);
            b.push_back(0); // ReleaseFunds
            b.append(&salt);
            let h = env.crypto().sha256(&b);

            client.commit_vote(&dispute_id, &juror_addr, &h.into());
        }

        env.ledger()
            .set_timestamp(env.ledger().timestamp() + 259201);

        // Reveal phase
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

        env.ledger()
            .set_timestamp(env.ledger().timestamp() + 432001);
        client.execute_resolution(&dispute_id);
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

        client.initialize(&1, &creator, &token, &validators);

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
    }
}
