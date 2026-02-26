#[cfg(test)]
mod tests {
    use crate::{SubscriptionPeriod, SubscriptionPool, SubscriptionPoolClient, SubscriptionStatus};
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{token, Address, Env, String};

    struct TestContext {
        env: Env,
        #[allow(dead_code)]
        admin: Address,
        user_1: Address,
        user_2: Address,
        user_3: Address,
        token: token::Client<'static>,
        contract: SubscriptionPoolClient<'static>,
        token_admin: token::StellarAssetClient<'static>,
    }

    impl TestContext {
        fn setup() -> Self {
            let env = Env::default();

            // Enable non-root auth for testing
            env.mock_all_auths_allowing_non_root_auth();

            let admin = Address::generate(&env);
            let user_1 = Address::generate(&env);
            let user_2 = Address::generate(&env);
            let user_3 = Address::generate(&env);

            let token_address = env
                .register_stellar_asset_contract_v2(admin.clone())
                .address();
            let token = token::Client::new(&env, &token_address);
            let token_admin = token::StellarAssetClient::new(&env, &token_address);

            let contract_id = env.register_contract(None, SubscriptionPool);
            let contract = SubscriptionPoolClient::new(&env, &contract_id);

            contract.initialize(&admin);
            token_admin.mint(&user_1, &10_000);
            token_admin.mint(&user_2, &10_000);
            token_admin.mint(&user_3, &10_000);

            TestContext {
                env,
                admin,
                user_1,
                user_2,
                user_3,
                token,
                contract,
                token_admin,
            }
        }
    }

    #[test]
    fn test_successful_flow() {
        let ctx = TestContext::setup();
        let name = String::from_str(&ctx.env, "Alpha_Pool");
        let pool_id = ctx.contract.create_pool(&name, &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

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
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "Multi"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &500, &SubscriptionPeriod::Monthly);
        ctx.contract
            .subscribe(&pool_id, &ctx.user_2, &500, &SubscriptionPeriod::Monthly);

        ctx.contract.process_deposits(&pool_id);

        let pool = ctx.contract.get_pool(&pool_id);
        assert_eq!(pool.total_balance, 1000);
        assert_eq!(pool.subscriber_count, 2);
    }

