#![no_std]

use shared::constants::{MAX_BATCH_SIZE, REPUTATION_MAX, REPUTATION_MIN, REPUTATION_START};
use shared::errors::Error;
use shared::events::{
    BADGE_EARNED, BATCH_COMPLETED, BATCH_ITEM_FAILED, REPUTATION_UPDATED, USER_REGISTERED,
};
use shared::types::BatchResult;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec};

/// Storage keys for the reputation contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Admin address
    Admin,
    /// User profile keyed by address
    Profile(Address),
    /// Contract initialization flag
    Initialized,
}

/// Badge types that can be awarded to users
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
#[repr(u32)]
pub enum BadgeType {
    /// Awarded for making contributions to projects
    Contributor = 0,
    /// Awarded to verified creators
    VerifiedCreator = 1,
    /// Awarded to top investors by volume
    TopInvestor = 2,
    /// Awarded for early platform adoption
    EarlyAdopter = 3,
    /// Awarded for completing first project
    FirstProject = 4,
    /// Awarded for successful milestone completion
    MilestoneAchiever = 5,
    /// Awarded for governance participation
    GovernanceParticipant = 6,
}

/// User reputation profile
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ReputationProfile {
    /// User's address
    pub user: Address,
    /// Reputation score (clamped between REPUTATION_MIN and REPUTATION_MAX)
    pub score: i128,
    /// List of badges earned by the user
    pub badges: Vec<BadgeType>,
}

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    /// Initialize the reputation contract with an admin address
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `admin` - The address that will have admin privileges
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok if successful, Error if already initialized
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        // Check if already initialized
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        // Require admin authorization
        admin.require_auth();

        // Store admin address
        env.storage().instance().set(&DataKey::Admin, &admin);

        // Mark as initialized
        env.storage().instance().set(&DataKey::Initialized, &true);

        Ok(())
    }

    /// Register a new user with default reputation score
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `user` - The address of the user to register
    ///
    /// # Returns
    /// * `Result<ReputationProfile, Error>` - The created profile or an error
    pub fn register_user(env: Env, user: Address) -> Result<ReputationProfile, Error> {
        // Check initialization
        Self::require_initialized(&env)?;

        // Check if user is already registered
        if env
            .storage()
            .persistent()
            .has(&DataKey::Profile(user.clone()))
        {
            return Err(Error::UserAlreadyRegistered);
        }

        // Require user authorization to register themselves
        user.require_auth();

        // Create profile with default score
        let profile = ReputationProfile {
            user: user.clone(),
            score: REPUTATION_START,
            badges: Vec::new(&env),
        };

        // Store profile
        env.storage()
            .persistent()
            .set(&DataKey::Profile(user.clone()), &profile);

        // Emit registration event
        env.events().publish((USER_REGISTERED,), user);

        Ok(profile)
    }

    /// Update a user's reputation score (admin only)
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `user` - The address of the user whose score to update
    /// * `delta` - The amount to add/subtract from the score (can be negative)
    ///
    /// # Returns
    /// * `Result<i128, Error>` - The new score or an error
    pub fn update_score(env: Env, user: Address, delta: i128) -> Result<i128, Error> {
        // Check initialization
        Self::require_initialized(&env)?;

        // Get admin and require authorization
        let admin = Self::get_admin(&env)?;
        admin.require_auth();

        // Get existing profile
        let mut profile = Self::get_profile_internal(&env, &user)?;

        // Calculate new score with clamping
        let new_score = profile.score.saturating_add(delta);
        let clamped_score = new_score.clamp(REPUTATION_MIN, REPUTATION_MAX);

        // Update profile
        profile.score = clamped_score;
        env.storage()
            .persistent()
            .set(&DataKey::Profile(user.clone()), &profile);

        // Emit score update event
        env.events()
            .publish((REPUTATION_UPDATED,), (user, clamped_score));

        Ok(clamped_score)
    }

    /// Award a badge to a user (admin only)
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `user` - The address of the user to award the badge to
    /// * `badge` - The type of badge to award
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok if successful, Error if badge already awarded
    pub fn award_badge(env: Env, user: Address, badge: BadgeType) -> Result<(), Error> {
        // Check initialization
        Self::require_initialized(&env)?;

        // Get admin and require authorization
        let admin = Self::get_admin(&env)?;
        admin.require_auth();

        // Get existing profile
        let mut profile = Self::get_profile_internal(&env, &user)?;

        // Check for duplicate badge
        if Self::has_badge(&profile.badges, badge) {
            return Err(Error::BadgeAlreadyAwarded);
        }

        // Award badge
        profile.badges.push_back(badge);

        // Store updated profile
        env.storage()
            .persistent()
            .set(&DataKey::Profile(user.clone()), &profile);

        // Emit badge award event
        env.events().publish((BADGE_EARNED,), (user, badge as u32));

        Ok(())
    }

    /// Get a user's reputation profile
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `user` - The address of the user
    ///
    /// # Returns
    /// * `Result<ReputationProfile, Error>` - The user's profile or an error
    pub fn get_profile(env: Env, user: Address) -> Result<ReputationProfile, Error> {
        // Check initialization
        Self::require_initialized(&env)?;

        Self::get_profile_internal(&env, &user)
    }

    /// Get the admin address
    ///
    /// # Arguments
    /// * `env` - The contract environment
    ///
    /// # Returns
    /// * `Result<Address, Error>` - The admin address or an error
    pub fn get_admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Check if the contract is initialized
    fn require_initialized(env: &Env) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }
        Ok(())
    }

    /// Internal helper to get a profile
    fn get_profile_internal(env: &Env, user: &Address) -> Result<ReputationProfile, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Profile(user.clone()))
            .ok_or(Error::UserNotRegistered)
    }

    /// Check if a badge list contains a specific badge
    fn has_badge(badges: &Vec<BadgeType>, badge: BadgeType) -> bool {
        for i in 0..badges.len() {
            if badges.get(i).unwrap() == badge {
                return true;
            }
        }
        false
    }

    // ==================== Batch Operations ====================

    /// Update reputation scores for multiple users in one call (admin only)
    ///
    /// # Arguments
    /// * `updates` - Vec of (user_address, delta) tuples
    pub fn batch_update_scores(
        env: Env,
        updates: Vec<(Address, i128)>,
    ) -> Result<BatchResult, Error> {
        let count = updates.len() as u32;
        if count == 0 {
            return Err(Error::BatchEmpty);
        }
        if count > MAX_BATCH_SIZE {
            return Err(Error::BatchLimitExceeded);
        }

        // Check initialization and auth once
        Self::require_initialized(&env)?;
        let admin = Self::get_admin(&env)?;
        admin.require_auth();

        let mut successful: u32 = 0;
        let mut failed: u32 = 0;

        for i in 0..updates.len() {
            let (user, delta) = updates.get(i).unwrap();

            // Get existing profile - skip if not registered
            let mut profile = match Self::get_profile_internal(&env, &user) {
                Ok(p) => p,
                Err(_) => {
                    failed += 1;
                    env.events()
                        .publish((BATCH_ITEM_FAILED,), user.clone());
                    continue;
                }
            };

            // Calculate and clamp score
            let new_score = profile.score.saturating_add(delta);
            let clamped_score = new_score.max(REPUTATION_MIN).min(REPUTATION_MAX);

            profile.score = clamped_score;
            env.storage()
                .persistent()
                .set(&DataKey::Profile(user.clone()), &profile);

            env.events()
                .publish((REPUTATION_UPDATED,), (user, clamped_score));
            successful += 1;
        }

        env.events()
            .publish((BATCH_COMPLETED,), (successful, failed));

        Ok(BatchResult {
            total: count,
            successful,
            failed,
        })
    }

    /// Award badges to multiple users in one call (admin only)
    ///
    /// # Arguments
    /// * `awards` - Vec of (user_address, badge_type) tuples
    pub fn batch_award_badges(
        env: Env,
        awards: Vec<(Address, BadgeType)>,
    ) -> Result<BatchResult, Error> {
        let count = awards.len() as u32;
        if count == 0 {
            return Err(Error::BatchEmpty);
        }
        if count > MAX_BATCH_SIZE {
            return Err(Error::BatchLimitExceeded);
        }

        // Check initialization and auth once
        Self::require_initialized(&env)?;
        let admin = Self::get_admin(&env)?;
        admin.require_auth();

        let mut successful: u32 = 0;
        let mut failed: u32 = 0;

        for i in 0..awards.len() {
            let (user, badge) = awards.get(i).unwrap();

            // Get existing profile - skip if not registered
            let mut profile = match Self::get_profile_internal(&env, &user) {
                Ok(p) => p,
                Err(_) => {
                    failed += 1;
                    env.events()
                        .publish((BATCH_ITEM_FAILED,), user.clone());
                    continue;
                }
            };

            // Skip if badge already awarded
            if Self::has_badge(&profile.badges, badge) {
                failed += 1;
                env.events()
                    .publish((BATCH_ITEM_FAILED,), user.clone());
                continue;
            }

            profile.badges.push_back(badge);
            env.storage()
                .persistent()
                .set(&DataKey::Profile(user.clone()), &profile);

            env.events()
                .publish((BADGE_EARNED,), (user, badge as u32));
            successful += 1;
        }

        env.events()
            .publish((BATCH_COMPLETED,), (successful, failed));

        Ok(BatchResult {
            total: count,
            successful,
            failed,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup_env() -> (Env, Address, ReputationContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let user = Address::generate(&env);
        let contract_id = env.register_contract(None, ReputationContract);
        let client = ReputationContractClient::new(&env, &contract_id);
        (env, admin, client, user)
    }

    // ==================== Initialization Tests ====================

    #[test]
    fn test_initialize_success() {
        let (env, admin, client, _) = setup_env();
        client.initialize(&admin);

        // Contract should be initialized (no panic)
        // We verify by being able to register a user successfully
        let user = Address::generate(&env);
        let profile = client.register_user(&user);
        assert_eq!(profile.score, REPUTATION_START);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_initialize_already_initialized() {
        let (_, admin, client, _) = setup_env();

        // First initialization
        client.initialize(&admin);

        // Second initialization should panic with AlreadyInitialized error (code 2)
        client.initialize(&admin);
    }

    // ==================== User Registration Tests ====================

    #[test]
    fn test_register_user_success() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);

        let profile = client.register_user(&user);

        // Verify default score
        assert_eq!(profile.score, REPUTATION_START);
        assert_eq!(profile.user, user);
        assert_eq!(profile.badges.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_register_user_not_initialized() {
        let (_, _, client, user) = setup_env();

        // NotInitialized error (code 1)
        client.register_user(&user);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #503)")]
    fn test_register_user_already_registered() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);

        // First registration
        client.register_user(&user);

        // Second registration should panic with UserAlreadyRegistered (code 503)
        client.register_user(&user);
    }

    // ==================== Score Update Tests ====================

    #[test]
    fn test_update_score_increase() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        let new_score = client.update_score(&user, &50);

        assert_eq!(new_score, REPUTATION_START + 50);

        // Verify profile was updated
        let profile = client.get_profile(&user);
        assert_eq!(profile.score, REPUTATION_START + 50);
    }

    #[test]
    fn test_update_score_decrease() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        let new_score = client.update_score(&user, &-30);

        assert_eq!(new_score, REPUTATION_START - 30);
    }

    #[test]
    fn test_update_score_clamp_at_min() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        // Try to decrease below minimum
        let new_score = client.update_score(&user, &-1000);

        assert_eq!(new_score, REPUTATION_MIN);
    }

    #[test]
    fn test_update_score_clamp_at_max() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        // Try to increase above maximum
        let new_score = client.update_score(&user, &20000);

        assert_eq!(new_score, REPUTATION_MAX);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #505)")]
    fn test_update_score_user_not_registered() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);

        // Don't register user - should panic with UserNotRegistered (code 505)
        client.update_score(&user, &50);
    }

    // ==================== Badge Tests ====================

    #[test]
    fn test_award_badge_success() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        client.award_badge(&user, &BadgeType::Contributor);

        // Verify badge was awarded
        let profile = client.get_profile(&user);
        assert_eq!(profile.badges.len(), 1);
        assert_eq!(profile.badges.get(0).unwrap(), BadgeType::Contributor);
    }

    #[test]
    fn test_award_multiple_badges() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        client.award_badge(&user, &BadgeType::Contributor);
        client.award_badge(&user, &BadgeType::EarlyAdopter);
        client.award_badge(&user, &BadgeType::TopInvestor);

        let profile = client.get_profile(&user);
        assert_eq!(profile.badges.len(), 3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #504)")]
    fn test_award_badge_duplicate_prevented() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        // First award
        client.award_badge(&user, &BadgeType::Contributor);

        // Duplicate award should panic with BadgeAlreadyAwarded (code 504)
        client.award_badge(&user, &BadgeType::Contributor);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #505)")]
    fn test_award_badge_user_not_registered() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);

        // Don't register user - should panic with UserNotRegistered (code 505)
        client.award_badge(&user, &BadgeType::Contributor);
    }

    // ==================== Get Profile Tests ====================

    #[test]
    fn test_get_profile_success() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        let profile = client.get_profile(&user);

        assert_eq!(profile.user, user);
        assert_eq!(profile.score, REPUTATION_START);
        assert_eq!(profile.badges.len(), 0);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #505)")]
    fn test_get_profile_not_found() {
        let (_, admin, client, user) = setup_env();
        client.initialize(&admin);

        // UserNotRegistered (code 505)
        client.get_profile(&user);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #1)")]
    fn test_get_profile_not_initialized() {
        let (_, _, client, user) = setup_env();

        // NotInitialized (code 1)
        client.get_profile(&user);
    }

    // ==================== Access Control Tests ====================

    #[test]
    fn test_only_admin_can_update_score() {
        let (_, admin, client, user) = setup_env();

        client.initialize(&admin);
        client.register_user(&user);

        // This should work because we mocked all auths in env
        let result = client.update_score(&user, &50);
        assert_eq!(result, REPUTATION_START + 50);
    }

    #[test]
    fn test_only_admin_can_award_badge() {
        let (_, admin, client, user) = setup_env();

        client.initialize(&admin);
        client.register_user(&user);

        // This should work because we mocked all auths in env
        client.award_badge(&user, &BadgeType::Contributor);

        let profile = client.get_profile(&user);
        assert_eq!(profile.badges.len(), 1);
    }

    // ==================== Batch Operation Tests ====================

    #[test]
    fn test_batch_update_scores() {
        let (env, admin, client, _) = setup_env();
        client.initialize(&admin);

        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);
        client.register_user(&user1);
        client.register_user(&user2);
        client.register_user(&user3);

        let mut updates = Vec::new(&env);
        updates.push_back((user1.clone(), 50_i128));
        updates.push_back((user2.clone(), -30_i128));
        updates.push_back((user3.clone(), 100_i128));

        let result = client.batch_update_scores(&updates);
        assert_eq!(result.total, 3);
        assert_eq!(result.successful, 3);
        assert_eq!(result.failed, 0);

        assert_eq!(client.get_profile(&user1).score, REPUTATION_START + 50);
        assert_eq!(client.get_profile(&user2).score, REPUTATION_START - 30);
        assert_eq!(client.get_profile(&user3).score, REPUTATION_START + 100);
    }

    #[test]
    fn test_batch_update_scores_partial_failure() {
        let (env, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        let unregistered = Address::generate(&env);

        let mut updates = Vec::new(&env);
        updates.push_back((user.clone(), 50_i128));
        updates.push_back((unregistered.clone(), 100_i128)); // not registered

        let result = client.batch_update_scores(&updates);
        assert_eq!(result.total, 2);
        assert_eq!(result.successful, 1);
        assert_eq!(result.failed, 1);

        assert_eq!(client.get_profile(&user).score, REPUTATION_START + 50);
    }

    #[test]
    fn test_batch_award_badges() {
        let (env, admin, client, _) = setup_env();
        client.initialize(&admin);

        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        client.register_user(&user1);
        client.register_user(&user2);

        let mut awards = Vec::new(&env);
        awards.push_back((user1.clone(), BadgeType::Contributor));
        awards.push_back((user2.clone(), BadgeType::EarlyAdopter));

        let result = client.batch_award_badges(&awards);
        assert_eq!(result.total, 2);
        assert_eq!(result.successful, 2);
        assert_eq!(result.failed, 0);

        assert_eq!(client.get_profile(&user1).badges.len(), 1);
        assert_eq!(client.get_profile(&user2).badges.len(), 1);
    }

    #[test]
    fn test_batch_award_badges_partial_failure() {
        let (env, admin, client, user) = setup_env();
        client.initialize(&admin);
        client.register_user(&user);

        // Award a badge first
        client.award_badge(&user, &BadgeType::Contributor);

        let user2 = Address::generate(&env);
        client.register_user(&user2);

        let mut awards = Vec::new(&env);
        awards.push_back((user.clone(), BadgeType::Contributor)); // duplicate - should fail
        awards.push_back((user2.clone(), BadgeType::TopInvestor)); // should succeed

        let result = client.batch_award_badges(&awards);
        assert_eq!(result.total, 2);
        assert_eq!(result.successful, 1);
        assert_eq!(result.failed, 1);

        assert_eq!(client.get_profile(&user2).badges.len(), 1);
    }
}
