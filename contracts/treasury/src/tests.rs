#[cfg(test)]
mod tests {
    use crate::{TreasuryContract, TreasuryContractClient};
    use soroban_sdk::{
        testutils::{Address as _},
        token::StellarAssetClient,
        Address, Bytes, Env, Vec,
    };

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn setup(
        env: &Env,
    ) -> (
        TreasuryContractClient<'static>,
        Address, // admin (governance)
        Address, // xlm token
        Address, // usdc token
    ) {
        let contract_id = env.register_contract(None, TreasuryContract);
        let client = TreasuryContractClient::new(env, &contract_id);

        let admin = Address::generate(env);

        let xlm_issuer = Address::generate(env);
        let usdc_issuer = Address::generate(env);

        let xlm_id = env.register_stellar_asset_contract_v2(xlm_issuer.clone());
        let usdc_id = env.register_stellar_asset_contract_v2(usdc_issuer.clone());

        let xlm = xlm_id.address();
        let usdc = usdc_id.address();

        env.mock_all_auths();

        let tokens = Vec::from_array(env, [xlm.clone(), usdc.clone()]);
        client.initialize(&admin, &tokens);

        (client, admin, xlm, usdc)
    }

    fn mint(env: &Env, token: &Address, to: &Address, amount: i128) {
        let issuer = StellarAssetClient::new(env, token);
        issuer.mint(to, &amount);
    }

    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    #[test]
    fn test_initialize_ok() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);

        assert_eq!(client.admin(), admin);
        let tokens = client.supported_tokens();
        assert!(tokens.contains(&xlm));
    }

    #[test]
    fn test_initialize_rejects_reinit() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        env.mock_all_auths();
        let tokens = Vec::from_array(&env, [xlm]);
        assert!(client.try_initialize(&admin, &tokens).is_err());
    }

    #[test]
    fn test_initialize_rejects_empty_tokens() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, TreasuryContract);
        let client = TreasuryContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let empty: Vec<Address> = Vec::new(&env);
        assert!(client.try_initialize(&admin, &empty).is_err());
    }

    // -----------------------------------------------------------------------
    // Deposits
    // -----------------------------------------------------------------------

    #[test]
    fn test_deposit_ok() {
        let env = Env::default();
        let (client, _, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 1_000_000_000);
        client.deposit(&depositor, &xlm, &500_000_000_i128);

        assert_eq!(client.balance(&xlm), 500_000_000);
    }

    #[test]
    fn test_deposit_rejects_zero_amount() {
        let env = Env::default();
        let (client, _, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        env.mock_all_auths();
        assert!(client.try_deposit(&depositor, &xlm, &0_i128).is_err());
    }

    #[test]
    fn test_deposit_rejects_unsupported_token() {
        let env = Env::default();
        let (client, _, _, _) = setup(&env);
        let depositor = Address::generate(&env);
        let rando_issuer = Address::generate(&env);
        let rando_id = env.register_stellar_asset_contract_v2(rando_issuer.clone());
        let rando = rando_id.address();
        env.mock_all_auths();
        mint(&env, &rando, &depositor, 1_000_000_000);
        assert!(client.try_deposit(&depositor, &rando, &100_i128).is_err());
    }

    // -----------------------------------------------------------------------
    // Withdrawals
    // -----------------------------------------------------------------------

    #[test]
    fn test_withdraw_ok() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 1_000_000_000);
        client.deposit(&depositor, &xlm, &1_000_000_000_i128);

        let memo = Bytes::from_slice(&env, b"ipfs://QmGrant1");
        let wid = client.withdraw(&admin, &42_u64, &xlm, &recipient, &300_000_000_i128, &memo);

        assert_eq!(wid, 0);
        assert_eq!(client.balance(&xlm), 700_000_000);
        assert_eq!(client.withdrawal_count(), 1);

        let record = client.get_withdrawal(&0_u64);
        assert_eq!(record.proposal_id, 42);
        assert_eq!(record.amount, 300_000_000);
        assert_eq!(record.recipient, recipient);
    }

    #[test]
    fn test_withdraw_rejects_non_admin() {
        let env = Env::default();
        let (client, _, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        let attacker = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 1_000_000_000);
        client.deposit(&depositor, &xlm, &1_000_000_000_i128);

        let memo = Bytes::from_slice(&env, b"hack");
        assert!(client
            .try_withdraw(&attacker, &1_u64, &xlm, &attacker, &500_000_000_i128, &memo)
            .is_err());
    }

    #[test]
    fn test_withdraw_replay_guard() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 2_000_000_000);
        client.deposit(&depositor, &xlm, &2_000_000_000_i128);

        let memo = Bytes::from_slice(&env, b"grant");
        client.withdraw(&admin, &7_u64, &xlm, &recipient, &100_000_000_i128, &memo);

        // Same proposal_id must be rejected
        assert!(client
            .try_withdraw(&admin, &7_u64, &xlm, &recipient, &100_000_000_i128, &memo)
            .is_err());

        assert!(client.is_proposal_used(&7_u64));
    }

    #[test]
    fn test_withdraw_insufficient_funds() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 100_000_000);
        client.deposit(&depositor, &xlm, &100_000_000_i128);

        let memo = Bytes::from_slice(&env, b"too-much");
        assert!(client
            .try_withdraw(&admin, &99_u64, &xlm, &recipient, &999_000_000_i128, &memo)
            .is_err());
    }

    #[test]
    fn test_withdraw_empty_memo_rejected() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 1_000_000_000);
        client.deposit(&depositor, &xlm, &1_000_000_000_i128);

        let empty_memo = Bytes::new(&env);
        assert!(client
            .try_withdraw(&admin, &5_u64, &xlm, &recipient, &100_000_000_i128, &empty_memo)
            .is_err());
    }

    // -----------------------------------------------------------------------
    // Multi-token
    // -----------------------------------------------------------------------

    #[test]
    fn test_multi_token_balances() {
        let env = Env::default();
        let (client, admin, xlm, usdc) = setup(&env);
        let depositor = Address::generate(&env);
        let recipient = Address::generate(&env);
        env.mock_all_auths();

        mint(&env, &xlm, &depositor, 1_000_000_000);
        mint(&env, &usdc, &depositor, 500_000_000);

        client.deposit(&depositor, &xlm, &1_000_000_000_i128);
        client.deposit(&depositor, &usdc, &500_000_000_i128);

        assert_eq!(client.balance(&xlm), 1_000_000_000);
        assert_eq!(client.balance(&usdc), 500_000_000);

        let memo = Bytes::from_slice(&env, b"ops");
        client.withdraw(&admin, &1_u64, &usdc, &recipient, &200_000_000_i128, &memo);

        assert_eq!(client.balance(&usdc), 300_000_000);
        assert_eq!(client.balance(&xlm), 1_000_000_000); // untouched
    }

    // -----------------------------------------------------------------------
    // Admin management
    // -----------------------------------------------------------------------

    #[test]
    fn test_set_admin() {
        let env = Env::default();
        let (client, admin, xlm, _) = setup(&env);
        let new_admin = Address::generate(&env);
        env.mock_all_auths();

        client.set_admin(&new_admin);
        assert_eq!(client.admin(), new_admin);

        // Old admin can no longer withdraw
        let recipient = Address::generate(&env);
        mint(&env, &xlm, &admin, 1_000_000_000);
        client.deposit(&admin, &xlm, &1_000_000_000_i128);
        let memo = Bytes::from_slice(&env, b"test");
        assert!(client
            .try_withdraw(&admin, &20_u64, &xlm, &recipient, &100_000_000_i128, &memo)
            .is_err());
    }

    #[test]
    fn test_add_token() {
        let env = Env::default();
        let (client, _admin, _, _) = setup(&env);
        let new_issuer = Address::generate(&env);
        let new_id = env.register_stellar_asset_contract_v2(new_issuer.clone());
        let new_token = new_id.address();
        env.mock_all_auths();

        client.add_token(&new_token);

        let tokens = client.supported_tokens();
        assert!(tokens.contains(&new_token));

        // Idempotent – adding again should not error
        client.add_token(&new_token);
        let tokens2 = client.supported_tokens();
        // Verify no duplicates were added
        let mut count = 0u32;
        for i in 0..tokens2.len() {
            if tokens2.get(i).unwrap() == new_token {
                count += 1;
            }
        }
        assert_eq!(count, 1);
    }
}
