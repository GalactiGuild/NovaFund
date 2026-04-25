use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::token::StellarAssetClient;
use soroban_sdk::{Address, Env, Map};

fn setup_test() -> (Env, ProfitDistributionClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ProfitDistribution);
    let client = ProfitDistributionClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone());
    let token = token_id.address();

    (env, client, admin, token)
}

#[test]
fn test_initialize() {
    let (_env, client, admin, _) = setup_test();
    client.initialize(&admin);
    assert_eq!(client.get_admin(), Some(admin));
}

#[test]
fn test_full_distribution_flow() {
    let (env, client, admin, token) = setup_test();
    let token_admin = StellarAssetClient::new(&env, &token);

    client.initialize(&admin);
    client.set_token(&1, &token);

    let investor1 = Address::generate(&env);
    let investor2 = Address::generate(&env);

    let mut investors = Map::new(&env);
    investors.set(investor1.clone(), 6000); // 60%
    investors.set(investor2.clone(), 4000); // 40%

    client.register_investors(&1, &investors);

    // Deposit profits (1000 - 5% tax = 950 distributed)
    let profit_provider = Address::generate(&env);
    token_admin.mint(&profit_provider, &1000);
    client.deposit_profits(&1, &profit_provider, &1000);

    // Check pending (after 5% tax: 950 total)
    let share1 = client.get_investor_share(&1, &investor1);
    let share2 = client.get_investor_share(&1, &investor2);

    assert_eq!(share1.claimable_amount, 570); // 60% of 950
    assert_eq!(share2.claimable_amount, 380); // 40% of 950
    // Claim
    client.claim_dividends(&1, &investor1);
    assert_eq!(
        client.get_investor_share(&1, &investor1).claimable_amount,
        0
    );
    assert_eq!(client.get_investor_share(&1, &investor1).total_claimed, 570);

    // Deposit more (500 - 5% tax = 475 distributed)
    token_admin.mint(&profit_provider, &500);
    client.deposit_profits(&1, &profit_provider, &500);

    // Check again
    assert_eq!(
        client.get_investor_share(&1, &investor1).claimable_amount,
        285
    ); // 60% of 475
    assert_eq!(
        client.get_investor_share(&1, &investor2).claimable_amount,
        570
    ); // 380 + 40% of 475 = 380+190=570
}

/// Verify that depositing an astronomically large amount returns Overflow
/// instead of panicking.
#[test]
fn test_deposit_overflow_returns_error() {
    let (env, client, admin, token) = setup_test();
    let token_admin = StellarAssetClient::new(&env, &token);

    client.initialize(&admin);
    client.set_token(&1, &token);

    let investor = Address::generate(&env);
    let mut investors = Map::new(&env);
    investors.set(investor.clone(), 10000);
    client.register_investors(&1, &investors);

    let depositor = Address::generate(&env);
    // Mint i128::MAX tokens – the checked_mul inside deposit_profits will overflow
    token_admin.mint(&depositor, &i128::MAX);

    let result = client.try_deposit_profits(&1, &depositor, &i128::MAX);
    assert!(result.is_err(), "expected Overflow error, got Ok");
}

/// Verify that math::checked_bps and checked_muldiv behave correctly at
/// boundary values (unit tests for the shared math module).
#[test]
fn test_shared_math_boundaries() {
    use shared::math::{checked_bps, checked_muldiv};

    // Normal case
    assert_eq!(checked_bps(1_000_000, 500), Some(50_000));

    // Overflow case
    assert_eq!(checked_bps(i128::MAX, 10_000), None);

    // Division by zero
    assert_eq!(checked_muldiv(1_000, 500, 0), None);

    // Large but valid: (i128::MAX / 10_000) * 1 should not overflow
    let safe_amount = i128::MAX / 10_000;
    assert!(checked_bps(safe_amount, 10_000).is_some());
}
