#[cfg(test)]
mod tests {
    use crate::{AutoInvestPool, AutoInvestPoolClient, Error, RiskLevel, SECONDS_PER_MONTH};
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{symbol_short, token, Address, Env, Symbol, Vec};

    // Mock project contract
    #[soroban_sdk::contract]
    pub struct MockProject;

    #[soroban_sdk::contractimpl]
    impl MockProject {
        pub fn invest(env: Env, investor: Address, amount: i128) {
            // Just emit an event for testing
            env.events()
                .publish((symbol_short!("invested"),), (investor, amount));
        }
    }

    struct TestContext {
        env: Env,
        admin: Address,
        user: Address,
        token: token::Client<'static>,
        token_admin: token::StellarAssetClient<'static>,
        contract: AutoInvestPoolClient<'static>,
    }

    impl TestContext {
        fn setup() -> Self {
            let env = Env::default();
            env.mock_all_auths();

            let admin = Address::generate(&env);
            let user = Address::generate(&env);

            let token_address = env
                .register_stellar_asset_contract_v2(admin.clone())
                .address();
            let token = token::Client::new(&env, &token_address);
            let token_admin = token::StellarAssetClient::new(&env, &token_address);

            let contract_id = env.register_contract(None, AutoInvestPool);
            let contract = AutoInvestPoolClient::new(&env, &contract_id);

            contract.initialize(&admin);
            token_admin.mint(&user, &1_000_000);

            TestContext {
                env,
                admin,
                user,
                token,
                token_admin,
                contract,
            }
        }

        fn register_mock_project(
            &self,
            risk: RiskLevel,
            tags: Vec<Symbol>,
            min_inv: i128,
        ) -> Address {
            let project_addr = self.env.register_contract(None, MockProject);
            self.contract
                .register_project(&project_addr, &risk, &tags, &true, &min_inv);
            project_addr
        }
    }

    #[test]
    fn test_deposit_and_drip_flow() {
        let ctx = TestContext::setup();
        let tags = Vec::from_array(&ctx.env, [symbol_short!("tech"), symbol_short!("green")]);

        ctx.contract.deposit(
            &ctx.user,
            &1000,
            &RiskLevel::Moderate,
            &tags,
            &200,
            &ctx.token.address,
        );

        assert_eq!(ctx.token.balance(&ctx.user), 999000);
        assert_eq!(ctx.token.balance(&ctx.contract.address), 1000);

        let pool = ctx.contract.get_pool(&ctx.user);
        assert_eq!(pool.remaining_balance, 1000);

        // Register projects
        let p1_tags = Vec::from_array(&ctx.env, [symbol_short!("tech")]);
        let p1 = ctx.register_mock_project(RiskLevel::Conservative, p1_tags, 50);

        let p2_tags = Vec::from_array(&ctx.env, [symbol_short!("real"), symbol_short!("green")]);
        let p2 = ctx.register_mock_project(RiskLevel::Moderate, p2_tags, 50);

        let p3_tags = Vec::from_array(&ctx.env, [symbol_short!("crypto")]);
        let p3 = ctx.register_mock_project(RiskLevel::Aggressive, p3_tags, 50);

        // Advance time
        ctx.env
            .ledger()
            .set_timestamp(ctx.env.ledger().timestamp() + SECONDS_PER_MONTH + 1);

        // execute drip
        let invested = ctx.contract.execute_drip(&ctx.user);

        // P3 should be excluded (risk too high)
        // P1 and P2 should be included. Tag scores: P1=1, P2=1.
        assert_eq!(invested.len(), 2);
        assert!(invested.contains(&p1));
        assert!(invested.contains(&p2));
        assert!(!invested.contains(&p3));

        let pool = ctx.contract.get_pool(&ctx.user);
        assert_eq!(pool.remaining_balance, 800);
        assert_eq!(pool.invested_projects.len(), 2);
    }

    #[test]
    fn test_matching_logic_ranking() {
        let ctx = TestContext::setup();
        let user_tags = Vec::from_array(
            &ctx.env,
            [symbol_short!("a"), symbol_short!("b"), symbol_short!("c")],
        );

        // Project 1: overlapping 3 tags
        let p1 = ctx.register_mock_project(RiskLevel::Aggressive, user_tags.clone(), 10);
        // Project 2: overlapping 1 tag
        let p2 = ctx.register_mock_project(
            RiskLevel::Aggressive,
            Vec::from_array(&ctx.env, [symbol_short!("a")]),
            10,
        );
        // Project 3: overlapping 2 tags
        let p3 = ctx.register_mock_project(
            RiskLevel::Aggressive,
            Vec::from_array(&ctx.env, [symbol_short!("a"), symbol_short!("b")]),
            10,
        );

        let matched = ctx
            .contract
            .match_projects(&RiskLevel::Aggressive, &user_tags, &100);

        assert_eq!(matched.get(0).unwrap(), p1);
        assert_eq!(matched.get(1).unwrap(), p3);
        assert_eq!(matched.get(2).unwrap(), p2);
    }

