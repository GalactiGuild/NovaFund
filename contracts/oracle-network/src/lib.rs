#![no_std]

use shared::{
    constants::{ORACLE_DEFAULT_HEARTBEAT, ORACLE_MAX_DEVIATION_BPS, ORACLE_MAX_ORACLES_PER_FEED},
    events::{
        ORACLE_FEED_CREATED, ORACLE_FEED_UPDATED, ORACLE_ORACLE_STAKED, ORACLE_ORACLE_UNSTAKED,
        ORACLE_SLASHED,
    },
    types::{Amount, OracleFeedConfig, OracleFeedState, OracleReport},
};
use soroban_sdk::{
    contract, contractimpl, contracttype, token::TokenClient, Address, Env, Symbol, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    StakingToken,
    RewardToken,
    FeedConfig(Symbol),
    FeedState(Symbol),
    FeedOracles(Symbol),
    FeedCurrentRound(Symbol),
    FeedCurrentReports(Symbol),
    OracleStake(Address),
    OraclePendingRewards(Address),
}

#[contract]
pub struct OracleNetwork;

#[contractimpl]
impl OracleNetwork {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            return;
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_tokens(env: Env, admin: Address, staking_token: Address, reward_token: Address) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if stored_admin != admin {
            panic!("unauthorized");
        }
        admin.require_auth();

