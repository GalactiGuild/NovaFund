#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Subscription(Address), // subscriber -> SubscriptionInfo
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct SubscriptionInfo {
    pub subscriber: Address,
    pub token: Address,
    pub amount_per_period: i128,
    pub period_seconds: u64,
    pub last_deposit: u64,
    pub total_deposited: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    PeriodNotPassed = 6,
    SubscriptionNotFound = 7,
}

#[contract]
pub struct SubscriptionPool;

#[contractimpl]
impl SubscriptionPool {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn subscribe(
        env: Env,
        subscriber: Address,
        token: Address,
        amount_per_period: i128,
        period_seconds: u64,
    ) -> Result<(), Error> {
        subscriber.require_auth();
        if amount_per_period <= 0 {
            return Err(Error::InvalidAmount);
        }

        let sub = SubscriptionInfo {
            subscriber: subscriber.clone(),
            token,
            amount_per_period,
            period_seconds,
            last_deposit: 0,
            total_deposited: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Subscription(subscriber), &sub);
        Ok(())
    }

    pub fn deposit(env: Env, subscriber: Address) -> Result<(), Error> {
        subscriber.require_auth();
        let mut sub: SubscriptionInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(subscriber.clone()))
            .ok_or(Error::SubscriptionNotFound)?;

        let current_time = env.ledger().timestamp();
        if sub.last_deposit != 0 && current_time < sub.last_deposit + sub.period_seconds {
            return Err(Error::PeriodNotPassed);
        }

        // Transfer tokens
        let token_client = TokenClient::new(&env, &sub.token);
        token_client.transfer(
            &subscriber,
            &env.current_contract_address(),
            &sub.amount_per_period,
        );

        sub.last_deposit = current_time;
        sub.total_deposited += sub.amount_per_period;

        env.storage()
            .persistent()
            .set(&DataKey::Subscription(subscriber), &sub);
        Ok(())
    }

    pub fn withdraw(env: Env, subscriber: Address, amount: i128) -> Result<(), Error> {
        subscriber.require_auth();
        let mut sub: SubscriptionInfo = env
            .storage()
            .persistent()
            .get(&DataKey::Subscription(subscriber.clone()))
            .ok_or(Error::SubscriptionNotFound)?;

        if amount <= 0 || amount > sub.total_deposited {
            return Err(Error::InsufficientBalance);
        }

        let token_client = TokenClient::new(&env, &sub.token);
        token_client.transfer(&env.current_contract_address(), &subscriber, &amount);

        sub.total_deposited -= amount;
        env.storage()
            .persistent()
            .set(&DataKey::Subscription(subscriber), &sub);
        Ok(())
    }

    pub fn get_subscription(env: Env, subscriber: Address) -> Result<SubscriptionInfo, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Subscription(subscriber))
            .ok_or(Error::SubscriptionNotFound)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::token::StellarAssetClient;

    #[test]
    fn test_subscription_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, SubscriptionPool);
        let client = SubscriptionPoolClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        let subscriber = Address::generate(&env);
        let token = env.register_stellar_asset_contract(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &token);
        token_admin.mint(&subscriber, &1000);

        // Subscribe: $100 every 86400s (1 day)
        client.subscribe(&subscriber, &token, &100, &86400);

        // First deposit
        env.ledger().set_timestamp(100000);
        client.deposit(&subscriber);
        assert_eq!(client.get_subscription(&subscriber).total_deposited, 100);

        // Try deposit too soon
        env.ledger().set_timestamp(150000); // Only 50k passed
        let result = client.try_deposit(&subscriber);
        assert!(result.is_err());

        // Deposit after period
        env.ledger().set_timestamp(200000); // 100k passed
        client.deposit(&subscriber);
        assert_eq!(client.get_subscription(&subscriber).total_deposited, 200);

        // Withdraw
        client.withdraw(&subscriber, &150);
        assert_eq!(client.get_subscription(&subscriber).total_deposited, 50);
    }
}
