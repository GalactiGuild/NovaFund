//! NovaFund Treasury Management Contract
//!
//! Manages XLM/USDC platform reserves. All withdrawals require an approved
//! on-chain governance proposal (DAO-gated). Deposits are open to any caller.
//! Every withdrawal is recorded for audit purposes.

#![no_std]

use shared::errors::Error;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Bytes, Env, Vec,
};

#[cfg(test)]
mod tests;

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin / governance contract address
    Admin,
    /// Supported reserve token addresses (XLM native wrapper, USDC, …)
    SupportedTokens,
    /// Withdrawal record by sequential id
    Withdrawal(u64),
    /// Next withdrawal id counter
    NextWithdrawalId,
    /// Executed governance proposal ids (prevents replay)
    ProposalUsed(u64),
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Immutable record written for every withdrawal – the audit trail.
#[contracttype]
#[derive(Clone, Debug)]
pub struct WithdrawalRecord {
    /// Sequential id
    pub id: u64,
    /// Governance proposal that authorised this withdrawal
    pub proposal_id: u64,
    /// Token transferred
    pub token: Address,
    /// Destination address
    pub recipient: Address,
    /// Amount transferred (7-decimal Stellar units)
    pub amount: i128,
    /// Human-readable purpose / memo (IPFS hash or short label)
    pub memo: Bytes,
    /// Ledger timestamp at execution
    pub executed_at: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initialise the treasury.
    ///
    /// * `admin`            – governance contract (or multisig) that controls withdrawals
    /// * `supported_tokens` – initial list of accepted reserve tokens
    pub fn initialize(
        env: Env,
        admin: Address,
        supported_tokens: Vec<Address>,
    ) -> Result<(), Error> {
        admin.require_auth();

        let storage = env.storage().instance();
        if storage.has(&DataKey::Admin) {
            return Err(Error::AlreadyInit);
        }
        if supported_tokens.is_empty() {
            return Err(Error::InvInput);
        }

        storage.set(&DataKey::Admin, &admin);
        storage.set(&DataKey::SupportedTokens, &supported_tokens);
        storage.set(&DataKey::NextWithdrawalId, &0_u64);

        Ok(())
    }

    // -----------------------------------------------------------------------
    // Governance administration
    // -----------------------------------------------------------------------

    /// Replace the admin / governance address. Only the current admin may call this.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        let storage = env.storage().instance();
        let admin: Address = storage.get(&DataKey::Admin).ok_or(Error::NotInit)?;
        admin.require_auth();

