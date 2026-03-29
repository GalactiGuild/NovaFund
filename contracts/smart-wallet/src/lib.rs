#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env, Map,
    Vec, Symbol, Bytes, IntoVal,
};
use shared::Error;

#[cfg(test)]
mod tests;

const ADMIN: Symbol = symbol_short!("ADMIN");
const WALLET_OWNER: Symbol = symbol_short!("OWNER");
const GUARDIANS: Symbol = symbol_short!("GUARDS");
const THRESHOLD: Symbol = symbol_short!("THRESH");
const NONCE: Symbol = symbol_short!("NONCE");
const RECOVERY_REQUEST: Symbol = symbol_short!("RECOVER");

/// Guardian information
#[contracttype]
#[derive(Clone)]
pub struct Guardian {
    pub address: Address,
    pub added_at: u64,
}

/// Recovery request structure
#[contracttype]
#[derive(Clone)]
pub struct RecoveryRequest {
    pub new_owner: Address,
    pub requested_at: u64,
    pub approvals: Vec<Address>,
}

/// Smart wallet for account abstraction with social recovery
#[contract]
pub struct SmartWallet;

#[contractimpl]
impl SmartWallet {
    /// Initialize the smart wallet with an owner and minimum guardians
    pub fn initialize(
        env: Env,
        owner: Address,
        guardian_addresses: Vec<Address>,
        threshold: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&WALLET_OWNER) {
            return Err(Error::AlreadyInit);
        }

        // Validate inputs
        if guardian_addresses.len() < 3 {
            return Err(Error::InvInput);
        }

        if threshold == 0 || threshold > guardian_addresses.len() as u32 {
            return Err(Error::InvInput);
        }

        // Owner cannot be a guardian (separation of concerns)
        for guardian in guardian_addresses.iter() {
            if guardian == owner {
                return Err(Error::InvInput);
            }
        }

        owner.require_auth();

        // Store owner
        env.storage().instance().set(&WALLET_OWNER, &owner);

        // Store guardians
        let mut guardians = Map::<Address, Guardian>::new(&env);
        let timestamp = env.ledger().timestamp();
        for guardian in guardian_addresses.iter() {
            guardians.set(
                guardian.clone(),
                Guardian {
                    address: guardian.clone(),
                    added_at: timestamp,
                },
            );
        }
        env.storage().instance().set(&GUARDIANS, &guardians);

        // Store threshold
        env.storage().instance().set(&THRESHOLD, &threshold);

        // Initialize nonce
        env.storage().instance().set(&NONCE, &0u64);

