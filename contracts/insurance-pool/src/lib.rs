#![no_std]
use shared::types::{Amount, BasisPoints};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PoolToken,
    TotalReserves,
    LockedReserves,
    ProjectConfig(u64),
    Coverage(u64, Address),
}

#[contracttype]
#[derive(Clone)]
pub struct ProjectConfig {
    pub project_id: u64,
    pub premium_rate_bp: BasisPoints,
    pub coverage_rate_bp: BasisPoints,
    pub max_coverage_per_investor: Amount,
    pub max_total_coverage: Amount,
    pub total_coverage: Amount,
    pub is_active: bool,
    pub failure_marked: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct CoveragePosition {
    pub project_id: u64,
    pub investor: Address,
    pub covered_amount: Amount,
    pub premium_paid: Amount,
    pub claimed: bool,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidInput = 4,
    ProjectNotConfigured = 100,
    CoverageExceedsCapacity = 101,
    CoverageLimitExceeded = 102,
    NoCoverage = 103,
    AlreadyClaimed = 104,
    ProjectNotEligibleForClaim = 105,
    PoolUnderfunded = 106,
}

const MIN_PREMIUM_RATE_BP: BasisPoints = 10;

#[contract]
pub struct InsurancePool;

fn read_admin(env: &Env) -> Result<Address, Error> {
    let admin: Option<Address> = env.storage().instance().get(&DataKey::Admin);
    admin.ok_or(Error::NotInitialized)
}

fn read_pool_token(env: &Env) -> Result<Address, Error> {
    let token: Option<Address> = env.storage().instance().get(&DataKey::PoolToken);
    token.ok_or(Error::NotInitialized)
}

fn read_total_reserves(env: &Env) -> Amount {
    env.storage()
        .instance()
        .get(&DataKey::TotalReserves)
        .unwrap_or(0)
}

fn read_locked_reserves(env: &Env) -> Amount {
    env.storage()
        .instance()
        .get(&DataKey::LockedReserves)
        .unwrap_or(0)
}

fn write_total_reserves(env: &Env, value: Amount) {
    env.storage()
        .instance()
        .set(&DataKey::TotalReserves, &value);
}

fn write_locked_reserves(env: &Env, value: Amount) {
    env.storage()
        .instance()
        .set(&DataKey::LockedReserves, &value);
}

fn read_project_config(env: &Env, project_id: u64) -> Result<ProjectConfig, Error> {
    let key = DataKey::ProjectConfig(project_id);
    let cfg: Option<ProjectConfig> = env.storage().instance().get(&key);
    cfg.ok_or(Error::ProjectNotConfigured)
}

fn write_project_config(env: &Env, config: &ProjectConfig) {
    let key = DataKey::ProjectConfig(config.project_id);
    env.storage().instance().set(&key, config);
}

fn read_coverage(env: &Env, project_id: u64, investor: &Address) -> Option<CoveragePosition> {
    let key = DataKey::Coverage(project_id, investor.clone());
    env.storage().instance().get(&key)
}

fn write_coverage(env: &Env, coverage: &CoveragePosition) {
    let key = DataKey::Coverage(coverage.project_id, coverage.investor.clone());
    env.storage().instance().set(&key, coverage);
}

#[contractimpl]
impl InsurancePool {
    pub fn initialize(env: Env, admin: Address, pool_token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::PoolToken, &pool_token);
        env.storage()
            .instance()
            .set(&DataKey::TotalReserves, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::LockedReserves, &0i128);
        Ok(())
    }