    #[test]
    #[should_panic]
    fn test_min_amount_enforcement() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "Strict"), &ctx.token.address);
        // This should panic because 50 < MIN_SUBSCRIPTION (100)
        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &50, &SubscriptionPeriod::Weekly);
    }

    #[test]
    fn test_withdrawal() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "Withdraw"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &2000, &SubscriptionPeriod::Weekly);
        ctx.contract.process_deposits(&pool_id);

        // Withdraw 1000
        ctx.contract.withdraw(&pool_id, &ctx.user_1, &1000);

        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);
        assert_eq!(ctx.token.balance(&ctx.contract.address), 1000);
    }

    // ==================== CANCELLATION TESTS ====================

    #[test]
    fn test_cancel_subscription_stops_future_deductions() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "CancelTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        // Process first payment
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);

        // Cancel subscription
        ctx.contract.cancel_subscription(&pool_id, &ctx.user_1);

        // Verify subscription is cancelled
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Cancelled);

        // Advance time and process - should not deduct
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000); // Balance unchanged
    }

    #[test]
    #[should_panic]
    fn test_cancel_already_cancelled_subscription() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "CancelTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        ctx.contract.cancel_subscription(&pool_id, &ctx.user_1);
        // Should panic - already cancelled
        ctx.contract.cancel_subscription(&pool_id, &ctx.user_1);
    }

    // ==================== MODIFICATION TESTS ====================

    #[test]
    fn test_modify_subscription_amount_and_period() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "ModifyTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &500, &SubscriptionPeriod::Weekly);

        // Process initial payment
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9500);

        // Modify subscription: increase amount and change period
        ctx.contract.modify_subscription(
            &pool_id,
            &ctx.user_1,
            &1000,
            &SubscriptionPeriod::Monthly,
        );

        // Verify modification
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.amount, 1000);
        assert_eq!(sub.period, SubscriptionPeriod::Monthly);

        // Advance 1 week - should not deduct yet (now monthly)
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9500); // No change

        // Advance to monthly (2592000 seconds)
        ctx.env.ledger().set_timestamp(2592000 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 8500); // Deducted new amount
    }

    #[test]
    #[should_panic]
    fn test_modify_cancelled_subscription() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "ModifyTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &500, &SubscriptionPeriod::Weekly);

        ctx.contract.cancel_subscription(&pool_id, &ctx.user_1);
        // Should panic - cannot modify cancelled subscription
        ctx.contract.modify_subscription(
            &pool_id,
            &ctx.user_1,
            &1000,
            &SubscriptionPeriod::Monthly,
        );
    }

    #[test]
    #[should_panic]
    fn test_modify_to_invalid_amount() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "ModifyTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &500, &SubscriptionPeriod::Weekly);

        // Should panic - amount below minimum
        ctx.contract
            .modify_subscription(&pool_id, &ctx.user_1, &50, &SubscriptionPeriod::Monthly);
    }

    // ==================== PAUSE/RESUME TESTS ====================

    #[test]
    fn test_pause_and_resume_subscription() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "PauseTest"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        // Process first payment
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);

        // Pause subscription
        ctx.contract.pause_subscription(&pool_id, &ctx.user_1);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Paused);

        // Advance time - should not deduct while paused
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000); // No change

        // Resume subscription
        ctx.contract.resume_subscription(&pool_id, &ctx.user_1);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Active);

        // Advance time again - should deduct now
        ctx.env.ledger().set_timestamp(1209600 + 2); // 2 weeks
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 8000); // Deducted
    }

    #[test]
    #[should_panic]
    fn test_pause_already_paused_subscription() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "PauseTest"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        ctx.contract.pause_subscription(&pool_id, &ctx.user_1);
        // Should panic - already paused
        ctx.contract.pause_subscription(&pool_id, &ctx.user_1);
    }

    #[test]
    #[should_panic]
    fn test_resume_active_subscription() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "ResumeTest"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        // Should panic - already active
        ctx.contract.resume_subscription(&pool_id, &ctx.user_1);
    }

    // ==================== FAILED PAYMENT TESTS ====================

    #[test]
    fn test_failed_payment_increments_failure_count() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "FailTest"), &ctx.token.address);

        // Subscribe with user who has no tokens (balance = 0)
        let poor_user = Address::generate(&ctx.env);
        ctx.contract
            .subscribe(&pool_id, &poor_user, &1000, &SubscriptionPeriod::Weekly);

        // Process deposit - should fail due to insufficient balance
        ctx.contract.process_deposits(&pool_id);

        // Verify failure count incremented
        let sub = ctx.contract.get_subscription(&pool_id, &poor_user);
        assert_eq!(sub.failure_count, 1);
        assert_eq!(sub.status, SubscriptionStatus::Active); // Still active
    }

    #[test]
    fn test_multiple_failures_then_success() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "FailRecover"),
            &ctx.token.address,
        );

        // Subscribe with user who has limited tokens
        let limited_user = Address::generate(&ctx.env);
        ctx.token_admin.mint(&limited_user, &1000);
        ctx.contract
            .subscribe(&pool_id, &limited_user, &500, &SubscriptionPeriod::Weekly);

        // First payment succeeds
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &limited_user);
        assert_eq!(sub.failure_count, 0);

        // Second payment fails (only 500 left, needs 500 but next payment will fail)
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &limited_user);
        assert_eq!(sub.failure_count, 0); // Success, balance now 0

        // Third payment fails
        ctx.env.ledger().set_timestamp(1209600 + 2);
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &limited_user);
        assert_eq!(sub.failure_count, 1);

        // Add more funds
        ctx.token_admin.mint(&limited_user, &2000);

        // Fourth payment should succeed
        ctx.env.ledger().set_timestamp(1814400 + 3);
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &limited_user);
        assert_eq!(sub.failure_count, 0); // Reset on success
        assert_eq!(ctx.token.balance(&limited_user), 1500);
    }

    #[test]
    fn test_max_failures_auto_cancels() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "MaxFail"), &ctx.token.address);

        // Subscribe with user who has no tokens
        let poor_user = Address::generate(&ctx.env);
        ctx.contract
            .subscribe(&pool_id, &poor_user, &1000, &SubscriptionPeriod::Weekly);

        // Process deposits 4 times (MAX_PAYMENT_FAILURES = 3)
        // After 3 failures, the 4th attempt will trigger auto-cancellation
        for i in 0..4 {
            ctx.contract.process_deposits(&pool_id);
            // Verify intermediate states
            let sub = ctx.contract.get_subscription(&pool_id, &poor_user);
            if i < 3 {
                assert_eq!(sub.status, SubscriptionStatus::Active);
                assert_eq!(sub.failure_count, (i + 1) as u32);
            }
            ctx.env
                .ledger()
                .set_timestamp(ctx.env.ledger().timestamp() + 604800);
        }

        // Subscription should now be auto-cancelled
        let sub = ctx.contract.get_subscription(&pool_id, &poor_user);
        assert_eq!(sub.status, SubscriptionStatus::Cancelled);
        assert_eq!(sub.failure_count, 3);
    }

    // ==================== GAS EFFICIENCY & EDGE CASES ====================

    #[test]
    fn test_cancelled_subscription_skipped_in_batch() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "BatchTest"), &ctx.token.address);

        // Setup: user_1 active, user_2 cancelled, user_3 active
        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);
        ctx.contract
            .subscribe(&pool_id, &ctx.user_2, &1000, &SubscriptionPeriod::Weekly);
        ctx.contract
            .subscribe(&pool_id, &ctx.user_3, &1000, &SubscriptionPeriod::Weekly);

        // Cancel user_2
        ctx.contract.cancel_subscription(&pool_id, &ctx.user_2);

        // Process all deposits
        ctx.contract.process_deposits(&pool_id);

        // Only active users should be charged
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);
        assert_eq!(ctx.token.balance(&ctx.user_2), 10000); // Not charged
        assert_eq!(ctx.token.balance(&ctx.user_3), 9000);

        let pool = ctx.contract.get_pool(&pool_id);
        assert_eq!(pool.total_balance, 2000);
    }

    #[test]
    fn test_paused_subscription_skipped_in_batch() {
        let ctx = TestContext::setup();
        let pool_id = ctx.contract.create_pool(
            &String::from_str(&ctx.env, "PauseBatch"),
            &ctx.token.address,
        );

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);
        ctx.contract
            .subscribe(&pool_id, &ctx.user_2, &1000, &SubscriptionPeriod::Weekly);

        // Pause user_2
        ctx.contract.pause_subscription(&pool_id, &ctx.user_2);

        // Process deposits
        ctx.contract.process_deposits(&pool_id);

        // Only active user should be charged
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);
        assert_eq!(ctx.token.balance(&ctx.user_2), 10000); // Not charged
    }

    #[test]
    fn test_subscription_state_transitions() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "StateTest"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        // Initial state: Active
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Active);

        // Pause
        ctx.contract.pause_subscription(&pool_id, &ctx.user_1);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Paused);

        // Resume
        ctx.contract.resume_subscription(&pool_id, &ctx.user_1);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Active);

        // Cancel
        ctx.contract.cancel_subscription(&pool_id, &ctx.user_1);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.status, SubscriptionStatus::Cancelled);
    }

    #[test]
    fn test_next_payment_tracking() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "NextPay"), &ctx.token.address);

        ctx.env.ledger().set_timestamp(1000);
        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Weekly);

        // Initial next_payment should be current time
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.next_payment, 1000);

        // Process payment
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.next_payment, 1000 + 604800); // + 1 week

        // Advance and process again
        ctx.env.ledger().set_timestamp(1000 + 604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        let sub = ctx.contract.get_subscription(&pool_id, &ctx.user_1);
        assert_eq!(sub.next_payment, 1000 + 604800 + 1 + 604800); // + another week
    }

    #[test]
    fn test_payment_not_due_no_deduction() {
        let ctx = TestContext::setup();
        let pool_id = ctx
            .contract
            .create_pool(&String::from_str(&ctx.env, "NotDue"), &ctx.token.address);

        ctx.contract
            .subscribe(&pool_id, &ctx.user_1, &1000, &SubscriptionPeriod::Monthly);

        // Process first payment
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000);

        // Try to process again immediately - should not deduct
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000); // No change

        // Advance only 1 week (not full month)
        ctx.env.ledger().set_timestamp(604800 + 1);
        ctx.contract.process_deposits(&pool_id);
        assert_eq!(ctx.token.balance(&ctx.user_1), 9000); // Still no change
    }
}