        storage.set(&DataKey::Admin, &new_admin);
        env.events()
            .publish((symbol_short!("tr_admin"),), (admin, new_admin));
        Ok(())
    }

    /// Add a token to the supported-reserves list. Only admin.
    pub fn add_token(env: Env, token: Address) -> Result<(), Error> {
        let storage = env.storage().instance();
        let admin: Address = storage.get(&DataKey::Admin).ok_or(Error::NotInit)?;
        admin.require_auth();

        let mut tokens: Vec<Address> = storage
            .get(&DataKey::SupportedTokens)
            .ok_or(Error::NotInit)?;

        // Idempotent – skip if already present
        for i in 0..tokens.len() {
            if tokens.get(i).unwrap() == token {
                return Ok(());
            }
        }
        tokens.push_back(token.clone());
        storage.set(&DataKey::SupportedTokens, &tokens);

        env.events()
            .publish((symbol_short!("tr_tok_ad"),), (token,));
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Deposits (permissionless)
    // -----------------------------------------------------------------------

    /// Deposit `amount` of `token` into the treasury.
    ///
    /// Any address may fund the treasury; the caller must have approved the
    /// token transfer beforehand (standard SEP-41 allowance flow).
    pub fn deposit(env: Env, depositor: Address, token: Address, amount: i128) -> Result<(), Error> {
        depositor.require_auth();

        if amount <= 0 {
            return Err(Error::InvInput);
        }

        Self::assert_supported_token(&env, &token)?;

        let client = token::Client::new(&env, &token);
        client.transfer(&depositor, &env.current_contract_address(), &amount);

        env.events()
            .publish((symbol_short!("tr_dep"),), (depositor, token, amount));
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Withdrawals (DAO-gated)
    // -----------------------------------------------------------------------

    /// Execute a governance-approved withdrawal.
    ///
    /// * `caller`      – must be the admin (governance contract)
    /// * `proposal_id` – the on-chain proposal that approved this action
    /// * `token`       – reserve token to transfer
    /// * `recipient`   – destination address
    /// * `amount`      – amount to transfer
    /// * `memo`        – purpose / IPFS reference (audit trail)
    ///
    /// Each `proposal_id` can only be used once to prevent replay.
    pub fn withdraw(
        env: Env,
        caller: Address,
        proposal_id: u64,
        token: Address,
        recipient: Address,
        amount: i128,
        memo: Bytes,
    ) -> Result<u64, Error> {
        caller.require_auth();

        let storage = env.storage().instance();
        let admin: Address = storage.get(&DataKey::Admin).ok_or(Error::NotInit)?;

        if caller != admin {
            return Err(Error::Unauthorized);
        }
        if amount <= 0 || memo.is_empty() {
            return Err(Error::InvInput);
        }

        Self::assert_supported_token(&env, &token)?;

        // Replay guard – each proposal may authorise at most one withdrawal
        let used_key = DataKey::ProposalUsed(proposal_id);
        if storage.has(&used_key) {
            return Err(Error::PropExc);
        }
        storage.set(&used_key, &true);

        // Execute transfer
        let client = token::Client::new(&env, &token);
        let self_addr = env.current_contract_address();

        let balance = client.balance(&self_addr);
        if balance < amount {
            return Err(Error::InsufFunds);
        }

        client.transfer(&self_addr, &recipient, &amount);

        // Write immutable audit record
        let withdrawal_id: u64 = storage.get(&DataKey::NextWithdrawalId).unwrap_or(0);
        let record = WithdrawalRecord {
            id: withdrawal_id,
            proposal_id,
            token: token.clone(),
            recipient: recipient.clone(),
            amount,
            memo: memo.clone(),
            executed_at: env.ledger().timestamp(),
        };
        storage.set(&DataKey::Withdrawal(withdrawal_id), &record);
        storage.set(&DataKey::NextWithdrawalId, &(withdrawal_id + 1));

        env.events().publish(
            (symbol_short!("tr_wdraw"),),
            (withdrawal_id, proposal_id, token, recipient, amount),
        );

        Ok(withdrawal_id)
    }

    // -----------------------------------------------------------------------
    // Queries
    // -----------------------------------------------------------------------

    /// Return the treasury's current balance for a given token.
    pub fn balance(env: Env, token: Address) -> i128 {
        let client = token::Client::new(&env, &token);
        client.balance(&env.current_contract_address())
    }

    /// Return a withdrawal record by id.
    pub fn get_withdrawal(env: Env, withdrawal_id: u64) -> Result<WithdrawalRecord, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Withdrawal(withdrawal_id))
            .ok_or(Error::NotFound)
    }

    /// Return the total number of withdrawals executed.
    pub fn withdrawal_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextWithdrawalId)
            .unwrap_or(0)
    }

    /// Return the list of supported reserve tokens.
    pub fn supported_tokens(env: Env) -> Result<Vec<Address>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::SupportedTokens)
            .ok_or(Error::NotInit)
    }

    /// Return the current admin address.
    pub fn admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInit)
    }

    /// Check whether a governance proposal has already been used for a withdrawal.
    pub fn is_proposal_used(env: Env, proposal_id: u64) -> bool {
        env.storage()
            .instance()
            .has(&DataKey::ProposalUsed(proposal_id))
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    fn assert_supported_token(env: &Env, token: &Address) -> Result<(), Error> {
        let tokens: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::SupportedTokens)
            .ok_or(Error::NotInit)?;

        for i in 0..tokens.len() {
            if &tokens.get(i).unwrap() == token {
                return Ok(());
            }
        }
        Err(Error::InvInput)
    }
}
