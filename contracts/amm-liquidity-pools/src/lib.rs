#![no_std]

use shared::Error;
use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env, Map,
    Symbol, Vec,
};

pub mod optimizations;
pub mod rewards;

#[cfg(test)]
mod tests;

pub use optimizations::*;
pub use rewards::*;

const POOL_DATA: Symbol = symbol_short!("POOL_DATA");
const USER_POSITIONS: Symbol = symbol_short!("USER_POS");
const ADMIN: Symbol = symbol_short!("ADMIN");
const FEE_RATE: Symbol = symbol_short!("FEE_RATE");
const FLASH_LOAN_FEE: Symbol = symbol_short!("FLASH_FEE");

#[derive(Clone)]
#[contracttype]
pub struct Pool {
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: i64,
    pub reserve_b: i64,
    pub total_liquidity: i64,
    pub fee_rate: u32, // basis points (10000 = 100%)
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct UserPosition {
    pub pool_id: u64,
    pub liquidity: i64,
    pub token_a_amount: i64,
    pub token_b_amount: i64,
    pub last_fee_claimed: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct SwapParams {
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i64,
    pub min_amount_out: i64,
    pub deadline: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct LiquidityParams {
    pub token_a: Address,
    pub token_b: Address,
    pub amount_a: i64,
    pub amount_b: i64,
    pub min_liquidity: i64,
    pub deadline: u64,
}

#[contract]
pub struct AMMLiquidityPools;

#[contractimpl]
impl AMMLiquidityPools {
    pub fn initialize(env: Env, admin: Address, default_fee_rate: u32) {
        if env.storage().instance().has(&ADMIN) {
            panic_with_error!(&env, Error::AlreadyInit);
        }

        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&FEE_RATE, &default_fee_rate);
        env.storage().instance().set(&FLASH_LOAN_FEE, &5u32); // 0.05% flash loan fee
    }

    pub fn create_pool(env: Env, token_a: Address, token_b: Address) -> u64 {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        if token_a == token_b {
            panic_with_error!(&env, Error::InvInput);
        }

        let mut pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));

        // Check if pool already exists
        for (_, pool) in pools.iter() {
            if (pool.token_a == token_a && pool.token_b == token_b)
                || (pool.token_a == token_b && pool.token_b == token_a)
            {
                panic_with_error!(&env, Error::ProjExists);
            }
        }

        let pool_id: u64 = (pools.len() + 1).into();
        let fee_rate = env.storage().instance().get(&FEE_RATE).unwrap();

        let pool = Pool {
            token_a: if token_a < token_b {
                token_a.clone()
            } else {
                token_b.clone()
            },
            token_b: if token_a < token_b {
                token_b.clone()
            } else {
                token_a.clone()
            },
            reserve_a: 0,
            reserve_b: 0,
            total_liquidity: 0,
            fee_rate,
            created_at: env.ledger().timestamp(),
        };

        pools.set(pool_id, pool);
        env.storage().instance().set(&POOL_DATA, &pools);

        pool_id
    }

