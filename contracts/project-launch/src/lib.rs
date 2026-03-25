#![no_std]

mod rwa_metadata;

use soroban_sdk::{
    contract, contractimpl, contracttype, token::TokenClient, Address, Bytes, Env, String,
};

use shared::{
    constants::{
        MAX_PROJECT_DURATION, MIN_CONTRIBUTION, MIN_FUNDING_GOAL, MIN_PROJECT_DURATION,
        RESUME_TIME_DELAY, UPGRADE_TIME_LOCK_SECS, KYC_TIER_1_LIMIT,
    },
    errors::Error,
    events::{
        CONTRACT_PAUSED, CONTRACT_RESUMED, CONTRIBUTION_MADE, PROJECT_CREATED, PROJECT_FAILED,
        REFUND_ISSUED, RWA_METADATA_UPDATED, UPGRADE_CANCELLED, UPGRADE_EXECUTED,
        UPGRADE_SCHEDULED,
    },
    types::{Jurisdiction, PauseState, PendingUpgrade},
    utils::verify_future_timestamp,
};
use soroban_sdk::BytesN;

use crate::rwa_metadata::{read_rwa_metadata_cid, write_rwa_metadata_cid};

// Interface for IdentityContract
#[soroban_sdk::contractclient(name = "IdentityContractClient")]
pub trait IdentityContractTrait {
    fn is_verified(env: Env, user: Address, jurisdiction: Jurisdiction) -> bool;
    fn get_tier(env: Env, user: Address, jurisdiction: Jurisdiction) -> u32;
}

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
    RefundProcessed = 4,    // (DataKey::RefundProcessed, project_id, contributor) -> bool
    ProjectFailureProcessed = 5, // (DataKey::ProjectFailureProcessed, project_id) -> bool
    IdentityContract = 6,   // Address of the Identity Verification contract
    ProjectJurisdictions = 7, // (DataKey::ProjectJurisdictions, project_id) -> Vec<Jurisdiction>
    PauseState = 8,
    PendingUpgrade = 9,
    RwaMetadataCid = 10, // (DataKey::RwaMetadataCid, project_id) -> String
}

#[contract]
pub struct ProjectLaunch;

