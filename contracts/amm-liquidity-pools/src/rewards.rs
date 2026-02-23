use crate::{Pool, UserPosition, ADMIN, POOL_DATA, USER_POSITIONS};
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, Symbol, Vec,
};

const FEE_ACCUMULATOR: Symbol = symbol_short!("FEE_ACC");
const REWARD_TOKEN: Symbol = symbol_short!("REW_TOKEN");
const REWARD_RATE: Symbol = symbol_short!("REW_RATE");
const LAST_REWARD_UPDATE: Symbol = symbol_short!("LAST_REW");

#[derive(Clone)]
#[contracttype]
pub struct FeeAccumulator {
    pub pool_id: u64,
    pub token_a_fees: i64,
    pub token_b_fees: i64,
    pub last_updated: u64,
}

#[contract]
pub struct RewardManager;

#[contractimpl]
impl RewardManager {
    pub fn initialize_rewards(env: Env, reward_token: Address, reward_rate: i64) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        env.storage().instance().set(&REWARD_TOKEN, &reward_token);
        env.storage().instance().set(&REWARD_RATE, &reward_rate);
        env.storage()
            .instance()
            .set(&LAST_REWARD_UPDATE, &env.ledger().timestamp());
    }

    pub fn claim_fees(env: Env, pool_id: u64) -> (i64, i64) {
        let user = env.current_contract_address();
        let user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        let positions = user_positions.get(user.clone()).unwrap_or(Vec::new(&env));

        let mut user_position = None;
        for position in positions.iter() {
            if position.pool_id == pool_id {
                user_position = Some(position.clone());
                break;
            }
        }

        let position = user_position.unwrap();

        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let pool = pools.get(pool_id).unwrap();

        let fee_accumulators: Map<u64, FeeAccumulator> = env
            .storage()
            .instance()
            .get(&FEE_ACCUMULATOR)
            .unwrap_or(Map::new(&env));
        let fee_acc = fee_accumulators.get(pool_id).unwrap_or(FeeAccumulator {
            pool_id,
            token_a_fees: 0,
            token_b_fees: 0,
            last_updated: env.ledger().timestamp(),
        });

        // Calculate user's share of fees
        let user_share_a = (position.liquidity * fee_acc.token_a_fees) / pool.total_liquidity;
        let user_share_b = (position.liquidity * fee_acc.token_b_fees) / pool.total_liquidity;

        // Update fee accumulator to subtract claimed fees
        let mut updated_fee_acc = fee_acc;
        updated_fee_acc.token_a_fees -= user_share_a;
        updated_fee_acc.token_b_fees -= user_share_b;
        updated_fee_acc.last_updated = env.ledger().timestamp();

        let mut fee_accumulators: Map<u64, FeeAccumulator> = env
            .storage()
            .instance()
            .get(&FEE_ACCUMULATOR)
            .unwrap_or(Map::new(&env));
        fee_accumulators.set(pool_id, updated_fee_acc);
        env.storage()
            .instance()
            .set(&FEE_ACCUMULATOR, &fee_accumulators);

        // Update user's last fee claim time
        let mut updated_positions = Vec::new(&env);
        for position in positions.iter() {
            if position.pool_id == pool_id {
                let mut new_position = position.clone();
                new_position.last_fee_claimed = env.ledger().timestamp();
                updated_positions.push_back(new_position);
            } else {
                updated_positions.push_back(position.clone());
            }
        }
        let mut user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        user_positions.set(user, updated_positions);
        env.storage()
            .instance()
            .set(&USER_POSITIONS, &user_positions);

        (user_share_a, user_share_b)
    }

    pub fn update_rewards(env: Env, pool_id: u64) {
        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let pool = pools.get(pool_id).unwrap();

        if pool.total_liquidity == 0 {
            return;
        }

        let last_update = env.storage().instance().get(&LAST_REWARD_UPDATE).unwrap();
        let current_time = env.ledger().timestamp();

        if current_time <= last_update {
            return;
        }

        let reward_rate: i64 = env.storage().instance().get(&REWARD_RATE).unwrap();
        let time_passed = current_time - last_update;
        let total_rewards: i64 = reward_rate * time_passed as i64;

        // Distribute rewards proportionally to liquidity providers
        let user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));

        for (_user, positions) in user_positions.iter() {
            for position in positions.iter() {
                if position.pool_id == pool_id {
                    let _user_reward: i64 =
                        (position.liquidity * total_rewards) / pool.total_liquidity;
                    // In a real implementation, you would transfer reward tokens here
                }
            }
        }

        env.storage()
            .instance()
            .set(&LAST_REWARD_UPDATE, &current_time);
    }

    pub fn accumulate_fees(env: Env, pool_id: u64, token_a_fees: i64, token_b_fees: i64) {
        let mut fee_accumulators: Map<u64, FeeAccumulator> = env
            .storage()
            .instance()
            .get(&FEE_ACCUMULATOR)
            .unwrap_or(Map::new(&env));
        let fee_acc = fee_accumulators.get(pool_id).unwrap_or(FeeAccumulator {
            pool_id,
            token_a_fees: 0,
            token_b_fees: 0,
            last_updated: env.ledger().timestamp(),
        });

        let mut updated_fee_acc = fee_acc;
        updated_fee_acc.token_a_fees += token_a_fees;
        updated_fee_acc.token_b_fees += token_b_fees;
        updated_fee_acc.last_updated = env.ledger().timestamp();

        fee_accumulators.set(pool_id, updated_fee_acc);
        env.storage()
            .instance()
            .set(&FEE_ACCUMULATOR, &fee_accumulators);
    }

    pub fn get_pending_fees(env: Env, pool_id: u64, user: Address) -> (i64, i64) {
        let user_positions: Map<Address, Vec<UserPosition>> = env
            .storage()
            .instance()
            .get(&USER_POSITIONS)
            .unwrap_or(Map::new(&env));
        let positions = user_positions.get(user).unwrap_or(Vec::new(&env));

        let mut user_position = None;
        for position in positions.iter() {
            if position.pool_id == pool_id {
                user_position = Some(position.clone());
                break;
            }
        }

        if user_position.is_none() {
            return (0, 0);
        }

        let position = user_position.unwrap();
        let pools: Map<u64, Pool> = env
            .storage()
            .instance()
            .get(&POOL_DATA)
            .unwrap_or(Map::new(&env));
        let pool = pools.get(pool_id).unwrap();

        let fee_accumulators: Map<u64, FeeAccumulator> = env
            .storage()
            .instance()
            .get(&FEE_ACCUMULATOR)
            .unwrap_or(Map::new(&env));
        let fee_acc = fee_accumulators.get(pool_id).unwrap_or(FeeAccumulator {
            pool_id,
            token_a_fees: 0,
            token_b_fees: 0,
            last_updated: env.ledger().timestamp(),
        });

        let user_share_a = (position.liquidity * fee_acc.token_a_fees) / pool.total_liquidity;
        let user_share_b = (position.liquidity * fee_acc.token_b_fees) / pool.total_liquidity;

        (user_share_a, user_share_b)
    }
}
