#[cfg(test)]
mod test {
    use crate::{SubscriptionPeriod, SubscriptionPool, SubscriptionPoolClient};
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{token, Address, Env, String};

    struct TestContext {
        env: Env,
        #[allow(dead_code)]
        admin: Address,
        user_1: Address,
        user_2: Address,
        token: token::Client<'static>,
        contract: SubscriptionPoolClient<'static>,
    }

    impl TestContext {
        fn setup() -> Self {
            let env = Env::default();
            
            // FIX 1: Enable non-root auth. 
            // This allows the contract to perform 'transfer' calls on behalf of users 
            // during the test without needing manual signature mocks for every sub-call.
            env.mock_all_auths_allowing_non_root_auth(); 

            let admin = Address::generate(&env);
            let user_1 = Address::generate(&env);
            let user_2 = Address::generate(&env);

            // FIX 2: Use register_stellar_asset_contract_v2 to avoid deprecation warnings
            let token_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
            let token = token::Client::new(&env, &token_address);
            let token_admin = token::StellarAssetClient::new(&env, &token_address);

            let contract_id = env.register_contract(None, SubscriptionPool);
            let contract = SubscriptionPoolClient::new(&env, &contract_id);

            contract.initialize(&admin);
            token_admin.mint(&user_1, &10_000);
            token_admin.mint(&user_2, &10_000);

            TestContext { env, admin, user_1, user_2, token, contract }
        }
    }

    

    #[test]
    fn test_successful_flow() {
        let ctx = TestContext::setup();
        let name = String::from_str(&ctx.env, "Alpha_Pool");
        let pool_id = ctx.contract.create_pool(&name, &ctx.token.address);

        ctx.contract.subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);
        
        // Initial Deposit
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);
        assert_eq!(ctx.token.balance(&ctx.contract.address), 1000);

        // Advance time 1 week (604800 seconds)
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 8000);
    }

    #[test]
    fn test_multiple_subscribers() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(&String::from_str(&ctx.env, "Multi"), &ctx.token.address);

        ctx.contract.subscribe(&pool_id, &ctx.user_1, &500, &SubscriptionPeriod::Monthly);
        ctx.contract.subscribe(&pool_id, &ctx.user_2, &500, &SubscriptionPeriod::Monthly);

        ctx.contract.process_deposits(&pool_id);

        // Result from contract client is the struct, no .unwrap() needed
        let pool = ctx.contract.get_pool(&pool_id); 
        assert_eq!(pool.total_balance, 1000);
        assert_eq!(pool.subscriber_count, 2);
    }

    #[test]
    #[should_panic] 
    fn test_min_amount_enforcement() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(&String::from_str(&ctx.env, "Strict"), &ctx.token.address);
        // This should panic because 50 < MIN_SUBSCRIPTION (100)
        ctx.contract.subscribe(&pool_id, &ctx.user_1, &50, &SubscriptionPeriod::Weekly);
    }

    #[test]
    fn test_withdrawal() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(&String::from_str(&ctx.env, "Withdraw"), &ctx.token.address);

        ctx.contract.subscribe(&pool_id, &ctx.user_1, &2000, &SubscriptionPeriod::Weekly);
        ctx.contract.process_deposits(&pool_id);
        
        // Withdraw 1000
        ctx.contract.withdraw(&pool_id, &ctx.user_1, &1000);
        
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000); 
        assert_eq!(ctx.token.balance(&ctx.contract.address), 1000);
    }
}