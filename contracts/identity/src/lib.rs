#![no_std]

use shared::types::Jurisdiction;
use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, Env};

/// Verification status for a specific user and jurisdiction
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct IdentityRecord {
    pub is_verified: bool,
    pub verified_at: u64,
    pub proof_hash: soroban_sdk::BytesN<32>,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Verification(Address, Jurisdiction), // (Address, Jurisdiction) -> IdentityRecord
}

#[contract]
pub struct IdentityContract;

#[contractimpl]
impl IdentityContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Verifies a zk-SNARK proof and records the user as verified for a jurisdiction
    pub fn verify_identity(
        env: Env,
        user: Address,
        jurisdiction: Jurisdiction,
        proof: Bytes,
        public_inputs: Bytes,
    ) {
        user.require_auth();

        // Simulate zk-SNARK Groth16 verification here.
        // In a full implementation, this would call a compiled circom2soroban verifier
        // e.g., `let is_valid = groth16_verify(proof, public_inputs, verification_key);`
        // For now, we accept any non-empty proof.
        if proof.is_empty() {
            panic!("Invalid proof");
        }

        let record = IdentityRecord {
            is_verified: true,
            verified_at: env.ledger().timestamp(),
            proof_hash: env.crypto().sha256(&proof).into(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Verification(user, jurisdiction), &record);
    }

    /// Checks if a user is verified for a specific jurisdiction
    pub fn is_verified(env: Env, user: Address, jurisdiction: Jurisdiction) -> bool {
        let key = DataKey::Verification(user, jurisdiction);
        if let Some(record) = env.storage().persistent().get::<_, IdentityRecord>(&key) {
            record.is_verified
        } else {
            false
        }
    }

    /// Admin function to revoke verification
    pub fn revoke_verification(env: Env, user: Address, jurisdiction: Jurisdiction) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Verification(user, jurisdiction);
        if let Some(mut record) = env.storage().persistent().get::<_, IdentityRecord>(&key) {
            record.is_verified = false;
            env.storage().persistent().set(&key, &record);
        }
    }
}

mod test;
