//! # Auto-Invest Pool Contract
//!
//! This contract allows users to deposit a lump sum which is automatically dripped into
//! new Real World Asset (RWA) projects matching their risk profile on a monthly basis.
//! The contract supports pause and withdraw functionality for users, and global pause
//! for admin emergency use.

#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    IntoVal, Symbol, Vec,
};

/// Approximately 30 days in seconds
pub const SECONDS_PER_MONTH: u64 = 2_592_000;

/// Maximum number of projects to invest in per drip cycle
pub const DEFAULT_MAX_PROJECTS_PER_DRIP: u32 = 5;

/// Risk levels for users and projects
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RiskLevel {
    Conservative = 0,
    Moderate = 1,
    Aggressive = 2,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    IsPaused,
    MaxProjectsPerDrip,
    RegisteredProjects, // Vec<Address>
    Project(Address),   // Address -> ProjectEntry
    Pool(Address),      // User Address -> PoolEntry
}

/// User's pool entry tracking their investment status
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolEntry {
    pub user: Address,
    pub total_deposited: i128,
    pub remaining_balance: i128,
    pub monthly_drip_amount: i128,
    pub risk_profile: RiskLevel,
    pub preferred_tags: Vec<Symbol>,
    pub is_paused: bool,
    pub last_drip_ledger: u64,
    pub invested_projects: Vec<Address>,
}

/// Project details in the registry
#[contracttype]
#[derive(Clone, Debug)]
pub struct ProjectEntry {
    pub project_address: Address,
    pub risk_level: RiskLevel,
    pub tags: Vec<Symbol>,
    pub is_active: bool,
    pub minimum_investment: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InsufficientBalance = 1,
    EntryAlreadyExists = 2,
    EntryNotFound = 3,
    NotAuthorised = 4,
    ContractPaused = 5,
    UserPaused = 6,
    DripCooldownNotMet = 7,
    NoEligibleProjects = 8,
    InvalidDepositAmount = 9,
    InvalidDripAmount = 10,
    ProjectNotFound = 11,
    ProjectAlreadyRegistered = 12,
    WithdrawalExceedsBalance = 13,
    NotInitialized = 14,
}

#[contract]
pub struct AutoInvestPool;