        let storage = env.storage().instance();
        storage.set(&DataKey::StakingToken, &staking_token);
        storage.set(&DataKey::RewardToken, &reward_token);
    }

    pub fn create_feed(
        env: Env,
        admin: Address,
        feed_id: Symbol,
        config: OracleFeedConfig,
        oracles: Vec<Address>,
    ) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if stored_admin != admin {
            panic!("unauthorized");
        }
        admin.require_auth();

        if oracles.is_empty() {
            panic!("no oracles");
        }
        if oracles.len() > ORACLE_MAX_ORACLES_PER_FEED {
            panic!("too many oracles");
        }

        let storage = env.storage().instance();
        if storage.has(&DataKey::FeedConfig(feed_id.clone())) {
            panic!("feed exists");
        }

        let normalized = OracleFeedConfig {
            feed_type: config.feed_type,
            description: config.description,
            decimals: config.decimals,
            heartbeat_seconds: if config.heartbeat_seconds == 0 {
                ORACLE_DEFAULT_HEARTBEAT
            } else {
                config.heartbeat_seconds
            },
            deviation_bps: if config.deviation_bps == 0
                || config.deviation_bps > ORACLE_MAX_DEVIATION_BPS
            {
                ORACLE_MAX_DEVIATION_BPS
            } else {
                config.deviation_bps
            },
            min_oracles: if config.min_oracles == 0 {
                1
            } else {
                config.min_oracles
            },
            max_oracles: {
                let max = if config.max_oracles == 0
                    || config.max_oracles > ORACLE_MAX_ORACLES_PER_FEED
                {
                    ORACLE_MAX_ORACLES_PER_FEED
                } else {
                    config.max_oracles
                };
                if config.min_oracles > max {
                    config.min_oracles
                } else {
                    max
                }
            },
            reward_per_submission: config.reward_per_submission,
        };

        storage.set(&DataKey::FeedConfig(feed_id.clone()), &normalized);
        storage.set(&DataKey::FeedOracles(feed_id.clone()), &oracles);

        let empty_state = OracleFeedState {
            latest_value: 0,
            latest_round_id: 0,
            latest_timestamp: 0,
            latest_updated_at_ledger: 0,
        };
        storage.set(&DataKey::FeedState(feed_id.clone()), &empty_state);

        env.events().publish(
            (ORACLE_FEED_CREATED,),
            (feed_id, normalized.feed_type as u32),
        );
    }

    pub fn update_feed_oracles(env: Env, admin: Address, feed_id: Symbol, oracles: Vec<Address>) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if stored_admin != admin {
            panic!("unauthorized");
        }
        admin.require_auth();

        if oracles.is_empty() {
            panic!("no oracles");
        }
        if oracles.len() > ORACLE_MAX_ORACLES_PER_FEED {
            panic!("too many oracles");
        }

        let storage = env.storage().instance();
        if !storage.has(&DataKey::FeedConfig(feed_id.clone())) {
            panic!("unknown feed");
        }

        storage.set(&DataKey::FeedOracles(feed_id), &oracles);
    }

    pub fn stake(env: Env, oracle: Address, amount: Amount) {
        oracle.require_auth();
        if amount <= 0 {
            panic!("amount");
        }

        let staking_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingToken)
            .expect("staking token not set");

        let token_client = TokenClient::new(&env, &staking_token);
        token_client.transfer(&oracle, &env.current_contract_address(), &amount);

        let mut current: Amount = env
            .storage()
            .instance()
            .get(&DataKey::OracleStake(oracle.clone()))
            .unwrap_or(0);
        current += amount;
        env.storage()
            .instance()
            .set(&DataKey::OracleStake(oracle.clone()), &current);

        env.events()
            .publish((ORACLE_ORACLE_STAKED,), (oracle, amount));
    }

    pub fn unstake(env: Env, oracle: Address, amount: Amount) {
        oracle.require_auth();
        if amount <= 0 {
            panic!("amount");
        }

        let storage = env.storage().instance();
        let mut current: Amount = storage
            .get(&DataKey::OracleStake(oracle.clone()))
            .unwrap_or(0);
        if current < amount {
            panic!("insufficient stake");
        }
        current -= amount;
        storage.set(&DataKey::OracleStake(oracle.clone()), &current);

        let staking_token: Address = storage
            .get(&DataKey::StakingToken)
            .expect("staking token not set");
        let token_client = TokenClient::new(&env, &staking_token);
        token_client.transfer(&env.current_contract_address(), &oracle, &amount);

        env.events()
            .publish((ORACLE_ORACLE_UNSTAKED,), (oracle, amount));
    }

    pub fn submit(
        env: Env,
        feed_id: Symbol,
        value: Amount,
        reported_timestamp: u64,
        oracle: Address,
    ) {
        oracle.require_auth();

        let storage = env.storage().instance();
        let config: OracleFeedConfig = storage
            .get(&DataKey::FeedConfig(feed_id.clone()))
            .expect("unknown feed");
        let oracles: Vec<Address> = storage
            .get(&DataKey::FeedOracles(feed_id.clone()))
            .expect("no oracles");

        let mut is_oracle = false;
        for o in oracles.iter() {
            if o == oracle {
                is_oracle = true;
                break;
            }
        }
        if !is_oracle {
            panic!("not oracle");
        }

        let ledger_ts = env.ledger().timestamp();
        if reported_timestamp > ledger_ts + config.heartbeat_seconds {
            panic!("timestamp skew");
        }

        let current_round: u64 = storage
            .get(&DataKey::FeedCurrentRound(feed_id.clone()))
            .unwrap_or(0);
        let round_id = if current_round == 0 { 1 } else { current_round };

        let mut reports: Vec<OracleReport> = storage
            .get(&DataKey::FeedCurrentReports(feed_id.clone()))
            .unwrap_or(Vec::new(&env));

        for r in reports.iter() {
            if r.oracle == oracle {
                panic!("duplicate");
            }
        }

        let report = OracleReport {
            oracle: oracle.clone(),
            value,
        };
        reports.push_back(report);

        storage.set(&DataKey::FeedCurrentRound(feed_id.clone()), &round_id);
        storage.set(&DataKey::FeedCurrentReports(feed_id.clone()), &reports);

        if reports.len() >= config.min_oracles {
            let aggregated = aggregate_median(&env, &reports);

            let mut state: OracleFeedState = storage
                .get(&DataKey::FeedState(feed_id.clone()))
                .unwrap_or(OracleFeedState {
                    latest_value: 0,
                    latest_round_id: 0,
                    latest_timestamp: 0,
                    latest_updated_at_ledger: 0,
                });

            let next_round_id = state.latest_round_id + 1;
            state.latest_value = aggregated;
            state.latest_round_id = next_round_id;
            state.latest_timestamp = reported_timestamp;
            state.latest_updated_at_ledger = ledger_ts;
            storage.set(&DataKey::FeedState(feed_id.clone()), &state);

            storage.remove(&DataKey::FeedCurrentReports(feed_id.clone()));

            for r in reports.iter() {
                credit_reward(&env, &r.oracle, config.reward_per_submission);
            }

            env.events().publish(
                (ORACLE_FEED_UPDATED,),
                (feed_id, aggregated, next_round_id, reported_timestamp),
            );
        }
    }

    pub fn get_latest(env: Env, feed_id: Symbol) -> Option<OracleFeedState> {
        env.storage().instance().get(&DataKey::FeedState(feed_id))
    }

    pub fn get_latest_safe(
        env: Env,
        feed_id: Symbol,
        max_age_seconds: u64,
    ) -> Option<OracleFeedState> {
        let state: OracleFeedState = env.storage().instance().get(&DataKey::FeedState(feed_id))?;
        let now = env.ledger().timestamp();
        if now.saturating_sub(state.latest_timestamp) > max_age_seconds {
            return None;
        }
        Some(state)
    }

    pub fn get_latest_with_fallback(
        env: Env,
        primary_feed_id: Symbol,
        fallback_feed_id: Symbol,
        max_age_primary: u64,
        max_age_fallback: u64,
    ) -> Option<(OracleFeedState, Symbol)> {
        if let Some(primary) =
            Self::get_latest_safe(env.clone(), primary_feed_id.clone(), max_age_primary)
        {
            return Some((primary, primary_feed_id));
        }

        if let Some(fallback) =
            Self::get_latest_safe(env.clone(), fallback_feed_id.clone(), max_age_fallback)
        {
            return Some((fallback, fallback_feed_id));
        }

        None
    }

    pub fn claim_rewards(env: Env, oracle: Address) -> Amount {
        oracle.require_auth();
        let pending: Amount = env
            .storage()
            .instance()
            .get(&DataKey::OraclePendingRewards(oracle.clone()))
            .unwrap_or(0);
        if pending <= 0 {
            return 0;
        }

        let reward_token: Address = env
            .storage()
            .instance()
            .get(&DataKey::RewardToken)
            .expect("reward token not set");

        let token_client = TokenClient::new(&env, &reward_token);
        token_client.transfer(&env.current_contract_address(), &oracle, &pending);

        env.storage()
            .instance()
            .set(&DataKey::OraclePendingRewards(oracle.clone()), &0_i128);

        pending
    }

    pub fn slash(env: Env, admin: Address, oracle: Address, amount: Amount) {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        if stored_admin != admin {
            panic!("unauthorized");
        }
        admin.require_auth();

        if amount <= 0 {
            panic!("amount");
        }

        let storage = env.storage().instance();
        let mut stake: Amount = storage
            .get(&DataKey::OracleStake(oracle.clone()))
            .unwrap_or(0);
        if stake <= 0 {
            return;
        }
        let actual = if stake < amount { stake } else { amount };
        stake -= actual;
        storage.set(&DataKey::OracleStake(oracle.clone()), &stake);

        env.events().publish((ORACLE_SLASHED,), (oracle, actual));
    }

    pub fn get_stake(env: Env, oracle: Address) -> Amount {
        env.storage()
            .instance()
            .get(&DataKey::OracleStake(oracle))
            .unwrap_or(0)
    }

    pub fn get_pending_rewards(env: Env, oracle: Address) -> Amount {
        env.storage()
            .instance()
            .get(&DataKey::OraclePendingRewards(oracle))
            .unwrap_or(0)
    }
}

