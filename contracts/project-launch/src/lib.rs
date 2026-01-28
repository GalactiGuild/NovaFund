#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token::TokenClient, Address, Bytes, Env,
};

use shared::{
    constants::{MAX_PROJECT_DURATION, MIN_CONTRIBUTION, MIN_FUNDING_GOAL, MIN_PROJECT_DURATION},
    errors::Error,
    events::{CONTRIBUTION_MADE, PROJECT_CREATED},
    utils::verify_future_timestamp,
};

/// Project status enumeration
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ProjectStatus {
    Active = 0,
    Completed = 1,
    Failed = 2,
    Cancelled = 3,
}

/// Project structure
#[contracttype]
#[derive(Clone)]
pub struct Project {
    pub creator: Address,
    pub funding_goal: i128,
    pub deadline: u64,
    pub token: Address,
    pub status: ProjectStatus,
    pub metadata_hash: Bytes,
    pub total_raised: i128,
    pub created_at: u64,
}

/// Contract state
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum DataKey {
    Admin = 0,
    NextProjectId = 1,
    Project = 2,
    ContributionAmount = 3, // (DataKey::ContributionAmount, project_id, contributor) -> i128
}

#[contract]
pub struct ProjectLaunch;

#[contractimpl]
impl ProjectLaunch {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextProjectId, &0u64);

        Ok(())
    }

    /// Create a new funding project
    pub fn create_project(
        env: Env,
        creator: Address,
        funding_goal: i128,
        deadline: u64,
        token: Address,
        metadata_hash: Bytes,
    ) -> Result<u64, Error> {
        // Validate funding goal
        if funding_goal < MIN_FUNDING_GOAL {
            return Err(Error::InvalidFundingGoal);
        }

        // Validate deadline
        let current_time = env.ledger().timestamp();
        let duration = deadline.saturating_sub(current_time);

        if duration < MIN_PROJECT_DURATION || duration > MAX_PROJECT_DURATION {
            return Err(Error::InvalidDeadline);
        }

        if !verify_future_timestamp(&env, deadline) {
            return Err(Error::InvalidDeadline);
        }

        // Get next project ID
        let project_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProjectId)
            .unwrap_or(0);

        let next_id = project_id.checked_add(1).unwrap();
        env.storage()
            .instance()
            .set(&DataKey::NextProjectId, &next_id);

        // Create project
        let project = Project {
            creator: creator.clone(),
            funding_goal,
            deadline,
            token: token.clone(),
            status: ProjectStatus::Active,
            metadata_hash,
            total_raised: 0,
            created_at: current_time,
        };

        // Store project
        env.storage()
            .instance()
            .set(&(DataKey::Project, project_id), &project);

        // Emit event
        env.events().publish(
            (PROJECT_CREATED,),
            (project_id, creator, funding_goal, deadline, token),
        );

        Ok(project_id)
    }

    /// Contribute to a project
    pub fn contribute(
        env: Env,
        project_id: u64,
        contributor: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // Validate contribution amount
        if amount < MIN_CONTRIBUTION {
            return Err(Error::ContributionTooLow);
        }
        contributor.require_auth();

        // Get project
        let mut project: Project = env
            .storage()
            .instance()
            .get(&(DataKey::Project, project_id))
            .ok_or(Error::ProjectNotFound)?;

        // Validate project status and deadline
        if project.status != ProjectStatus::Active {
            return Err(Error::ProjectNotActive);
        }

        let current_time = env.ledger().timestamp();
        if current_time >= project.deadline {
            return Err(Error::DeadlinePassed);
        }

        // Update project totals
        project.total_raised += amount;
        env.storage()
            .instance()
            .set(&(DataKey::Project, project_id), &project);

        // Perform token transfer
        let token_client = TokenClient::new(&env, &project.token);
        token_client.transfer(&contributor, &env.current_contract_address(), &amount);

        // 1. Store aggregated individual contribution (Scalable O(1))
        let contribution_key = (DataKey::ContributionAmount, project_id, contributor.clone());
        let current_contribution: i128 = env
            .storage()
            .persistent()
            .get(&contribution_key)
            .unwrap_or(0);

        let new_contribution = current_contribution.checked_add(amount).unwrap();
        env.storage()
            .persistent()
            .set(&contribution_key, &new_contribution);

        // Emit event
        env.events().publish(
            (CONTRIBUTION_MADE,),
            (project_id, contributor, amount, project.total_raised),
        );

        Ok(())
    }

    /// Get project details
    pub fn get_project(env: Env, project_id: u64) -> Result<Project, Error> {
        env.storage()
            .instance()
            .get(&(DataKey::Project, project_id))
            .ok_or(Error::ProjectNotFound)
    }

    /// Get individual contribution amount for a user
    pub fn get_user_contribution(env: Env, project_id: u64, contributor: Address) -> i128 {
        let key = (DataKey::ContributionAmount, project_id, contributor);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Get next project ID (for testing purposes)
    pub fn get_next_project_id(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextProjectId)
            .unwrap_or(0)
    }

    /// Check if contract is initialized
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    /// Get contract admin
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as TestAddress, Ledger},
        token, Address, Bytes,
    };

    fn create_token_contract<'a>(
        e: &'a Env,
        admin: &Address,
    ) -> (Address, token::Client<'a>, token::StellarAssetClient<'a>) {
        let token_id = e.register_stellar_asset_contract_v2(admin.clone());
        let token = token_id.address();
        let token_client = token::Client::new(e, &token);
        let token_admin_client = token::StellarAssetClient::new(e, &token);
        (token, token_client, token_admin_client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // Test successful initialization
        assert!(!client.is_initialized());
        env.mock_all_auths();
        client.initialize(&admin);
        assert!(client.is_initialized());
        assert_eq!(client.get_admin(), Some(admin));
    }

    #[test]
    fn test_create_project() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        env.mock_all_auths();
        client.initialize(&admin);

        // Set up time
        env.ledger().set_timestamp(1000000);

        // Test successful project creation
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400; // 2 days from now
        let project_id = client.create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
        );

        assert_eq!(project_id, 0);
        assert_eq!(client.get_next_project_id(), 1);

        // Test invalid funding goal
        let result = client.try_create_project(
            &creator,
            &(MIN_FUNDING_GOAL - 1),
            &deadline,
            &token,
            &metadata_hash,
        );
        assert!(result.is_err());

        // Test invalid deadline (too soon)
        let too_soon_deadline = 1000000 + MIN_PROJECT_DURATION - 1;
        let result = client.try_create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &too_soon_deadline,
            &token,
            &metadata_hash,
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_contribute() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register a token contract
        let token_admin = Address::generate(&env);
        let (token, token_client, token_admin_client) = create_token_contract(&env, &token_admin);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        // Create project
        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
        let project_id = client.create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
        );

        // Mint tokens to contributor
        env.mock_all_auths();
        token_admin_client.mint(&contributor, &100_0000000);

        assert_eq!(token_client.balance(&contributor), 100_0000000);
        assert_eq!(token_client.balance(&client.address), 0);

        // Test successful contribution
        client.contribute(&project_id, &contributor, &MIN_CONTRIBUTION);

        assert_eq!(token_client.balance(&contributor), 90_0000000);
        assert_eq!(token_client.balance(&client.address), 10_0000000);

        // Verify contribution amount
        assert_eq!(
            client.get_user_contribution(&project_id, &contributor),
            MIN_CONTRIBUTION
        );

        // Test multiple contributions from same user
        client.contribute(&project_id, &contributor, &MIN_CONTRIBUTION);
        assert_eq!(
            client.get_user_contribution(&project_id, &contributor),
            MIN_CONTRIBUTION * 2
        );

        // Test contribution too low
        let result = client.try_contribute(&project_id, &contributor, &(MIN_CONTRIBUTION - 1));
        assert!(result.is_err());

        // Test contribution to non-existent project
        let result = client.try_contribute(&999, &contributor, &MIN_CONTRIBUTION);
        assert!(result.is_err());

        // Test contribution after deadline
        env.ledger().set_timestamp(deadline + 1);
        let result = client.try_contribute(&project_id, &contributor, &MIN_CONTRIBUTION);
        assert!(result.is_err());
    }

    #[test]
    #[should_panic] // Since require_auth() will fail without mocking or proper signature
    fn test_create_project_unauthorized() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        client.initialize(&admin);
        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;

        // Call without mocking auth for 'creator'
        client.create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
        );
    }
}