        Ok(())
    }

    /// Execute a transaction on behalf of the wallet owner
    /// This enables account abstraction - the wallet can interact with other contracts
    pub fn execute(
        env: Env,
        to: Address,
        payload: Bytes,
        signature: Bytes,
    ) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&WALLET_OWNER)
            .ok_or(Error::NotInit)?;

        // Verify signature from owner
        // In production, this would verify ECDSA/Ed25519 signature
        // For now, we use Soroban's built-in auth
        owner.require_auth();

        // Increment nonce to prevent replay attacks
        let nonce: u64 = env.storage().instance().get(&NONCE).unwrap_or(0);
        env.storage().instance().set(&NONCE, &(nonce + 1));

        // Execute the payload by invoking the target contract
        // Note: In production, you'd properly deserialize and call the target
        env.invoke_contract::<()>(
            &to,
            &symbol_short!("exec"),
            soroban_sdk::vec![&env, payload.into_val(&env)],
        );

        Ok(())
    }

    /// Add a new guardian (requires owner approval)
    pub fn add_guardian(env: Env, guardian: Address) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&WALLET_OWNER)
            .ok_or(Error::NotInit)?;

        owner.require_auth();

        let mut guardians: Map<Address, Guardian> = env
            .storage()
            .instance()
            .get(&GUARDIANS)
            .ok_or(Error::NotInit)?;

        if guardians.contains_key(guardian.clone()) {
            return Err(Error::InvInput);
        }

        guardians.set(
            guardian.clone(),
            Guardian {
                address: guardian.clone(),
                added_at: env.ledger().timestamp(),
            },
        );

        env.storage().instance().set(&GUARDIANS, &guardians);

        Ok(())
    }

    /// Remove a guardian (requires owner approval)
    pub fn remove_guardian(env: Env, guardian: Address) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&WALLET_OWNER)
            .ok_or(Error::NotInit)?;

        owner.require_auth();

        let mut guardians: Map<Address, Guardian> = env
            .storage()
            .instance()
            .get(&GUARDIANS)
            .ok_or(Error::NotInit)?;

        if !guardians.contains_key(guardian.clone()) {
            return Err(Error::NotFound);
        }

        // Ensure we maintain minimum 3 guardians
        if guardians.len() <= 3 {
            return Err(Error::InvInput);
        }

        guardians.remove(guardian.clone());
        env.storage().instance().set(&GUARDIANS, &guardians);

        Ok(())
    }

    /// Initiate social recovery process
    /// A guardian starts the recovery by proposing a new owner
    pub fn initiate_recovery(env: Env, new_owner: Address) -> Result<(), Error> {
        let initiator = env.current_contract_address();

        // Verify initiator is a guardian
        let guardians: Map<Address, Guardian> = env
            .storage()
            .instance()
            .get(&GUARDIANS)
            .ok_or(Error::NotInit)?;

        if !guardians.contains_key(initiator.clone()) {
            return Err(Error::Unauthorized);
        }

        // Create recovery request
        let request = RecoveryRequest {
            new_owner: new_owner.clone(),
            requested_at: env.ledger().timestamp(),
            approvals: Vec::from_array(&env, [initiator]),
        };

        env.storage()
            .instance()
            .set(&RECOVERY_REQUEST, &request);

        Ok(())
    }

    /// Approve a recovery request
    /// Other guardians approve the recovery
    pub fn approve_recovery(env: Env) -> Result<(), Error> {
        let approver = env.current_contract_address();

        // Verify approver is a guardian
        let guardians: Map<Address, Guardian> = env
            .storage()
            .instance()
            .get(&GUARDIANS)
            .ok_or(Error::NotInit)?;

        if !guardians.contains_key(approver.clone()) {
            return Err(Error::Unauthorized);
        }

        // Get current recovery request
        let mut request: RecoveryRequest = env
            .storage()
            .instance()
            .get(&RECOVERY_REQUEST)
            .ok_or(Error::NotFound)?;

        // Check if already approved
        for approval in request.approvals.iter() {
            if approval == approver {
                return Err(Error::InvInput); // Already approved
            }
        }

        // Add approval
        request.approvals.push_back(approver.clone());
        env.storage().instance().set(&RECOVERY_REQUEST, &request);

        Ok(())
    }

    /// Execute recovery after reaching threshold
    /// Transfers ownership to the new owner
    pub fn execute_recovery(env: Env) -> Result<(), Error> {
        let executor = env.current_contract_address();

        // Get recovery request
        let request: RecoveryRequest = env
            .storage()
            .instance()
            .get(&RECOVERY_REQUEST)
            .ok_or(Error::NotFound)?;

        // Get threshold
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&THRESHOLD)
            .ok_or(Error::NotInit)?;

        // Check if threshold reached
        if request.approvals.len() < threshold {
            return Err(Error::InsufVote); // Not enough approvals
        }

        // Time lock: Recovery must be at least 48 hours old
        let time_lock_secs = 172800; // 48 hours
        let current_time = env.ledger().timestamp();
        if current_time < request.requested_at + time_lock_secs {
            return Err(Error::InvInput); // Too early
        }

        // Transfer ownership
        env.storage()
            .instance()
            .set(&WALLET_OWNER, &request.new_owner);

        // Clear recovery request
        env.storage().instance().remove(&RECOVERY_REQUEST);

        // Reset guardians (optional security measure)
        // New owner should add new guardians

        Ok(())
    }

    /// Cancel an active recovery request (owner only)
    pub fn cancel_recovery(env: Env) -> Result<(), Error> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&WALLET_OWNER)
            .ok_or(Error::NotInit)?;

        owner.require_auth();

        if !env.storage().instance().has(&RECOVERY_REQUEST) {
            return Err(Error::NotFound);
        }

        env.storage().instance().remove(&RECOVERY_REQUEST);

        Ok(())
    }

    /// Get wallet owner
    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().instance().get(&WALLET_OWNER)
    }

    /// Get all guardians
    pub fn get_guardians(env: Env) -> Vec<Guardian> {
        let guardians: Map<Address, Guardian> = env
            .storage()
            .instance()
            .get(&GUARDIANS)
            .unwrap_or(Map::new(&env));

        let mut result = Vec::new(&env);
        for guardian in guardians.values() {
            result.push_back(guardian);
        }
        result
    }

    /// Get recovery threshold
    pub fn get_threshold(env: Env) -> Option<u32> {
        env.storage().instance().get(&THRESHOLD)
    }

    /// Get current recovery request
    pub fn get_recovery_request(env: Env) -> Option<RecoveryRequest> {
        env.storage().instance().get(&RECOVERY_REQUEST)
    }

    /// Receive native tokens (XLM)
    pub fn receive(env: Env) -> Result<(), Error> {
        // Simple receive function - wallet can accept payments
        Ok(())
    }
}