    #[test]
    fn test_pause_resume() {
        let ctx = TestContext::setup();
        let tags = Vec::from_array(&ctx.env, [symbol_short!("a")]);
        ctx.contract.deposit(
            &ctx.user,
            &1000,
            &RiskLevel::Moderate,
            &tags,
            &200,
            &ctx.token.address,
        );

        ctx.contract.pause(&ctx.user);

        ctx.contract.resume(&ctx.user);
        ctx.env
            .ledger()
            .set_timestamp(ctx.env.ledger().timestamp() + SECONDS_PER_MONTH + 1);

        let drip_res = ctx.contract.execute_drip(&ctx.user);
        assert_eq!(drip_res.len(), 0);

        // Second call should fail with cooldown
        let fail_res = ctx.contract.try_execute_drip(&ctx.user);
        assert_eq!(
            fail_res.err().unwrap().unwrap(),
            Error::DripCooldownNotMet.into()
        );
    }

    #[test]
    fn test_withdrawals() {
        let ctx = TestContext::setup();
        let tags = Vec::from_array(&ctx.env, [symbol_short!("a")]);
        ctx.contract.deposit(
            &ctx.user,
            &1000,
            &RiskLevel::Moderate,
            &tags,
            &200,
            &ctx.token.address,
        );

        // Partial withdrawal
        ctx.contract
            .withdraw(&ctx.user, &Some(400), &ctx.token.address);
        assert_eq!(ctx.token.balance(&ctx.user), 999400);

        let pool = ctx.contract.get_pool(&ctx.user);
        assert_eq!(pool.remaining_balance, 600);

        // Full withdrawal
        ctx.contract.withdraw(&ctx.user, &None, &ctx.token.address);
        assert_eq!(ctx.token.balance(&ctx.user), 1000000);

        // Entry should be removed
        let res = ctx.contract.try_get_pool(&ctx.user);
        assert!(res.is_err());
    }

    #[test]
    fn test_admin_global_pause() {
        let ctx = TestContext::setup();
        ctx.contract.admin_pause_contract();

        let tags = Vec::from_array(&ctx.env, [symbol_short!("a")]);

        // Deposit should still work? Prompt says: "When the contract is globally paused, execute_drip() and deposit() must reject all calls"
        // Wait, I should check my implementation of deposit.
        // I didn't add global pause check to deposit. Let me fix that.

        let res = ctx.contract.try_deposit(
            &ctx.user,
            &1000,
            &RiskLevel::Moderate,
            &tags,
            &200,
            &ctx.token.address,
        );
        assert_eq!(res.err().unwrap().unwrap(), Error::ContractPaused.into());
    }

    #[test]
    fn test_risk_filters() {
        let ctx = TestContext::setup();
        let p_cons = ctx.register_mock_project(RiskLevel::Conservative, Vec::new(&ctx.env), 10);
        let p_mod = ctx.register_mock_project(RiskLevel::Moderate, Vec::new(&ctx.env), 10);
        let _p_agg = ctx.register_mock_project(RiskLevel::Aggressive, Vec::new(&ctx.env), 10);

        // Conservative user
        let matched =
            ctx.contract
                .match_projects(&RiskLevel::Conservative, &Vec::new(&ctx.env), &100);
        assert_eq!(matched.len(), 1);
        assert!(matched.contains(&p_cons));

        // Moderate user
        let matched = ctx
            .contract
            .match_projects(&RiskLevel::Moderate, &Vec::new(&ctx.env), &100);
        assert_eq!(matched.len(), 2);
        assert!(matched.contains(&p_cons));
        assert!(matched.contains(&p_mod));

        // Aggressive user
        let matched =
            ctx.contract
                .match_projects(&RiskLevel::Aggressive, &Vec::new(&ctx.env), &100);
        assert_eq!(matched.len(), 3);
    }

    #[test]
    fn test_admin_functions() {
        let ctx = TestContext::setup();
        let p1 = ctx.register_mock_project(RiskLevel::Conservative, Vec::new(&ctx.env), 10);

        // Deregister
        ctx.contract.deregister_project(&p1);

        let user_tags = Vec::new(&ctx.env);
        let matched = ctx
            .contract
            .match_projects(&RiskLevel::Aggressive, &user_tags, &100);
        assert_eq!(matched.len(), 0); // Should be inactive
    }

    #[test]
    fn test_errors() {
        let ctx = TestContext::setup();

        // Duplicate init
        let res = ctx.contract.try_initialize(&ctx.admin);
        assert_eq!(
            res.err().unwrap().unwrap(),
            Error::EntryAlreadyExists.into()
        );

        let tags = Vec::from_array(&ctx.env, [symbol_short!("a")]);
        ctx.contract.deposit(
            &ctx.user,
            &100,
            &RiskLevel::Moderate,
            &tags,
            &100,
            &ctx.token.address,
        );

        // Duplicate deposit
        let res = ctx.contract.try_deposit(
            &ctx.user,
            &100,
            &RiskLevel::Moderate,
            &tags,
            &100,
            &ctx.token.address,
        );
        assert_eq!(
            res.err().unwrap().unwrap(),
            Error::EntryAlreadyExists.into()
        );

        // Insufficient balance for drip
        // We already deposited 100, and drip is 100.
        // First drip should work, second should fail.
        ctx.env
            .ledger()
            .set_timestamp(ctx.env.ledger().timestamp() + SECONDS_PER_MONTH + 1);

        // We need a project to actually drip
        ctx.register_mock_project(RiskLevel::Moderate, tags.clone(), 10);
        ctx.contract.execute_drip(&ctx.user);

        // Now balance is 0
        ctx.env
            .ledger()
            .set_timestamp(ctx.env.ledger().timestamp() + SECONDS_PER_MONTH + 1);
        let res = ctx.contract.try_execute_drip(&ctx.user);
        assert_eq!(
            res.err().unwrap().unwrap(),
            Error::InsufficientBalance.into()
        );
    }
}