    pub fn fund_pool(env: Env, funder: Address, amount: Amount) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }
        let token = read_pool_token(&env)?;
        funder.require_auth();
        let mut total_reserves = read_total_reserves(&env);
        let client = TokenClient::new(&env, &token);
        client.transfer(&funder, &env.current_contract_address(), &amount);
        total_reserves += amount;
        write_total_reserves(&env, total_reserves);
        Ok(())
    }

    pub fn configure_project(
        env: Env,
        project_id: u64,
        premium_rate_bp: BasisPoints,
        coverage_rate_bp: BasisPoints,
        max_coverage_per_investor: Amount,
        max_total_coverage: Amount,
        active: bool,
    ) -> Result<(), Error> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        if premium_rate_bp < MIN_PREMIUM_RATE_BP
            || premium_rate_bp as i32 <= 0
            || coverage_rate_bp == 0
            || coverage_rate_bp > 10000
            || max_total_coverage <= 0
        {
            return Err(Error::InvalidInput);
        }
        let existing = read_project_config(&env, project_id).ok();
        let total_coverage = existing.as_ref().map(|c| c.total_coverage).unwrap_or(0);
        if total_coverage > max_total_coverage {
            return Err(Error::CoverageLimitExceeded);
        }
        let config = ProjectConfig {
            project_id,
            premium_rate_bp,
            coverage_rate_bp,
            max_coverage_per_investor,
            max_total_coverage,
            total_coverage,
            is_active: active,
            failure_marked: existing.map(|c| c.failure_marked).unwrap_or(false),
        };
        write_project_config(&env, &config);
        Ok(())
    }

    pub fn purchase_coverage(
        env: Env,
        project_id: u64,
        investor: Address,
        coverage_amount: Amount,
    ) -> Result<(), Error> {
        if coverage_amount <= 0 {
            return Err(Error::InvalidInput);
        }
        let token = read_pool_token(&env)?;
        investor.require_auth();
        let mut config = read_project_config(&env, project_id)?;
        if !config.is_active || config.failure_marked {
            return Err(Error::ProjectNotConfigured);
        }
        let mut position = read_coverage(&env, project_id, &investor).unwrap_or(CoveragePosition {
            project_id,
            investor: investor.clone(),
            covered_amount: 0,
            premium_paid: 0,
            claimed: false,
        });
        if position.claimed {
            return Err(Error::AlreadyClaimed);
        }
        let new_investor_coverage = position
            .covered_amount
            .checked_add(coverage_amount)
            .ok_or(Error::InvalidInput)?;
        if config.max_coverage_per_investor > 0
            && new_investor_coverage > config.max_coverage_per_investor
        {
            return Err(Error::CoverageLimitExceeded);
        }
        let new_total_coverage = config
            .total_coverage
            .checked_add(coverage_amount)
            .ok_or(Error::InvalidInput)?;
        if new_total_coverage > config.max_total_coverage {
            return Err(Error::CoverageLimitExceeded);
        }
        let premium = (coverage_amount
            .checked_mul(config.premium_rate_bp as i128)
            .ok_or(Error::InvalidInput)?)
            / 10000;
        if premium <= 0 {
            return Err(Error::InvalidInput);
        }
        let mut total_reserves = read_total_reserves(&env);
        let locked_reserves = read_locked_reserves(&env);
        let projected_reserves = total_reserves
            .checked_add(premium)
            .ok_or(Error::InvalidInput)?;
        let projected_locked = locked_reserves
            .checked_add(coverage_amount)
            .ok_or(Error::InvalidInput)?;
        if projected_locked > projected_reserves {
            return Err(Error::CoverageExceedsCapacity);
        }
        let client = TokenClient::new(&env, &token);
        client.transfer(&investor, &env.current_contract_address(), &premium);
        total_reserves = projected_reserves;
        write_total_reserves(&env, total_reserves);
        write_locked_reserves(&env, projected_locked);
        config.total_coverage = new_total_coverage;
        write_project_config(&env, &config);
        position.covered_amount = new_investor_coverage;
        position.premium_paid = position
            .premium_paid
            .checked_add(premium)
            .ok_or(Error::InvalidInput)?;
        write_coverage(&env, &position);
        Ok(())
    }

    pub fn mark_project_failed(env: Env, project_id: u64) -> Result<(), Error> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        let mut config = read_project_config(&env, project_id)?;
        if config.failure_marked {
            return Ok(());
        }
        config.failure_marked = true;
        config.is_active = false;
        write_project_config(&env, &config);
        Ok(())
    }

    pub fn claim_payout(env: Env, project_id: u64, investor: Address) -> Result<Amount, Error> {
        let token = read_pool_token(&env)?;
        investor.require_auth();
        let config = read_project_config(&env, project_id)?;
        if !config.failure_marked {
            return Err(Error::ProjectNotEligibleForClaim);
        }
        let mut position = read_coverage(&env, project_id, &investor).ok_or(Error::NoCoverage)?;
        if position.covered_amount <= 0 {
            return Err(Error::NoCoverage);
        }
        if position.claimed {
            return Err(Error::AlreadyClaimed);
        }
        let payout = (position
            .covered_amount
            .checked_mul(config.coverage_rate_bp as i128)
            .ok_or(Error::InvalidInput)?)
            / 10000;
        if payout <= 0 {
            return Err(Error::InvalidInput);
        }
        let mut total_reserves = read_total_reserves(&env);
        let mut locked_reserves = read_locked_reserves(&env);
        if payout > total_reserves {
            return Err(Error::PoolUnderfunded);
        }
        total_reserves -= payout;
        locked_reserves = locked_reserves
            .checked_sub(position.covered_amount)
            .ok_or(Error::InvalidInput)?;
        let client = TokenClient::new(&env, &token);
        client.transfer(&env.current_contract_address(), &investor, &payout);
        position.claimed = true;
        write_total_reserves(&env, total_reserves);
        write_locked_reserves(&env, locked_reserves);
        write_coverage(&env, &position);
        Ok(payout)
    }

    pub fn get_project_config(env: Env, project_id: u64) -> Result<ProjectConfig, Error> {
        read_project_config(&env, project_id)
    }

    pub fn get_coverage(
        env: Env,
        project_id: u64,
        investor: Address,
    ) -> Result<CoveragePosition, Error> {
        read_coverage(&env, project_id, &investor).ok_or(Error::NoCoverage)
    }

    pub fn get_pool_state(env: Env) -> (Amount, Amount, Option<Address>) {
        let total = read_total_reserves(&env);
        let locked = read_locked_reserves(&env);
        let token: Option<Address> = env.storage().instance().get(&DataKey::PoolToken);
        (total, locked, token)
    }

    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as TestAddress, token, Address, Env};

    fn create_token_contract<'a>(
        env: &'a Env,
        admin: &Address,
    ) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        let token_client = token::Client::new(env, &token);
        let token_admin_client = token::StellarAssetClient::new(env, &token);
        (token, token_client, token_admin_client)
    }

    #[test]
    fn test_initialize_and_fund_pool() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InsurancePool);
        let client = InsurancePoolClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let funder = Address::generate(&env);
        let (token, token_client, token_admin_client) = create_token_contract(&env, &funder);
        env.mock_all_auths();
        client.initialize(&admin, &token);
        token_admin_client.mint(&funder, &1_000_0000000);
        client.fund_pool(&funder, &500_0000000);
        let (total, locked, pool_token) = client.get_pool_state();
        assert_eq!(total, 500_0000000);
        assert_eq!(locked, 0);
        assert_eq!(pool_token, Some(token.clone()));
        assert_eq!(token_client.balance(&contract_id), 500_0000000);
    }

    #[test]
    fn test_full_insurance_flow() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InsurancePool);
        let client = InsurancePoolClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let funder = Address::generate(&env);
        let investor = Address::generate(&env);
        let (token, token_client, token_admin_client) = create_token_contract(&env, &funder);
        env.mock_all_auths();
        client.initialize(&admin, &token);
        token_admin_client.mint(&funder, &1_000_0000000);
        client.fund_pool(&funder, &800_0000000);
        token_admin_client.mint(&investor, &500_0000000);
        client.configure_project(&1u64, &200u32, &8000u32, &500_0000000, &800_0000000, &true);
        let initial_investor_balance = token_client.balance(&investor);
        client.purchase_coverage(&1u64, &investor, &200_0000000);
        let post_premium_balance = token_client.balance(&investor);
        assert!(post_premium_balance < initial_investor_balance);
        let (total_reserves, locked_reserves, _) = client.get_pool_state();
        assert_eq!(locked_reserves, 200_0000000);
        assert!(total_reserves > 800_0000000);
        env.mock_all_auths();
        client.mark_project_failed(&1u64);
        let payout = client.claim_payout(&1u64, &investor);
        assert_eq!(payout, 160_0000000);
        let final_investor_balance = token_client.balance(&investor);
        assert!(final_investor_balance > post_premium_balance);
        let coverage = client.get_coverage(&1u64, &investor);
        assert!(coverage.claimed);
        let (final_total, final_locked, _) = client.get_pool_state();
        assert_eq!(final_locked, 0);
        assert_eq!(final_total, total_reserves - payout);
    }

    #[test]
    fn test_prevent_over_subscription() {
        let env = Env::default();
        let contract_id = env.register_contract(None, InsurancePool);
        let client = InsurancePoolClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let funder = Address::generate(&env);
        let investor = Address::generate(&env);
        let (token, _, token_admin_client) = create_token_contract(&env, &funder);
        env.mock_all_auths();
        client.initialize(&admin, &token);
        token_admin_client.mint(&funder, &1_000_0000000);
        client.fund_pool(&funder, &300_0000000);
        token_admin_client.mint(&investor, &500_0000000);
        client.configure_project(
            &2u64,
            &500u32,
            &10000u32,
            &1_000_0000000,
            &5_000_0000000,
            &true,
        );
        let res = client.try_purchase_coverage(&2u64, &investor, &4_000_0000000);
        assert!(res.is_err());
    }
}