    pub fn add_liquidity(env: Env, params: LiquidityParams) -> i64 {
        if env.ledger().timestamp() > params.deadline {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        let mut pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let pool_id = Self::get_pool_id_internal(&env, &params.token_a, &params.token_b);

        let mut pool = pools.get(pool_id).unwrap();

        // Calculate optimal amount_b based on current reserves
        let optimal_amount_b = if pool.reserve_a == 0 || pool.reserve_b == 0 {
            params.amount_a
        } else {
            (params.amount_a * pool.reserve_b) / pool.reserve_a
        };

        let amount_b = if params.amount_b < optimal_amount_b {
            params.amount_b
        } else {
            optimal_amount_b
        };

        let amount_a = if pool.reserve_a == 0 {
            params.amount_a
        } else {
            (amount_b * pool.reserve_a) / pool.reserve_b
        };

        let liquidity = if pool.total_liquidity == 0 {
            // First liquidity provider - sqrt(amount_a * amount_b)
            Self::sqrt((amount_a * amount_b) as u64) as i64
        } else if amount_a * pool.total_liquidity / pool.reserve_a
                < amount_b * pool.total_liquidity / pool.reserve_b
        {
            amount_a * pool.total_liquidity / pool.reserve_a
        } else {
            amount_b * pool.total_liquidity / pool.reserve_b
        };

        if liquidity < params.min_liquidity {
            panic_with_error!(&env, Error::InsufFunds);
        }

        // Update pool reserves
        pool.reserve_a += amount_a;
        pool.reserve_b += amount_b;
        pool.total_liquidity += liquidity;

        pools.set(pool_id, pool);
        env.storage().instance().set(&POOL_DATA, &pools);

        // Update user position
        let user = env.current_contract_address();
        let mut user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        let positions = user_positions.get(user.clone()).unwrap_or(Vec::new(&env));

        let mut updated_positions = Vec::new(&env);
        let mut found_position = false;
        for position in positions.iter() {
            if position.pool_id == pool_id {
                let mut new_position = position.clone();
                new_position.liquidity += liquidity;
                new_position.token_a_amount += amount_a;
                new_position.token_b_amount += amount_b;
                updated_positions.push_back(new_position);
                found_position = true;
            } else {
                updated_positions.push_back(position.clone());
            }
        }

        if !found_position {
            updated_positions.push_back(UserPosition {
                pool_id,
                liquidity,
                token_a_amount: amount_a,
                token_b_amount: amount_b,
                last_fee_claimed: env.ledger().timestamp(),
            });
        }

        user_positions.set(user, updated_positions);
        env.storage()
            .instance()
            .set(&USER_POSITIONS, &user_positions);

        liquidity
    }

    pub fn remove_liquidity(
        env: Env,
        pool_id: u64,
        liquidity: i64,
        min_amount_a: i64,
        min_amount_b: i64,
        deadline: u64,
    ) -> (i64, i64) {
        if env.ledger().timestamp() > deadline {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        let mut pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let mut pool = pools.get(pool_id).unwrap();

        if pool.total_liquidity == 0 || liquidity > pool.total_liquidity {
            panic_with_error!(&env, Error::InsufFunds);
        }

        let amount_a = (liquidity * pool.reserve_a) / pool.total_liquidity;
        let amount_b = (liquidity * pool.reserve_b) / pool.total_liquidity;

        if amount_a < min_amount_a || amount_b < min_amount_b {
            panic_with_error!(&env, Error::InsufFunds);
        }

        // Update pool
        pool.reserve_a -= amount_a;
        pool.reserve_b -= amount_b;
        pool.total_liquidity -= liquidity;

        pools.set(pool_id, pool);
        env.storage().instance().set(&POOL_DATA, &pools);

        // Update user position
        let user = env.current_contract_address();
        let mut user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        let positions = user_positions.get(user.clone()).unwrap_or(Vec::new(&env));

        let mut updated_positions = Vec::new(&env);
        for position in positions.iter() {
            if position.pool_id == pool_id {
                let mut new_position = position.clone();
                new_position.liquidity -= liquidity;
                new_position.token_a_amount -= amount_a;
                new_position.token_b_amount -= amount_b;
                updated_positions.push_back(new_position);
            } else {
                updated_positions.push_back(position.clone());
            }
        }

        user_positions.set(user, updated_positions);
        env.storage()
            .instance()
            .set(&USER_POSITIONS, &user_positions);

        (amount_a, amount_b)
    }

    pub fn swap(env: Env, params: SwapParams) -> i64 {
        if env.ledger().timestamp() > params.deadline {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let pool_id = Self::get_pool_id_internal(&env, &params.token_in, &params.token_out);
        let mut pool = pools.get(pool_id).unwrap();

        let (reserve_in, reserve_out, token_in_is_a) = if pool.token_a == params.token_in {
            (pool.reserve_a, pool.reserve_b, true)
        } else {
            (pool.reserve_b, pool.reserve_a, false)
        };

        if reserve_in == 0 || reserve_out == 0 {
            panic_with_error!(&env, Error::InsufFunds);
        }

        // Calculate amount out with fees
        let amount_in_with_fee = params.amount_in * (10000 - pool.fee_rate) as i64 / 10000;
        let amount_out = (reserve_out * amount_in_with_fee) / (reserve_in + amount_in_with_fee);

        if amount_out < params.min_amount_out {
            panic_with_error!(&env, Error::InsufFunds);
        }

        // Update reserves
        if token_in_is_a {
            pool.reserve_a += params.amount_in;
            pool.reserve_b -= amount_out;
        } else {
            pool.reserve_b += params.amount_in;
            pool.reserve_a -= amount_out;
        }

        let mut pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        pools.set(pool_id, pool);
        env.storage().instance().set(&POOL_DATA, &pools);

        amount_out
    }

    pub fn get_pool(env: Env, pool_id: u64) -> Pool {
        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        pools.get(pool_id).unwrap()
    }

    pub fn get_user_positions(env: Env, user: Address) -> Vec<UserPosition> {
        let user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        user_positions.get(user).unwrap_or(Vec::new(&env))
    }

    fn get_pool_id_internal(env: &Env, token_a: &Address, token_b: &Address) -> u64 {
        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(env));
        for (id, pool) in pools.iter() {
            if (pool.token_a == *token_a && pool.token_b == *token_b)
                || (pool.token_a == *token_b && pool.token_b == *token_a)
            {
                return id;
            }
        }
        panic_with_error!(env, Error::NotFound);
    }

    fn sqrt(n: u64) -> u64 {
        if n == 0 {
            return 0;
        }

        let mut x = n;
        let mut y = x.div_ceil(2);
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }
}
