#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, String,
    Vec,
};

const MIN_SUBSCRIPTION: i128 = 100;
const MAX_PAYMENT_FAILURES: u32 = 3;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SubscriptionPeriod {
    Weekly = 604800,
    Monthly = 2592000,
    Quarterly = 7776000,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SubscriptionStatus {
    Active = 0,
    Cancelled = 1,
    Paused = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    PoolCounter,
    Pool(u64),                  // pool_id -> Pool
    Subscription(u64, Address), // (pool_id, subscriber) -> Subscription
    SubscribersList(u64),       // pool_id -> Vec<Address>
    FailedPaymentCount(u64, Address), // (pool_id, subscriber) -> u32
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Pool {
    pub pool_id: u64,
    pub name: String,
    pub token: Address,
    pub total_balance: i128,
    pub subscriber_count: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Subscription {
    pub subscriber: Address,
    pub pool_id: u64,
    pub amount: i128,
    pub period: SubscriptionPeriod,
    pub last_payment: u64,
    pub next_payment: u64,
    pub status: SubscriptionStatus,
    pub failure_count: u32,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidAmount = 4,
    InsufficientBalance = 5,
    PoolNotFound = 7,
    SubscriptionNotFound = 8,
    SubscriptionNotActive = 9,
    SubscriptionAlreadyCancelled = 10,
    MaxFailuresReached = 11,
    InvalidStatus = 12,
    Unauthorized = 13,
    PaymentNotDue = 14,
}

#[contract]
pub struct SubscriptionPool;

#[contractimpl]
impl SubscriptionPool {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PoolCounter, &0u64);
        Ok(())
    }

    pub fn create_pool(env: Env, name: String, token: Address) -> u64 {
        let mut count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::PoolCounter)
            .unwrap_or(0);
        count += 1;

        let pool = Pool {
            pool_id: count,
            name,
            token,
            total_balance: 0,
            subscriber_count: 0,
        };

        env.storage().persistent().set(&DataKey::Pool(count), &pool);
        env.storage().instance().set(&DataKey::PoolCounter, &count);
        env.events()
            .publish((symbol_short!("pool_cre"), count), pool.name);
        count
    }

    pub fn subscribe(
        env: Env,
        pool_id: u64,
        subscriber: Address,
        amount: i128,
        period: SubscriptionPeriod,
    ) -> Result<(), Error> {
        subscriber.require_auth();
        if amount < MIN_SUBSCRIPTION {
            return Err(Error::InvalidAmount);
        }

        let pool_key = DataKey::Pool(pool_id);
        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::PoolNotFound)?;

        let sub_key = DataKey::Subscription(pool_id, subscriber.clone());
        if env.storage().persistent().has(&sub_key) {
            return Err(Error::AlreadyInitialized);
        }

        let current_time = env.ledger().timestamp();
        let sub = Subscription {
            subscriber: subscriber.clone(),
            pool_id,
            amount,
            period,
            last_payment: 0,
            next_payment: current_time,
            status: SubscriptionStatus::Active,
            failure_count: 0,
        };

        let list_key = DataKey::SubscribersList(pool_id);
        let mut subscribers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        subscribers.push_back(subscriber.clone());

        pool.subscriber_count += 1;

        env.storage().persistent().set(&sub_key, &sub);
        env.storage().persistent().set(&list_key, &subscribers);
        env.storage().persistent().set(&pool_key, &pool);

        env.events()
            .publish((symbol_short!("subscr"), pool_id), subscriber);
        Ok(())
    }

    pub fn process_deposits(env: Env, pool_id: u64) -> Result<(), Error> {
        let pool_key = DataKey::Pool(pool_id);
        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::PoolNotFound)?;
        let token_client = token::Client::new(&env, &pool.token);

        let list_key = DataKey::SubscribersList(pool_id);
        let subscribers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&list_key)
            .unwrap_or(Vec::new(&env));
        let current_time = env.ledger().timestamp();

        for subscriber_addr in subscribers.iter() {
            let sub_key = DataKey::Subscription(pool_id, subscriber_addr.clone());
            let mut sub: Subscription = match env.storage().persistent().get(&sub_key) {
                Some(s) => s,
                None => continue, // Skip if subscription not found
            };

            // Skip cancelled subscriptions
            if sub.status == SubscriptionStatus::Cancelled {
                continue;
            }

            // Skip paused subscriptions
            if sub.status == SubscriptionStatus::Paused {
                continue;
            }

            // Check if payment is due
            let is_due = current_time >= sub.next_payment;

            if is_due {
                // Check if max failures reached
                if sub.failure_count >= MAX_PAYMENT_FAILURES {
                    // Auto-cancel subscription after max failures
                    sub.status = SubscriptionStatus::Cancelled;
                    env.storage().persistent().set(&sub_key, &sub);
                    env.events().publish(
                        (symbol_short!("sub_cancl"), pool_id, subscriber_addr.clone()),
                        symbol_short!("max_fail"),
                    );
                    continue;
                }

                // Attempt transfer - handle potential failure
                let transfer_result = token_client.try_transfer(
                    &sub.subscriber,
                    &env.current_contract_address(),
                    &sub.amount,
                );

                match transfer_result {
                    Ok(_) => {
                        // Successful payment
                        sub.last_payment = current_time;
                        sub.next_payment = current_time + (sub.period as u32 as u64);
                        sub.failure_count = 0; // Reset failure count on success
                        pool.total_balance += sub.amount;

                        env.storage().persistent().set(&sub_key, &sub);
                        env.events().publish(
                            (symbol_short!("deposit"), pool_id),
                            (subscriber_addr, sub.amount),
                        );
                    }
                    Err(_) => {
                        // Failed payment - increment failure count
                        sub.failure_count += 1;
                        env.storage().persistent().set(&sub_key, &sub);
                        env.events().publish(
                            (symbol_short!("pay_fail"), pool_id, subscriber_addr.clone()),
                            sub.failure_count,
                        );
                    }
                }
            }
        }

        env.storage().persistent().set(&pool_key, &pool);
        Ok(())
    }

    pub fn cancel_subscription(
        env: Env,
        pool_id: u64,
        subscriber: Address,
    ) -> Result<(), Error> {
        subscriber.require_auth();

        let sub_key = DataKey::Subscription(pool_id, subscriber.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if sub.status == SubscriptionStatus::Cancelled {
            return Err(Error::SubscriptionAlreadyCancelled);
        }

        sub.status = SubscriptionStatus::Cancelled;
        env.storage().persistent().set(&sub_key, &sub);

        env.events().publish(
            (symbol_short!("sub_cancl"), pool_id),
            subscriber,
        );
        Ok(())
    }

    pub fn modify_subscription(
        env: Env,
        pool_id: u64,
        subscriber: Address,
        new_amount: i128,
        new_period: SubscriptionPeriod,
    ) -> Result<(), Error> {
        subscriber.require_auth();

        if new_amount < MIN_SUBSCRIPTION {
            return Err(Error::InvalidAmount);
        }

        let sub_key = DataKey::Subscription(pool_id, subscriber.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if sub.status == SubscriptionStatus::Cancelled {
            return Err(Error::SubscriptionAlreadyCancelled);
        }

        sub.amount = new_amount;
        sub.period = new_period;
        // Reset next payment based on new period from current time
        sub.next_payment = env.ledger().timestamp() + (new_period as u32 as u64);

        env.storage().persistent().set(&sub_key, &sub);

        env.events().publish(
            (symbol_short!("sub_mod"), pool_id),
            (subscriber, new_amount, new_period as u32),
        );
        Ok(())
    }

    pub fn pause_subscription(
        env: Env,
        pool_id: u64,
        subscriber: Address,
    ) -> Result<(), Error> {
        subscriber.require_auth();

        let sub_key = DataKey::Subscription(pool_id, subscriber.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if sub.status != SubscriptionStatus::Active {
            return Err(Error::InvalidStatus);
        }

        sub.status = SubscriptionStatus::Paused;
        env.storage().persistent().set(&sub_key, &sub);

        env.events().publish(
            (symbol_short!("sub_pause"), pool_id),
            subscriber,
        );
        Ok(())
    }

    pub fn resume_subscription(
        env: Env,
        pool_id: u64,
        subscriber: Address,
    ) -> Result<(), Error> {
        subscriber.require_auth();

        let sub_key = DataKey::Subscription(pool_id, subscriber.clone());
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&sub_key)
            .ok_or(Error::SubscriptionNotFound)?;

        if sub.status != SubscriptionStatus::Paused {
            return Err(Error::InvalidStatus);
        }

        sub.status = SubscriptionStatus::Active;
        // Set next payment from current time to avoid immediate double-charge
        sub.next_payment = env.ledger().timestamp() + (sub.period as u32 as u64);
        env.storage().persistent().set(&sub_key, &sub);

        env.events().publish(
            (symbol_short!("sub_resum"), pool_id),
            subscriber,
        );
        Ok(())
    }

    pub fn withdraw(
        env: Env,
        pool_id: u64,
        subscriber: Address,
        amount: i128,
    ) -> Result<(), Error> {
        subscriber.require_auth();

        let pool_key = DataKey::Pool(pool_id);
        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::PoolNotFound)?;

        if amount <= 0 || amount > pool.total_balance {
            return Err(Error::InsufficientBalance);
        }

        let token_client = token::Client::new(&env, &pool.token);
        token_client.transfer(&env.current_contract_address(), &subscriber, &amount);

        pool.total_balance -= amount;
        env.storage().persistent().set(&pool_key, &pool);

        env.events()
            .publish((symbol_short!("withdraw"), pool_id), subscriber);
        Ok(())
    }

    pub fn get_pool(env: Env, pool_id: u64) -> Result<Pool, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)
    }

    pub fn get_subscription(
        env: Env,
        pool_id: u64,
        subscriber: Address,
    ) -> Result<Subscription, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Subscription(pool_id, subscriber))
            .ok_or(Error::SubscriptionNotFound)
    }
}

mod test;
