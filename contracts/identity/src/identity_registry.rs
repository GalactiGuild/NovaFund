use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
pub enum RegistryDataKey {
    Admin,
    Identity(Address), // User Address -> BytesN<32> (KYC Hash)
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
        env.storage().instance().set(&RegistryDataKey::Admin, &admin);
    }

    /// Admin function to add or update an investor's KYC/AML hash
    pub fn add(env: Env, admin: Address, user: Address, kyc_hash: BytesN<32>) {
        // Verify admin authorization
        let stored_admin: Address = env.storage().instance().get(&RegistryDataKey::Admin).expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: Only admin can add identities");
        }
        admin.require_auth();

        // Ensure hash is not empty
        let zeros = BytesN::from_array(&env, &[0; 32]);
        if kyc_hash == zeros {
            panic!("Invalid hash: cannot be all zeros");
        }

        // Store the verification hash
        let key = RegistryDataKey::Identity(user);
        env.storage().persistent().set(&key, &kyc_hash);
    }

    /// Admin function to remove an investor's KYC/AML verification status
    pub fn remove(env: Env, admin: Address, user: Address) {
        // Verify admin authorization
        let stored_admin: Address = env.storage().instance().get(&RegistryDataKey::Admin).expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: Only admin can remove identities");
        }
        admin.require_auth();

        let key = RegistryDataKey::Identity(user);
        env.storage().persistent().remove(&key);
    }

    /// Publicly verifiable function to check if a user is verified
    /// Returns true if the user has a stored, non-zero KYC hash.
    pub fn verify(env: Env, user: Address) -> bool {
        let key = RegistryDataKey::Identity(user);
        if let Some(hash) = env.storage().persistent().get::<_, BytesN<32>>(&key) {
            let zeros = BytesN::from_array(&env, &[0; 32]);
            return hash != zeros;
        }
        false
    }
}
