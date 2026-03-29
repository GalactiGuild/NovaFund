#![no_std]

use shared::types::MilestoneStatus;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Auditors,
    Quorum,
    // (project_id, milestone_id) -> Votes
    Votes(u64, u64),
    // Staking
    StakingToken,
    MinStake,
    LockupPeriod,
    Stakes(Address),
    UnstakeRequests(Address),
}

#[derive(Clone)]
#[contracttype]
pub struct Votes {
    pub approvals: Vec<Address>,
    pub rejections: Vec<Address>,
    pub finalized: bool,
}

#[derive(Clone, Default)]
#[contracttype]
pub struct UnstakeRequest {
    pub amount: i128,
    pub unlock_time: u64,
}

#[contract]
pub struct MilestoneOracle;

#[contractimpl]
impl MilestoneOracle {
    /// Initialize the contract with an admin and the required quorum (number of auditors).
    pub fn initialize(env: Env, admin: Address, quorum: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Quorum, &quorum);

        let empty_auditors: Vec<Address> = Vec::new(&env);
        env.storage().instance().set(&DataKey::Auditors, &empty_auditors);
    }

    /// Configure staking parameters. (Admin only)
    pub fn set_staking_config(
        env: Env,
        admin: Address,
        token: Address,
        min_stake: i128,
        lockup_period: u64,
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

        env.storage().instance().set(&DataKey::StakingToken, &token);
        env.storage().instance().set(&DataKey::MinStake, &min_stake);
        env.storage()
            .instance()
            .set(&DataKey::LockupPeriod, &lockup_period);
    }

    /// Add an auditor to the whitelist. (Admin only)
    pub fn add_auditor(env: Env, auditor: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let mut auditors: Vec<Address> = env.storage().instance().get(&DataKey::Auditors).unwrap();
        if auditors.contains(&auditor) {
            panic!("already auditor");
        }
        auditors.push_back(auditor);
        env.storage().instance().set(&DataKey::Auditors, &auditors);
    }

    /// Remove an auditor from the whitelist. (Admin only)
    pub fn remove_auditor(env: Env, auditor: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();

        let mut auditors: Vec<Address> = env.storage().instance().get(&DataKey::Auditors).unwrap();
        let index = auditors.first_index_of(&auditor).expect("not auditor");
        auditors.remove(index);
        env.storage().instance().set(&DataKey::Auditors, &auditors);
    }

    /// Deposit stake.
    pub fn deposit_stake(env: Env, auditor: Address, amount: i128) {
        auditor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingToken)
            .expect("staking not configured");
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(&auditor, &env.current_contract_address(), &amount);

        let mut current_stake: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes(auditor.clone()))
            .unwrap_or(0);
        current_stake += amount;
        env.storage()
            .persistent()
            .set(&DataKey::Stakes(auditor), &current_stake);
    }

    /// Request to unstake. Starts the lockup period.
    pub fn request_unstake(env: Env, auditor: Address, amount: i128) {
        auditor.require_auth();
        let mut current_stake: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes(auditor.clone()))
            .unwrap_or(0);

        if current_stake < amount {
            panic!("insufficient stake");
        }

        let lockup_period: u64 = env
            .storage()
            .instance()
            .get(&DataKey::LockupPeriod)
            .unwrap_or(0);
        let unlock_time = env.ledger().timestamp() + lockup_period;

        current_stake -= amount;
        env.storage()
            .persistent()
            .set(&DataKey::Stakes(auditor.clone()), &current_stake);

        let request = UnstakeRequest {
            amount,
            unlock_time,
        };
        env.storage()
            .persistent()
            .set(&DataKey::UnstakeRequests(auditor), &request);
    }

    /// Finalize withdrawal after lockup period.
    pub fn withdraw_stake(env: Env, auditor: Address) {
        auditor.require_auth();
        let request: UnstakeRequest = env
            .storage()
            .persistent()
            .get(&DataKey::UnstakeRequests(auditor.clone()))
            .expect("no unstake request");

        if env.ledger().timestamp() < request.unlock_time {
            panic!("lockup period not ended");
        }

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingToken)
            .expect("staking not configured");
        let token_client = token::Client::new(&env, &token_addr);

        token_client.transfer(&env.current_contract_address(), &auditor, &request.amount);

        env.storage()
            .persistent()
            .remove(&DataKey::UnstakeRequests(auditor));
    }

    /// Vote on a milestone. (Auditor only, requires minimum stake)
    pub fn vote(env: Env, auditor: Address, project_id: u64, milestone_id: u64, approve: bool) {
        auditor.require_auth();

        // Check if whitelisted
        let auditors: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Auditors)
            .expect("not initialized");
        if !auditors.contains(&auditor) {
            panic!("not whitelisted auditor");
        }

        // Check for minimum stake
        let current_stake: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Stakes(auditor.clone()))
            .unwrap_or(0);
        let min_stake: i128 = env.storage().instance().get(&DataKey::MinStake).unwrap_or(0);
        if current_stake < min_stake {
            panic!("insufficient stake to vote");
        }

        let key = DataKey::Votes(project_id, milestone_id);
        let mut votes: Votes = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Votes {
                approvals: Vec::new(&env),
                rejections: Vec::new(&env),
                finalized: false,
            });

        if votes.finalized {
            panic!("milestone already finalized");
        }

        if votes.approvals.contains(&auditor) || votes.rejections.contains(&auditor) {
            panic!("already voted");
        }

        if approve {
            votes.approvals.push_back(auditor);
        } else {
            votes.rejections.push_back(auditor);
        }

        let quorum: u32 = env.storage().instance().get(&DataKey::Quorum).unwrap();

        // Finalize if quorum reached
        if votes.approvals.len() >= quorum {
            votes.finalized = true;
            env.events().publish(
                (symbol_short!("milestone"), symbol_short!("approved")),
                (project_id, milestone_id),
            );
        } else if votes.rejections.len() >= quorum {
            votes.finalized = true;
            env.events().publish(
                (symbol_short!("milestone"), symbol_short!("rejected")),
                (project_id, milestone_id),
            );
        }

        env.storage().persistent().set(&key, &votes);
    }

    /// Get the current status of a milestone.
    pub fn get_milestone_status(env: Env, project_id: u64, milestone_id: u64) -> MilestoneStatus {
        let key = DataKey::Votes(project_id, milestone_id);
        let votes: Votes = env.storage().persistent().get(&key).unwrap_or(Votes {
            approvals: Vec::new(&env),
            rejections: Vec::new(&env),
            finalized: false,
        });

        if votes.finalized {
            let quorum: u32 = env.storage().instance().get(&DataKey::Quorum).unwrap();
            if votes.approvals.len() >= quorum {
                MilestoneStatus::Approved
            } else {
                MilestoneStatus::Rejected
            }
        } else if votes.approvals.len() > 0 || votes.rejections.len() > 0 {
            MilestoneStatus::Submitted // Effectively "In Voting"
        } else {
            MilestoneStatus::Pending
        }
    }

    /// Get details of votes for a milestone.
    pub fn get_votes(env: Env, project_id: u64, milestone_id: u64) -> Votes {
        env.storage()
            .persistent()
            .get(&DataKey::Votes(project_id, milestone_id))
            .unwrap_or(Votes {
                approvals: Vec::new(&env),
                rejections: Vec::new(&env),
                finalized: false,
            })
    }

    /// Get auditor's current stake.
    pub fn get_stake(env: Env, auditor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Stakes(auditor))
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup_test(env: &Env) -> (Address, MilestoneOracleClient, Address) {
        let admin = Address::generate(env);
        let contract_id = env.register_contract(None, MilestoneOracle);
        let client = MilestoneOracleClient::new(env, &contract_id);
        
        let token_admin = Address::generate(env);
        let token_id = env.register_stellar_asset_contract_v2(token_admin);
        let token_addr = token_id.address();
        
        client.initialize(&admin, &2);
        client.set_staking_config(&admin, &token_addr, &1000, &3600); // 1000 min stake, 1h lockup
        
        (admin, client, token_addr)
    }

    #[test]
    fn test_staking_and_voting() {
        let env = Env::default();
        env.mock_all_auths();
        let (_admin, client, token_addr) = setup_test(&env);
        let token_client = token::StellarAssetClient::new(&env, &token_addr);

        let a1 = Address::generate(&env);
        let a2 = Address::generate(&env);
        client.add_auditor(&a1);
        client.add_auditor(&a2);

        token_client.mint(&a1, &2000);
        token_client.mint(&a2, &2000);

        // Try voting without stake (should fail)
        // env.as_contract(&client.address, || { ... })

        // Deposit stake
        client.deposit_stake(&a1, &1000);
        client.deposit_stake(&a2, &1000);

        let p_id = 1;
        let m_id = 1;

        client.vote(&a1, &p_id, &m_id, &true);
        client.vote(&a2, &p_id, &m_id, &true);

        assert_eq!(client.get_milestone_status(&p_id, &m_id) as u32, MilestoneStatus::Approved as u32);
    }

    #[test]
    fn test_unstaking_lockup() {
        let env = Env::default();
        env.mock_all_auths();
        let (_admin, client, token_addr) = setup_test(&env);
        let token_client = token::StellarAssetClient::new(&env, &token_addr);

        let a1 = Address::generate(&env);
        token_client.mint(&a1, &1000);
        client.deposit_stake(&a1, &1000);

        env.ledger().set_timestamp(100);
        
        // Request unstake
        client.request_unstake(&a1, &1000);
        
        // Try withdraw immediately (should fail as lockup is 3600s)
        // client.withdraw_stake(&a1);

        // Fast forward 1 hour
        env.ledger().set_timestamp(100 + 3601);
        client.withdraw_stake(&a1);
        
        let token_balance = token::Client::new(&env, &token_addr).balance(&a1);
        assert_eq!(token_balance, 1000);
    }
}