#[contractimpl]
impl AutoInvestPool {
    /// Initialize the contract with an admin address.
    ///
    /// # Parameters
    /// * `admin` - The address of the contract administrator.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::EntryAlreadyExists);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.storage()
            .instance()
            .set(&DataKey::MaxProjectsPerDrip, &DEFAULT_MAX_PROJECTS_PER_DRIP);
        env.storage()
            .instance()
            .set(&DataKey::RegisteredProjects, &Vec::<Address>::new(&env));
        Ok(())
    }

    /// Deposit funds into the auto-investment pool.
    ///
    /// # Parameters
    /// * `user` - The address of the depositing user.
    /// * `amount` - The full lump sum deposited in the pool's base token.
    /// * `risk_profile` - The user's risk tolerance level.
    /// * `preferred_tags` - A list of project tag identifiers to match against.
    /// * `monthly_drip_amount` - The calculated amount to invest per monthly cycle.
    /// * `token_address` - The address of the token contract.
    pub fn deposit(
        env: Env,
        user: Address,
        amount: i128,
        risk_profile: RiskLevel,
        preferred_tags: Vec<Symbol>,
        monthly_drip_amount: i128,
        token_address: Address,
    ) -> Result<(), Error> {
        if Self::is_globally_paused(&env) {
            return Err(Error::ContractPaused);
        }
        user.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidDepositAmount);
        }
        if monthly_drip_amount <= 0 || monthly_drip_amount > amount {
            return Err(Error::InvalidDripAmount);
        }
        if preferred_tags.is_empty() {
            return Err(Error::InvalidDripAmount);
        }

        let pool_key = DataKey::Pool(user.clone());
        if env.storage().persistent().has(&pool_key) {
            return Err(Error::EntryAlreadyExists);
        }

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        let entry = PoolEntry {
            user: user.clone(),
            total_deposited: amount,
            remaining_balance: amount,
            monthly_drip_amount,
            risk_profile,
            preferred_tags,
            is_paused: false,
            last_drip_ledger: env.ledger().timestamp(),
            invested_projects: Vec::new(&env),
        };

        env.storage().persistent().set(&pool_key, &entry);

        env.events().publish(
            (symbol_short!("deposit"), user),
            (amount, risk_profile, monthly_drip_amount),
        );

        Ok(())
    }

    /// Execute a monthly drip for a specific user.
    ///
    /// # Parameters
    /// * `user` - The address of the target user.
    ///
    /// # Returns
    /// * A list of project addresses invested in during this cycle.
    pub fn execute_drip(env: Env, user: Address) -> Result<Vec<Address>, Error> {
        if Self::is_globally_paused(&env) {
            return Err(Error::ContractPaused);
        }

        let pool_key = DataKey::Pool(user.clone());
        let mut entry: PoolEntry = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::EntryNotFound)?;

        if entry.is_paused {
            return Err(Error::UserPaused);
        }

        let current_time = env.ledger().timestamp();
        if current_time < entry.last_drip_ledger.saturating_add(SECONDS_PER_MONTH) {
            return Err(Error::DripCooldownNotMet);
        }

        if entry.remaining_balance < entry.monthly_drip_amount {
            return Err(Error::InsufficientBalance);
        }

        let eligible_projects = Self::match_projects(
            env.clone(),
            entry.risk_profile,
            entry.preferred_tags.clone(),
            entry.monthly_drip_amount,
        );

        if eligible_projects.is_empty() {
            entry.last_drip_ledger = current_time;
            env.storage().persistent().set(&pool_key, &entry);
            env.events()
                .publish((symbol_short!("skipped"), user), symbol_short!("no_match"));
            return Ok(Vec::new(&env));
        }

        let max_projects: u32 = env
            .storage()
            .instance()
            .get(&DataKey::MaxProjectsPerDrip)
            .unwrap_or(DEFAULT_MAX_PROJECTS_PER_DRIP);
        let num_to_invest = eligible_projects.len().min(max_projects);
        let drip_per_project = entry.monthly_drip_amount / (num_to_invest as i128);

        let mut invested_this_cycle = Vec::new(&env);
        let mut total_dripped: i128 = 0;

        for i in 0..num_to_invest {
            let project_addr = eligible_projects.get(i).unwrap();

            // Invoke 'invest' on project contract. (contract_addr, method_name, args)
            env.invoke_contract::<()>(
                &project_addr,
                &symbol_short!("invest"),
                (env.current_contract_address(), drip_per_project).into_val(&env),
            );

            invested_this_cycle.push_back(project_addr.clone());
            entry.invested_projects.push_back(project_addr);
            total_dripped += drip_per_project;
        }

        entry.remaining_balance -= total_dripped;
        entry.last_drip_ledger = current_time;
        env.storage().persistent().set(&pool_key, &entry);

        env.events().publish(
            (symbol_short!("drip_exe"), user),
            (total_dripped, invested_this_cycle.clone()),
        );

        Ok(invested_this_cycle)
    }

    /// Pause the user's auto-investment.
    pub fn pause(env: Env, user: Address) -> Result<(), Error> {
        user.require_auth();
        let pool_key = DataKey::Pool(user.clone());
        let mut entry: PoolEntry = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::EntryNotFound)?;

        entry.is_paused = true;
        env.storage().persistent().set(&pool_key, &entry);

        env.events().publish((symbol_short!("pause"), user), ());
        Ok(())
    }

    /// Resume the user's auto-investment.
    pub fn resume(env: Env, user: Address) -> Result<(), Error> {
        user.require_auth();
        let pool_key = DataKey::Pool(user.clone());
        let mut entry: PoolEntry = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::EntryNotFound)?;

        entry.is_paused = false;
        env.storage().persistent().set(&pool_key, &entry);

        env.events().publish((symbol_short!("resume"), user), ());
        Ok(())
    }

    /// Withdraw remaining balance from the pool.
    ///
    /// # Parameters
    /// * `user` - The address of the user.
    /// * `amount` - Optional partial withdrawal amount. If None, withdraws full balance.
    /// * `token_address` - The address of the token contract.
    pub fn withdraw(
        env: Env,
        user: Address,
        amount: Option<i128>,
        token_address: Address,
    ) -> Result<i128, Error> {
        user.require_auth();
        let pool_key = DataKey::Pool(user.clone());
        let mut entry: PoolEntry = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(Error::EntryNotFound)?;

        let withdraw_amount = amount.unwrap_or(entry.remaining_balance);
        if withdraw_amount > entry.remaining_balance {
            return Err(Error::WithdrawalExceedsBalance);
        }

        let token_client = token::Client::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &user, &withdraw_amount);

        entry.remaining_balance -= withdraw_amount;

        let total_withdrawn = withdraw_amount;
        if entry.remaining_balance == 0 {
            env.storage().persistent().remove(&pool_key);
        } else {
            env.storage().persistent().set(&pool_key, &entry);
        }

        env.events()
            .publish((symbol_short!("withdraw"), user), total_withdrawn);
        Ok(total_withdrawn)
    }

    /// Register a new RWA project. Admin only.
    pub fn register_project(
        env: Env,
        project_address: Address,
        risk_level: RiskLevel,
        tags: Vec<Symbol>,
        is_active: bool,
        minimum_investment: i128,
    ) -> Result<(), Error> {
        Self::check_admin(&env)?;

        let project_key = DataKey::Project(project_address.clone());
        if env.storage().persistent().has(&project_key) {
            return Err(Error::ProjectAlreadyRegistered);
        }

        let entry = ProjectEntry {
            project_address: project_address.clone(),
            risk_level,
            tags,
            is_active,
            minimum_investment,
        };

        let mut projects: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::RegisteredProjects)
            .unwrap_or(Vec::new(&env));
        projects.push_back(project_address.clone());

        env.storage()
            .instance()
            .set(&DataKey::RegisteredProjects, &projects);
        env.storage().persistent().set(&project_key, &entry);

        env.events()
            .publish((symbol_short!("proj_reg"), project_address), risk_level);
        Ok(())
    }

    /// Deregister a project by marking it inactive. Admin only.
    pub fn deregister_project(env: Env, project_address: Address) -> Result<(), Error> {
        Self::check_admin(&env)?;

        let project_key = DataKey::Project(project_address.clone());
        let mut entry: ProjectEntry = env
            .storage()
            .persistent()
            .get(&project_key)
            .ok_or(Error::ProjectNotFound)?;

        entry.is_active = false;
        env.storage().persistent().set(&project_key, &entry);

        env.events()
            .publish((symbol_short!("proj_der"), project_address), ());
        Ok(())
    }

    /// Globally pause the contract. Admin only.
    pub fn admin_pause_contract(env: Env) -> Result<(), Error> {
        Self::check_admin(&env)?;
        env.storage().instance().set(&DataKey::IsPaused, &true);
        env.events().publish((symbol_short!("adm_pau"),), ());
        Ok(())
    }

    /// Globally resume the contract. Admin only.
    pub fn admin_resume_contract(env: Env) -> Result<(), Error> {
        Self::check_admin(&env)?;
        env.storage().instance().set(&DataKey::IsPaused, &false);
        env.events().publish((symbol_short!("adm_res"),), ());
        Ok(())
    }

    /// Get user's pool entry.
    pub fn get_pool(env: Env, user: Address) -> Result<PoolEntry, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Pool(user))
            .ok_or(Error::EntryNotFound)
    }

    // Internal helpers

    fn check_admin(env: &Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotAuthorised)?;
        admin.require_auth();
        Ok(())
    }

    fn is_globally_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::IsPaused)
            .unwrap_or(false)
    }

    /// Pure matching function that returns projects filtered by risk and ranked by tag overlap.
    pub fn match_projects(
        env: Env,
        risk_profile: RiskLevel,
        preferred_tags: Vec<Symbol>,
        monthly_drip_amount: i128,
    ) -> Vec<Address> {
        let projects_list: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::RegisteredProjects)
            .unwrap_or(Vec::new(&env));
        let mut eligible_pairs = Vec::<(u32, Address)>::new(&env);

        for project_addr in projects_list.iter() {
            let entry: ProjectEntry = match env
                .storage()
                .persistent()
                .get(&DataKey::Project(project_addr.clone()))
            {
                Some(e) => e,
                None => continue,
            };

            // Hard filters
            if entry.risk_level > risk_profile {
                continue;
            }
            if !entry.is_active {
                continue;
            }
            if entry.minimum_investment > monthly_drip_amount {
                continue;
            }

            // Tag scoring
            let mut score: u32 = 0;
            for p_tag in entry.tags.iter() {
                for u_tag in preferred_tags.iter() {
                    if p_tag == u_tag {
                        score += 1;
                        break;
                    }
                }
            }

            eligible_pairs.push_back((score, project_addr));
        }

        // Simple bubble sort for ranking (descending score, stable for registration order)
        let mut ranked = eligible_pairs;
        let len = ranked.len();
        if len > 1 {
            for i in 0..len {
                for j in 0..len - 1 - i {
                    let a = ranked.get(j).unwrap();
                    let b = ranked.get(j + 1).unwrap();
                    if a.0 < b.0 {
                        ranked.set(j, b);
                        ranked.set(j + 1, a);
                    }
                }
            }
        }

        let mut result = Vec::new(&env);
        for pair in ranked.iter() {
            result.push_back(pair.1);
        }
        result
    }
}

mod test;
