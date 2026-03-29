use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
pub enum IdentityStatus {
    Unverified,
    Verified,
    Suspended,
}

#[contracttype]
pub struct IdentityInfo {
    pub hash: BytesN<32>,
    pub status: IdentityStatus,
    pub tier: u32,
}

#[contracttype]
pub enum RegistryDataKey {
    Admin,
    Identity(Address), // User Address -> IdentityInfo
}

#[contract]
pub struct IdentityRegistryContract;

#[contractimpl]
impl IdentityRegistryContract {
    /// Initialize the registry with an admin address
    pub fn init_registry(env: Env, admin: Address) {
        if env.storage().instance().has(&RegistryDataKey::Admin) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage()
            .instance()
            .set(&RegistryDataKey::Admin, &admin);
    }

    /// Admin function to add or update an investor's KYC/AML info
    pub fn add(env: Env, admin: Address, user: Address, kyc_hash: BytesN<32>, tier: u32) {
        // Verify admin authorization
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&RegistryDataKey::Admin)
            .expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: Only admin can add identities");
        }
        admin.require_auth();

        // Ensure hash is not empty
        let zeros = BytesN::from_array(&env, &[0; 32]);
        if kyc_hash == zeros {
            panic!("Invalid hash: cannot be all zeros");
        }

        // Store the verification info
        let key = RegistryDataKey::Identity(user);
        let info = IdentityInfo {
            hash: kyc_hash,
            status: IdentityStatus::Verified,
            tier,
        };
        env.storage().persistent().set(&key, &info);
    }

    /// Admin function to remove an investor's KYC/AML verification status
    pub fn remove(env: Env, admin: Address, user: Address) {
        // Verify admin authorization
        let stored_admin: Address = env
            .storage()
            .instance()
            .get(&RegistryDataKey::Admin)
            .expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: Only admin can remove identities");
        }
        admin.require_auth();

        let key = RegistryDataKey::Identity(user);
        env.storage().persistent().remove(&key);
    }

    pub fn verify(env: Env, user: Address) -> bool {
        let key = RegistryDataKey::Identity(user);
        if let Some(info) = env.storage().persistent().get::<_, IdentityInfo>(&key) {
            return matches!(info.status, IdentityStatus::Verified) && info.tier > 0;
        }
        false
    }

    /// Publicly verifiable function to get a user's KYC tier
    pub fn get_registry_tier(env: Env, user: Address) -> u32 {
        let key = RegistryDataKey::Identity(user);
        if let Some(info) = env.storage().persistent().get::<_, IdentityInfo>(&key) {
            if matches!(info.status, IdentityStatus::Verified) {
                return info.tier;
            }
        }
        0
    }
}
