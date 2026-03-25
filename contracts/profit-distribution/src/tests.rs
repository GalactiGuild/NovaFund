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

    // Deposit profits
    let profit_provider = Address::generate(&env);
    token_admin.mint(&profit_provider, &1000);
    client.deposit_profits(&1, &profit_provider, &1000);

    // Check pending
    let share1 = client.get_investor_share(&1, &investor1);
    let share2 = client.get_investor_share(&1, &investor2);

    assert_eq!(share1.claimable_amount, 600);
    assert_eq!(share2.claimable_amount, 400);

    // Claim
    client.claim_dividends(&1, &investor1);
    assert_eq!(
        client.get_investor_share(&1, &investor1).claimable_amount,
        0
    );
    assert_eq!(client.get_investor_share(&1, &investor1).total_claimed, 600);

    // Deposit more
    token_admin.mint(&profit_provider, &500);
    client.deposit_profits(&1, &profit_provider, &500);

    // Check again
    assert_eq!(
        client.get_investor_share(&1, &investor1).claimable_amount,
        300
    ); // 60% of 500
    assert_eq!(
        client.get_investor_share(&1, &investor2).claimable_amount,
        600
    ); // 400 + 40% of 500 = 400+200=600
}