#[contractimpl]
impl ProjectLaunch {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInit);
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::NextProjectId, &0u64);

        Ok(())
    }

    /// Set the identity verification contract address
    pub fn set_identity_contract(env: Env, identity_contract: Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;

        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::IdentityContract, &identity_contract);

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
        jurisdictions: Option<soroban_sdk::Vec<Jurisdiction>>,
    ) -> Result<u64, Error> {
        if Self::get_is_paused(env.clone()) {
            return Err(Error::Paused);
        }
        // Validate funding goal
        if funding_goal < MIN_FUNDING_GOAL {
            return Err(Error::InvInput);
        }

        // Validate deadline
        let current_time = env.ledger().timestamp();
        let duration = deadline.saturating_sub(current_time);

        if !(MIN_PROJECT_DURATION..=MAX_PROJECT_DURATION).contains(&duration) {
            return Err(Error::InvInput);
        }

        if !verify_future_timestamp(&env, deadline) {
            return Err(Error::InvInput);
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

        if let Some(jurisdictions) = jurisdictions {
            env.storage()
                .instance()
                .set(&(DataKey::ProjectJurisdictions, project_id), &jurisdictions);
        }

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
        if Self::get_is_paused(env.clone()) {
            return Err(Error::Paused);
        }
        // Validate contribution amount
        if amount < MIN_CONTRIBUTION {
            return Err(Error::InvInput);
        }
        contributor.require_auth();

        // Get project
        let mut project: Project = env
            .storage()
            .instance()
            .get(&(DataKey::Project, project_id))
            .ok_or(Error::NotFound)?;

        // Validate project status and deadline
        if project.status != ProjectStatus::Active {
            return Err(Error::ProjNotAct);
        }

        let current_time = env.ledger().timestamp();
        if current_time >= project.deadline {
            return Err(Error::DeadlinePass);
        }

        // Verify Identity if required
        if let Some(jurisdictions) = env
            .storage()
            .instance()
            .get::<_, soroban_sdk::Vec<Jurisdiction>>(&(DataKey::ProjectJurisdictions, project_id))
        {
            if let Some(identity_contract) = env
                .storage()
                .instance()
                .get::<_, Address>(&DataKey::IdentityContract)
            {
                let identity_client = IdentityContractClient::new(&env, &identity_contract);
                let mut user_tier = 0;
                for jurisdiction in jurisdictions.iter() {
                    let tier = identity_client.get_tier(&contributor, &jurisdiction);
                    if tier > user_tier {
                        user_tier = tier;
                    }
                }
                
                if user_tier == 0 {
                    return Err(Error::Unauthorized);
                }

                if user_tier == 1 {
                    let total_contributed = Self::get_user_contribution(env.clone(), project_id, contributor.clone());
                    if total_contributed + amount > KYC_TIER_1_LIMIT {
                        return Err(Error::Unauthorized);
                    }
                }
                // Tier 2 is unlimited
            } else {
                // If jurisdictions are required but no identity contract is set, fail safe.
                return Err(Error::Unauthorized);
            }
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
            .ok_or(Error::NotFound)
    }

    /// Store or replace the root IPFS CID for a project's legal and audit bundle.
    ///
    /// Only the project creator may update this pointer. The on-chain value stores
    /// just the current root CID so related documents can be appended off-chain
    /// without increasing contract storage usage.
    pub fn update_rwa_metadata(
        env: Env,
        project_id: u64,
        admin: Address,
        cid: String,
    ) -> Result<(), Error> {
        write_rwa_metadata_cid(&env, project_id, &admin, &cid)?;
        env.events()
            .publish((RWA_METADATA_UPDATED,), (project_id, admin, cid));
        Ok(())
    }

    /// Return the current root IPFS CID for a project's RWA legal metadata.
    pub fn get_rwa_metadata(env: Env, project_id: u64) -> Option<String> {
        read_rwa_metadata_cid(&env, project_id)
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

    /// Check if project deadline has passed and mark it as failed if funding goal not met
    /// This can be called by anyone to trigger the failure status update
    pub fn mark_project_failed(env: Env, project_id: u64) -> Result<(), Error> {
        // Get project
        let mut project: Project = env
            .storage()
            .instance()
            .get(&(DataKey::Project, project_id))
            .ok_or(Error::NotFound)?;

        let current_time = env.ledger().timestamp();

        // Check if deadline has passed
        if current_time <= project.deadline {
            return Err(Error::InvInput); // Deadline hasn't passed yet
        }

        // Check if project is already failed or completed
        if project.status == ProjectStatus::Failed || project.status == ProjectStatus::Completed {
            return Err(Error::InvStatus);
        }

        // Check if failure has already been processed
        if env
            .storage()
            .instance()
            .has(&(DataKey::ProjectFailureProcessed, project_id))
        {
            return Err(Error::InvStatus);
        }

        // Check if funding goal was met
        if project.total_raised >= project.funding_goal {
            // Project succeeded, mark as completed instead
            project.status = ProjectStatus::Completed;
        } else {
            // Project failed due to insufficient funding
            project.status = ProjectStatus::Failed;
            // Emit event to indicate project failure
            env.events().publish((PROJECT_FAILED,), project_id);
        }

        // Store updated project
        env.storage()
            .instance()
            .set(&(DataKey::Project, project_id), &project);

        // Mark that failure check has been processed
        env.storage()
            .instance()
            .set(&(DataKey::ProjectFailureProcessed, project_id), &true);

        Ok(())
    }

    /// Refund a specific contributor
    /// Can be called by the contributor or any permissionless caller
    pub fn refund_contributor(
        env: Env,
        project_id: u64,
        contributor: Address,
    ) -> Result<i128, Error> {
        // Get project
        let project: Project = env
            .storage()
            .instance()
            .get(&(DataKey::Project, project_id))
            .ok_or(Error::NotFound)?;

        // Ensure project is in failed state
        if project.status != ProjectStatus::Failed {
            return Err(Error::ProjNotAct);
        }

        // Check if refund has already been processed for this contributor
        let refund_key = (DataKey::RefundProcessed, project_id, contributor.clone());
        if env.storage().instance().has(&refund_key) {
            return Err(Error::InvInput); // Already refunded
        }

        // Get contribution amount
        let contribution_key = (DataKey::ContributionAmount, project_id, contributor.clone());
        let contribution_amount: i128 = env
            .storage()
            .persistent()
            .get(&contribution_key)
            .unwrap_or(0);

        if contribution_amount <= 0 {
            return Err(Error::InvInput); // No contribution to refund
        }

        // Transfer tokens back to contributor
        let token_client = TokenClient::new(&env, &project.token);
        token_client.transfer(
            &env.current_contract_address(),
            &contributor,
            &contribution_amount,
        );

        // Mark refund as processed
        env.storage().instance().set(&refund_key, &true);

        // Emit refund event
        env.events().publish(
            (REFUND_ISSUED,),
            (project_id, contributor, contribution_amount),
        );

        Ok(contribution_amount)
    }

    /// Check if a contributor has been refunded for a project
    pub fn is_refunded(env: Env, project_id: u64, contributor: Address) -> bool {
        let refund_key = (DataKey::RefundProcessed, project_id, contributor);
        env.storage().instance().has(&refund_key)
    }

    /// Check if project failure has been processed
    pub fn is_failure_processed(env: Env, project_id: u64) -> bool {
        env.storage()
            .instance()
            .has(&(DataKey::ProjectFailureProcessed, project_id))
    }

    // ---------- Pause (emergency) ----------
    /// Pause the contract. Admin only. Critical operations (create_project, contribute) are blocked.
    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        let now = env.ledger().timestamp();
        let state = PauseState {
            paused: true,
            paused_at: now,
            resume_not_before: now + RESUME_TIME_DELAY,
        };
        env.storage().instance().set(&DataKey::PauseState, &state);
        env.events().publish((CONTRACT_PAUSED,), (admin, now));
        Ok(())
    }

    /// Resume the contract. Admin only. Only allowed after RESUME_TIME_DELAY has passed.
    pub fn resume(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        let state: PauseState = env
            .storage()
            .instance()
            .get(&DataKey::PauseState)
            .unwrap_or(PauseState {
                paused: false,
                paused_at: 0,
                resume_not_before: 0,
            });
        let now = env.ledger().timestamp();
        if now < state.resume_not_before {
            return Err(Error::ResTooEarly);
        }
        let new_state = PauseState {
            paused: false,
            paused_at: state.paused_at,
            resume_not_before: state.resume_not_before,
        };
        env.storage()
            .instance()
            .set(&DataKey::PauseState, &new_state);
        env.events().publish((CONTRACT_RESUMED,), (admin, now));
        Ok(())
    }

    /// Returns whether the contract is currently paused.
    pub fn get_is_paused(env: Env) -> bool {
        let state: PauseState = env
            .storage()
            .instance()
            .get(&DataKey::PauseState)
            .unwrap_or(PauseState {
                paused: false,
                paused_at: 0,
                resume_not_before: 0,
            });
        state.paused
    }

    // ---------- Upgrade (time-locked, admin only) ----------
    /// Schedule an upgrade. Admin only. Upgrade can be executed after UPGRADE_TIME_LOCK_SECS (48h).
    pub fn schedule_upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        let now = env.ledger().timestamp();
        let pending = PendingUpgrade {
            wasm_hash: new_wasm_hash.clone(),
            execute_not_before: now + UPGRADE_TIME_LOCK_SECS,
        };
        env.storage()
            .instance()
            .set(&DataKey::PendingUpgrade, &pending);
        env.events().publish(
            (UPGRADE_SCHEDULED,),
            (admin, new_wasm_hash, pending.execute_not_before),
        );
        Ok(())
    }

    /// Execute a scheduled upgrade. Admin only. Contract must be paused. Callable only after time-lock.
    pub fn execute_upgrade(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        if !Self::get_is_paused(env.clone()) {
            return Err(Error::UpgReqPause);
        }
        let pending: PendingUpgrade = env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
            .ok_or(Error::UpgNotSched)?;
        let now = env.ledger().timestamp();
        if now < pending.execute_not_before {
            return Err(Error::UpgTooEarly);
        }
        env.deployer()
            .update_current_contract_wasm(pending.wasm_hash.clone());
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.events()
            .publish((UPGRADE_EXECUTED,), (admin, pending.wasm_hash));
        Ok(())
    }

    /// Cancel a scheduled upgrade. Admin only.
    pub fn cancel_upgrade(env: Env, admin: Address) -> Result<(), Error> {
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)?;
        if stored_admin != admin {
            return Err(Error::Unauthorized);
        }
        admin.require_auth();
        if !env.storage().instance().has(&DataKey::PendingUpgrade) {
            return Err(Error::UpgNotSched);
        }
        env.storage().instance().remove(&DataKey::PendingUpgrade);
        env.events().publish((UPGRADE_CANCELLED,), admin);
        Ok(())
    }

    /// Get pending upgrade info, if any.
    pub fn get_pending_upgrade(env: Env) -> Option<PendingUpgrade> {
        env.storage().instance().get(&DataKey::PendingUpgrade)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as TestAddress, Ledger},
        token, Address, Bytes, String,
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
            &None,
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
            &None,
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
            &None,
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
            &None,
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
    fn test_update_rwa_metadata_by_project_creator() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        client.mock_all_auths().initialize(&admin);

        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
        let project_id = client.mock_all_auths().create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
            &None,
        );

        assert_eq!(client.get_rwa_metadata(&project_id), None);

        let initial_cid = String::from_str(&env, "bafybeigdyrzt5legalrootcid");
        client
            .mock_all_auths()
            .update_rwa_metadata(&project_id, &creator, &initial_cid);

        assert_eq!(client.get_rwa_metadata(&project_id), Some(initial_cid));

        let updated_cid = String::from_str(&env, "bafybeih4auditbundleupdatedroot");
        client
            .mock_all_auths()
            .update_rwa_metadata(&project_id, &creator, &updated_cid);

        assert_eq!(client.get_rwa_metadata(&project_id), Some(updated_cid));
    }

    #[test]
    fn test_update_rwa_metadata_rejects_non_creator() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let intruder = Address::generate(&env);
        let token = Address::generate(&env);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        client.mock_all_auths().initialize(&admin);

        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
        let project_id = client.mock_all_auths().create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
            &None,
        );

        let cid = String::from_str(&env, "bafybeiforbiddenrootcid");
        let result = client
            .mock_all_auths()
            .try_update_rwa_metadata(&project_id, &intruder, &cid);

        // Soroban `try_` clients can surface contract failures either as an
        // invoke error (outer `Err`) or as a conversion failure (inner `Err`).
        assert!(result.is_err() || matches!(result, Ok(Err(_))));
        assert_eq!(client.get_rwa_metadata(&project_id), None);
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
            &None,
        );
    }

    #[test]
    fn test_mark_project_failed_insufficient_funding() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
        let token_admin = Address::generate(&env);
        let (token, _token_client, token_admin_client) = create_token_contract(&env, &token_admin);
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
            &None,
        );

        // Mint tokens and contribute less than goal
        token_admin_client.mint(&contributor, &50_0000000);
        client.contribute(&project_id, &contributor, &MIN_CONTRIBUTION);

        let project = client.get_project(&project_id);
        assert_eq!(project.status, ProjectStatus::Active);
        assert!(!client.is_failure_processed(&project_id));

        // Try to mark as failed before deadline - should fail
        let result = client.try_mark_project_failed(&project_id);
        assert!(result.is_err());

        // Move past deadline
        env.ledger().set_timestamp(deadline + 1);

        // Mark project as failed
        let result = client.try_mark_project_failed(&project_id);
        assert!(result.is_ok());
        assert!(client.is_failure_processed(&project_id));

        let project = client.get_project(&project_id);
        assert_eq!(project.status, ProjectStatus::Failed);

        // Try to mark as failed again - should fail
        let result = client.try_mark_project_failed(&project_id);
        assert!(result.is_err());
    }

    #[test]
    fn test_mark_project_completed_when_funded() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
        let token_admin = Address::generate(&env);
        let (token, _token_client, token_admin_client) = create_token_contract(&env, &token_admin);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        // Create project with funding goal of 1000 XLM
        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
        let project_id = client.create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
            &None,
        );

        // Mint tokens and contribute full amount (meets goal)
        let mint_amount = MIN_FUNDING_GOAL + 100_0000000;
        token_admin_client.mint(&contributor, &mint_amount);
        client.contribute(&project_id, &contributor, &MIN_FUNDING_GOAL);

        // Move past deadline
        env.ledger().set_timestamp(deadline + 1);

        // Mark project status
        client.mark_project_failed(&project_id);

        // Should be completed since goal was met
        let project = client.get_project(&project_id);
        assert_eq!(project.status, ProjectStatus::Completed);
    }

    #[test]
    fn test_refund_single_contributor() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
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
            &None,
        );

        // Mint tokens and contribute
        token_admin_client.mint(&contributor, &50_0000000);
        client.contribute(&project_id, &contributor, &MIN_CONTRIBUTION);

        let initial_balance = token_client.balance(&contributor);
        assert_eq!(initial_balance, 40_0000000); // 50 - 10

        // Move past deadline and mark as failed
        env.ledger().set_timestamp(deadline + 1);
        client.mark_project_failed(&project_id);

        // Refund contributor
        let refund_amount = client.refund_contributor(&project_id, &contributor);
        assert_eq!(refund_amount, MIN_CONTRIBUTION);

        // Verify tokens were returned
        let new_balance = token_client.balance(&contributor);
        assert_eq!(new_balance, 50_0000000); // Initial 50 restored

        // Verify refund was recorded
        assert!(client.is_refunded(&project_id, &contributor));

        // Try to refund again - should fail
        let result = client.try_refund_contributor(&project_id, &contributor);
        assert!(result.is_err());
    }

    #[test]
    fn test_refund_multiple_contributors() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor1 = Address::generate(&env);
        let contributor2 = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
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
            &None,
        );

        // Mint and contribute from multiple users
        token_admin_client.mint(&contributor1, &100_0000000);
        token_admin_client.mint(&contributor2, &100_0000000);

        let contrib1_amount = MIN_CONTRIBUTION;
        let contrib2_amount = MIN_CONTRIBUTION * 2;

        client.contribute(&project_id, &contributor1, &contrib1_amount);
        client.contribute(&project_id, &contributor2, &contrib2_amount);

        assert_eq!(
            token_client.balance(&contributor1),
            100_0000000 - contrib1_amount
        );
        assert_eq!(
            token_client.balance(&contributor2),
            100_0000000 - contrib2_amount
        );

        // Move past deadline and mark as failed
        env.ledger().set_timestamp(deadline + 1);
        client.mark_project_failed(&project_id);

        // Refund both contributors
        let refund1 = client.refund_contributor(&project_id, &contributor1);
        let refund2 = client.refund_contributor(&project_id, &contributor2);

        assert_eq!(refund1, contrib1_amount);
        assert_eq!(refund2, contrib2_amount);

        // Verify balances
        assert_eq!(token_client.balance(&contributor1), 100_0000000);
        assert_eq!(token_client.balance(&contributor2), 100_0000000);

        // Both should be marked as refunded
        assert!(client.is_refunded(&project_id, &contributor1));
        assert!(client.is_refunded(&project_id, &contributor2));
    }

    #[test]
    fn test_refund_no_contribution() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
        let token_admin = Address::generate(&env);
        let (token, _token_client, _token_admin_client) = create_token_contract(&env, &token_admin);
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
            &None,
        );

        // Move past deadline and mark as failed
        env.ledger().set_timestamp(deadline + 1);
        client.mark_project_failed(&project_id);

        // Try to refund someone with no contribution - should fail
        let result = client.try_refund_contributor(&project_id, &contributor);
        assert!(result.is_err());
    }

    #[test]
    fn test_refund_only_for_failed_projects() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor = Address::generate(&env);

        // Initialize
        client.initialize(&admin.clone());

        // Register token
        let token_admin = Address::generate(&env);
        let (token, _token_client, token_admin_client) = create_token_contract(&env, &token_admin);
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
            &None,
        );

        // Mint and contribute
        token_admin_client.mint(&contributor, &50_0000000);
        client.contribute(&project_id, &contributor, &MIN_CONTRIBUTION);

        // Try to refund while project active - should fail
        let result = client.try_refund_contributor(&project_id, &contributor);
        assert!(result.is_err());

        // Move past deadline but don't mark as failed
        env.ledger().set_timestamp(deadline + 1);

        // Still can't refund without marking failed
        let result = client.try_refund_contributor(&project_id, &contributor);
        assert!(result.is_err());
    }

    // ---------- Pause and upgrade ----------
    #[test]
    fn test_get_is_paused_defaults_to_false() {
        let env = Env::default();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        env.mock_all_auths();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        assert!(!client.get_is_paused());
    }

    #[test]
    fn test_pause_blocks_create_project_and_contribute() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let token = Address::generate(&env);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");
        client.initialize(&admin);
        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;

        client.pause(&admin);
        assert!(client.get_is_paused());

        let result = client.try_create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
            &None,
        );
        assert!(
            result.is_err(),
            "create_project should be blocked when paused"
        );
    }

    #[test]
    fn test_resume_after_time_delay_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        env.ledger().set_timestamp(1000);
        client.pause(&admin);
        env.ledger()
            .set_timestamp(1000 + shared::RESUME_TIME_DELAY + 1);
        let result = client.try_resume(&admin);
        assert!(result.is_ok());
        assert!(!client.get_is_paused());
    }

    #[test]
    fn test_schedule_upgrade_succeeds() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        env.ledger().set_timestamp(1000);
        let wasm_hash = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);
        let result = client.try_schedule_upgrade(&admin, &wasm_hash);
        assert!(result.is_ok());
        let pending = client.get_pending_upgrade();
        assert!(pending.is_some());
        assert_eq!(
            pending.unwrap().execute_not_before,
            1000 + shared::UPGRADE_TIME_LOCK_SECS
        );
    }

    #[test]
    fn test_execute_upgrade_too_early_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        env.ledger().set_timestamp(1000);
        let wasm_hash = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);
        client.schedule_upgrade(&admin, &wasm_hash);
        client.pause(&admin);
        env.ledger().set_timestamp(1000 + 3600);
        let result = client.try_execute_upgrade(&admin);
        assert!(result.is_err(), "execute_upgrade should fail before 48h");
    }

    #[test]
    fn test_cancel_upgrade_clears_pending() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        let wasm_hash = soroban_sdk::BytesN::from_array(&env, &[1u8; 32]);
        client.schedule_upgrade(&admin, &wasm_hash);
        assert!(client.get_pending_upgrade().is_some());
        client.cancel_upgrade(&admin);
        assert!(client.get_pending_upgrade().is_none());
    }

    #[test]
    fn test_contribute_tiered_kyc() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, ProjectLaunch);
        let client = ProjectLaunchClient::new(&env, &contract_id);

        let identity_contract_id = env.register_contract(None, identity::IdentityContract);
        let identity_client = identity::IdentityContractClient::new(&env, &identity_contract_id);

        let admin = Address::generate(&env);
        let creator = Address::generate(&env);
        let contributor_t1 = Address::generate(&env);
        let contributor_t2 = Address::generate(&env);
        let contributor_unverified = Address::generate(&env);

        client.initialize(&admin);
        client.set_identity_contract(&identity_contract_id);
        identity_client.initialize(&admin);

        // Register token
        let token_admin = Address::generate(&env);
        let (token, _token_client, token_admin_client) = create_token_contract(&env, &token_admin);
        let metadata_hash = Bytes::from_slice(&env, b"QmHash123");

        // Create project with jurisdiction requirement
        env.ledger().set_timestamp(1000000);
        let deadline = 1000000 + MIN_PROJECT_DURATION + 86400;
        let mut jurisdictions = soroban_sdk::Vec::new(&env);
        jurisdictions.push_back(Jurisdiction::Global); // Use global for simplicity

        let project_id = client.create_project(
            &creator,
            &MIN_FUNDING_GOAL,
            &deadline,
            &token,
            &metadata_hash,
            &Some(jurisdictions),
        );

        // Mint tokens
        token_admin_client.mint(&contributor_t1, &100_000000000);
        token_admin_client.mint(&contributor_t2, &200_000000000);
        token_admin_client.mint(&contributor_unverified, &100_000000000);

        // 1. Unverified user should fail
        let result = client.try_contribute(&project_id, &contributor_unverified, &MIN_CONTRIBUTION);
        assert!(result.is_err());

        // 2. Verify contributor_t1 as Tier 1
        let proof = Bytes::from_slice(&env, &[1, 2, 3]);
        let public_inputs = Bytes::from_slice(&env, &[0]);
        identity_client.verify_identity(&contributor_t1, &Jurisdiction::Global, &proof, &public_inputs, &1);

        // Tier 1 contribution within limit should succeed
        client.contribute(&project_id, &contributor_t1, &KYC_TIER_1_LIMIT); 

        // Next contribution should exceed limit
        let result = client.try_contribute(&project_id, &contributor_t1, &1);
        assert!(result.is_err());

        // 3. Verify contributor_t2 as Tier 2
        identity_client.verify_identity(&contributor_t2, &Jurisdiction::Global, &proof, &public_inputs, &2);

        // Tier 2 should have no limit (within project goals)
        client.contribute(&project_id, &contributor_t2, &(KYC_TIER_1_LIMIT + 1)); 
    }
}