fn aggregate_median(env: &Env, reports: &Vec<OracleReport>) -> Amount {
    let len = reports.len();
    if len == 0 {
        return 0;
    }

    let mut values: Vec<Amount> = Vec::new(env);
    for r in reports.iter() {
        values.push_back(r.value);
    }

    // Simple insertion sort, len is expected to be small (<= ORACLE_MAX_ORACLES_PER_FEED)
    let n = values.len();
    let mut i = 1;
    while i < n {
        let key = values.get(i).unwrap();
        let mut j: i32 = i as i32 - 1;
        while j >= 0 {
            let vj = values.get(j as u32).unwrap();
            if vj <= key {
                break;
            }
            values.set(j as u32 + 1, vj);
            j -= 1;
        }
        values.set((j + 1) as u32, key);
        i += 1;
    }

    let mid = n / 2;
    values.get(mid).unwrap()
}

fn credit_reward(env: &Env, oracle: &Address, amount: Amount) {
    if amount <= 0 {
        return;
    }
    let mut current: Amount = env
        .storage()
        .instance()
        .get(&DataKey::OraclePendingRewards(oracle.clone()))
        .unwrap_or(0);
    current += amount;
    env.storage()
        .instance()
        .set(&DataKey::OraclePendingRewards(oracle.clone()), &current);
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::types::OracleFeedType;
    use soroban_sdk::{
        symbol_short,
        testutils::{Address as TestAddress, Ledger},
        token, String,
    };

    #[test]
    fn test_basic_flow() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let oracle1 = Address::generate(&env);
        let oracle2 = Address::generate(&env);

        let contract_id = env.register_contract(None, OracleNetwork);
        let client = OracleNetworkClient::new(&env, &contract_id);

        client.initialize(&admin);

        let staking_token_admin = Address::generate(&env);
        let staking_token_id = env.register_stellar_asset_contract_v2(staking_token_admin.clone());
        let staking_token = staking_token_id.address();
        let reward_token_admin = Address::generate(&env);
        let reward_token_id = env.register_stellar_asset_contract_v2(reward_token_admin.clone());
        let reward_token = reward_token_id.address();

        client.set_tokens(&admin, &staking_token, &reward_token);

        let feed_id = symbol_short!("BTC_USDC");
        let cfg = OracleFeedConfig {
            feed_type: OracleFeedType::Price,
            description: String::from_str(&env, "BTC/USDC price"),
            decimals: 8,
            heartbeat_seconds: ORACLE_DEFAULT_HEARTBEAT,
            deviation_bps: ORACLE_MAX_DEVIATION_BPS,
            min_oracles: 2,
            max_oracles: 2,
            reward_per_submission: 1_0000000,
        };

        let mut oracle_vec: Vec<Address> = Vec::new(&env);
        oracle_vec.push_back(oracle1.clone());
        oracle_vec.push_back(oracle2.clone());

        client.create_feed(&admin, &feed_id, &cfg, &oracle_vec);

        let staking_admin_client = token::StellarAssetClient::new(&env, &staking_token);
        staking_admin_client.mint(&oracle1, &10_0000000);
        staking_admin_client.mint(&oracle2, &10_0000000);

        client.stake(&oracle1, &5_0000000);
        client.stake(&oracle2, &5_0000000);

        env.ledger().set_timestamp(1_000_000);

        client.submit(&feed_id, &50_0000000, &1_000_000, &oracle1);
        client.submit(&feed_id, &51_0000000, &1_000_000, &oracle2);

        let state_opt = client.get_latest(&feed_id);
        assert!(state_opt.is_some());
        let state = state_opt.unwrap();
        assert_eq!(state.latest_round_id, 1);
        assert_eq!(state.latest_value, 51_0000000);

        let rewards1 = client.get_pending_rewards(&oracle1);
        let rewards2 = client.get_pending_rewards(&oracle2);
        assert_eq!(rewards1, cfg.reward_per_submission);
        assert_eq!(rewards2, cfg.reward_per_submission);
    }
}
