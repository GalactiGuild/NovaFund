#![no_std]

use shared::{
    errors::Error,
    events::{
        ASSET_WRAPPED, BRIDGE_DEPOSIT, BRIDGE_INITIALIZED, BRIDGE_PAUSED, BRIDGE_TX_CONFIRMED,
        BRIDGE_UNPAUSED, BRIDGE_WITHDRAW, RELAYER_ADDED, RELAYER_REMOVED, SUPPORTED_CHAIN_ADDED,
        SUPPORTED_CHAIN_REMOVED,
    },
    types::{
        Amount, BridgeConfig, BridgeOperationType, BridgeTransaction, BridgeTransactionStatus,
        ChainConfig, ChainId, RelayerInfo, WrappedAssetInfo,
    },
};
use soroban_sdk::{contract, contractimpl, token::TokenClient, Address, BytesN, Env, String};

mod storage;
#[cfg(test)]
mod tests;

use storage::*;

#[contract]
pub struct CrossChainBridge;

#[contractimpl]
impl CrossChainBridge {
    /// Initialize the bridge contract
    ///
    /// # Arguments
    /// * `admin` - Admin address
    /// * `min_relayer_stake` - Minimum stake required for relayers
    /// * `confirmation_threshold` - Required confirmations for transactions
    pub fn initialize(
        env: Env,
        admin: Address,
        min_relayer_stake: Amount,
        confirmation_threshold: u32,
    ) -> Result<(), Error> {
        if has_config(&env) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        if confirmation_threshold == 0 {
            return Err(Error::InvalidInput);
        }

        let config = BridgeConfig {
            admin: admin.clone(),
            paused: false,
            min_relayer_stake,
            confirmation_threshold,
            max_gas_price: 1000000000, // 1 billion units
            emergency_pause_threshold: 10,
        };

        set_config(&env, &config);
        set_transaction_counter(&env, 0);

        env.events().publish((BRIDGE_INITIALIZED,), (admin,));

        Ok(())
    }

    /// Add a supported blockchain
    ///
    /// # Arguments
    /// * `chain_id` - Chain identifier
    /// * `name` - Human-readable chain name
    /// * `bridge_contract` - Bridge contract address on the remote chain
    /// * `confirmations_required` - Number of confirmations needed
    pub fn add_supported_chain(
        env: Env,
        chain_id: ChainId,
        name: String,
        bridge_contract: BytesN<32>,
        confirmations_required: u32,
        gas_cost_estimate: u64,
    ) -> Result<(), Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        if is_chain_supported(&env, chain_id) {
            return Err(Error::AlreadyInitialized);
        }

        if confirmations_required == 0 {
            return Err(Error::InvalidInput);
        }

        let chain_config = ChainConfig {
            chain_id: chain_id.clone(),
            name,
            bridge_contract_address: bridge_contract.clone(),
            confirmations_required,
            is_active: true,
            gas_cost_estimate,
        };

        set_chain_config(&env, chain_id, &chain_config);

        env.events()
            .publish((SUPPORTED_CHAIN_ADDED,), (chain_id as u32, bridge_contract));

        Ok(())
    }

    /// Remove a supported blockchain
    pub fn remove_supported_chain(env: Env, chain_id: ChainId) -> Result<(), Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        let mut chain_config = get_chain_config(&env, chain_id)?;
        chain_config.is_active = false;

        set_chain_config(&env, chain_id, &chain_config);

        env.events()
            .publish((SUPPORTED_CHAIN_REMOVED,), (chain_id as u32,));

        Ok(())
    }

    /// Register a new wrapped asset
    ///
    /// # Arguments
    /// * `asset_code` - Asset code (e.g., "ETH", "USDC")
    /// * `issuer` - Token issuer address on Stellar
    /// * `original_chain` - Original blockchain
    /// * `original_contract` - Original contract address
    /// * `decimals` - Token decimals
    pub fn register_wrapped_asset(
        env: Env,
        asset_code: String,
        issuer: Address,
        original_chain: ChainId,
        original_contract: BytesN<32>,
        decimals: u32,
    ) -> Result<Address, Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        if !is_chain_supported(&env, original_chain) {
            return Err(Error::InvalidInput);
        }

        // Check if asset already exists
        if get_wrapped_asset_by_original(&env, original_chain, &original_contract).is_ok() {
            return Err(Error::AlreadyInitialized);
        }

        let asset = WrappedAssetInfo {
            asset_code: asset_code.clone(),
            issuer: issuer.clone(),
            original_chain: original_chain.clone(),
            original_contract: original_contract.clone(),
            decimals,
            is_active: true,
            total_wrapped: 0,
        };

        // Use issuer address as the asset identifier
        set_wrapped_asset(&env, issuer.clone(), &asset);
        set_asset_by_original(&env, original_chain, &original_contract, &issuer);

        env.events().publish(
            (ASSET_WRAPPED,),
            (asset_code, issuer.clone(), original_chain as u32),
        );

        Ok(issuer)
    }

    /// Deposit assets from another chain (called by relayers after confirmation)
    ///
    /// # Arguments
    /// * `source_chain` - Source blockchain
    /// * `source_tx_hash` - Transaction hash on source chain
    /// * `sender` - Sender address on source chain
    /// * `recipient` - Recipient address on Stellar
    /// * `asset` - Wrapped asset address
    /// * `amount` - Amount to deposit
    pub fn deposit(
        env: Env,
        source_chain: ChainId,
        source_tx_hash: BytesN<32>,
        sender: BytesN<32>,
        recipient: Address,
        asset: Address,
        amount: Amount,
    ) -> Result<u64, Error> {
        // Verify not paused
        let config = get_config(&env)?;
        if config.paused {
            return Err(Error::InvalidInput);
        }

        // Verify chain is supported
        let chain_config = get_chain_config(&env, source_chain)?;
        if !chain_config.is_active {
            return Err(Error::InvalidInput);
        }

        // Verify asset is registered
        let mut wrapped_asset = get_wrapped_asset(&env, asset.clone())?;
        if !wrapped_asset.is_active {
            return Err(Error::InvalidInput);
        }

        // Verify amount
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        // Check for duplicate transaction
        if get_transaction_by_source_hash(&env, source_chain, &source_tx_hash).is_ok() {
            return Err(Error::AlreadyInitialized);
        }

        // Create transaction record
        let tx_id = get_transaction_counter(&env)?;
        let next_id = tx_id.checked_add(1).ok_or(Error::InvalidInput)?;

        let transaction = BridgeTransaction {
            tx_id,
            source_chain: source_chain.clone(),
            destination_chain: source_chain, // For deposits, the destination is conceptually the same chain (informational)
            operation: BridgeOperationType::Deposit,
            sender,
            recipient: recipient.clone(),
            asset: asset.clone(),
            amount,
            status: BridgeTransactionStatus::Confirmed,
            confirmations: chain_config.confirmations_required,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
            source_tx_hash: source_tx_hash.clone(),
        };

        // Store transaction
        set_transaction(&env, tx_id, &transaction);
        set_transaction_by_source_hash(&env, source_chain, &source_tx_hash, tx_id);
        set_transaction_counter(&env, next_id);

        // Update wrapped asset total
        wrapped_asset.total_wrapped = wrapped_asset
            .total_wrapped
            .checked_add(amount)
            .ok_or(Error::InvalidInput)?;
        set_wrapped_asset(&env, asset.clone(), &wrapped_asset);

        // In a production environment, this would trigger minting of wrapped tokens
        // by calling an authorized token contract with proper authentication.
        // For this implementation, we track the deposits internally.

        env.events().publish(
            (BRIDGE_DEPOSIT,),
            (tx_id, recipient, asset, amount, source_tx_hash),
        );

        env.events().publish((BRIDGE_TX_CONFIRMED,), (tx_id, tx_id));

        Ok(tx_id)
    }

    /// Initiate withdrawal to another chain
    ///
    /// # Arguments
    /// * `destination_chain` - Destination blockchain
    /// * `recipient` - Recipient address on destination chain (32 bytes)
    /// * `asset` - Wrapped asset address
    /// * `amount` - Amount to withdraw
    pub fn withdraw(
        env: Env,
        sender: Address,
        destination_chain: ChainId,
        recipient: BytesN<32>,
        asset: Address,
        amount: Amount,
    ) -> Result<u64, Error> {
        // Require sender authorization
        sender.require_auth();

        // Verify not paused
        let config = get_config(&env)?;
        if config.paused {
            return Err(Error::InvalidInput);
        }

        // Verify chain is supported
        let chain_config = get_chain_config(&env, destination_chain)?;
        if !chain_config.is_active {
            return Err(Error::InvalidInput);
        }

        // Verify asset is registered
        let mut wrapped_asset = get_wrapped_asset(&env, asset.clone())?;
        if !wrapped_asset.is_active {
            return Err(Error::InvalidInput);
        }

        // Verify amount
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        // Verify sender has sufficient balance
        let token_client = TokenClient::new(&env, &asset);
        let sender_balance = token_client.balance(&sender);
        if sender_balance < amount {
            return Err(Error::InsufficientFunds);
        }

        // Note: Token burning is handled by the token contract
        // The sender must authorize the burn operation
        // In production, this would call the token contract's burn function
        // through proper authorization

        // Create transaction record
        let tx_id = get_transaction_counter(&env)?;
        let next_id = tx_id.checked_add(1).ok_or(Error::InvalidInput)?;

        let transaction = BridgeTransaction {
            tx_id,
            source_chain: ChainId::Ethereum, // Placeholder
            destination_chain: destination_chain.clone(),
            operation: BridgeOperationType::Withdraw,
            sender: BytesN::from_array(&env, &[0u8; 32]), // Placeholder
            recipient: sender.clone(),
            asset: asset.clone(),
            amount,
            status: BridgeTransactionStatus::Pending,
            confirmations: 0,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
            source_tx_hash: BytesN::from_array(&env, &[0u8; 32]),
        };

        // Store transaction
        set_transaction(&env, tx_id, &transaction);
        set_transaction_counter(&env, next_id);

        // Update wrapped asset total
        wrapped_asset.total_wrapped = wrapped_asset
            .total_wrapped
            .checked_sub(amount)
            .ok_or(Error::InvalidInput)?;
        set_wrapped_asset(&env, asset.clone(), &wrapped_asset);

        env.events().publish(
            (BRIDGE_WITHDRAW,),
            (tx_id, destination_chain as u32, recipient, asset, amount),
        );

        Ok(tx_id)
    }

    /// Confirm a withdrawal transaction (called by relayers)
    ///
    /// # Arguments
    /// * `relayer` - Relayer address confirming the transaction
    /// * `tx_id` - Transaction ID
    /// * `destination_tx_hash` - Transaction hash on destination chain
    pub fn confirm_withdrawal(
        env: Env,
        relayer: Address,
        tx_id: u64,
        destination_tx_hash: BytesN<32>,
    ) -> Result<(), Error> {
        // Require relayer authorization
        relayer.require_auth();

        // Verify relayer is registered and active
        if !is_relayer(&env, &relayer) {
            return Err(Error::Unauthorized);
        }

        let mut transaction = get_transaction(&env, tx_id)?;

        if transaction.operation != BridgeOperationType::Withdraw {
            return Err(Error::InvalidInput);
        }

        if transaction.status != BridgeTransactionStatus::Pending {
            return Err(Error::InvalidInput);
        }

        // Update transaction
        transaction.status = BridgeTransactionStatus::Executed;
        transaction.updated_at = env.ledger().timestamp();

        set_transaction(&env, tx_id, &transaction);

        env.events()
            .publish((BRIDGE_TX_CONFIRMED,), (tx_id, destination_tx_hash));

        Ok(())
    }

    /// Register as a relayer
    ///
    /// # Arguments
    /// * `relayer` - Address of the relayer to register
    /// * `stake` - Amount of tokens to stake
    pub fn register_relayer(env: Env, relayer: Address, stake: Amount) -> Result<(), Error> {
        let config = get_config(&env)?;

        // Require relayer authorization
        relayer.require_auth();

        if stake < config.min_relayer_stake {
            return Err(Error::InvalidInput);
        }

        if is_relayer(&env, &relayer) {
            return Err(Error::AlreadyInitialized);
        }

        let relayer_info = RelayerInfo {
            address: relayer.clone(),
            stake_amount: stake,
            is_active: true,
            successful_txs: 0,
            failed_txs: 0,
        };

        set_relayer(&env, &relayer, &relayer_info);

        env.events().publish((RELAYER_ADDED,), (relayer, stake));

        Ok(())
    }

    /// Unregister as a relayer and withdraw stake
    ///
    /// # Arguments
    /// * `relayer` - Address of the relayer to unregister
    pub fn unregister_relayer(env: Env, relayer: Address) -> Result<(), Error> {
        // Require relayer authorization
        relayer.require_auth();

        let mut relayer_info = get_relayer(&env, &relayer)?;
        relayer_info.is_active = false;

        set_relayer(&env, &relayer, &relayer_info);

        env.events().publish((RELAYER_REMOVED,), (relayer,));

        Ok(())
    }

    /// Pause the bridge (emergency)
    pub fn pause_bridge(env: Env) -> Result<(), Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        let mut new_config = config;
        new_config.paused = true;

        set_config(&env, &new_config);

        env.events().publish((BRIDGE_PAUSED,), ());

        Ok(())
    }

    /// Unpause the bridge
    pub fn unpause_bridge(env: Env) -> Result<(), Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        let mut new_config = config;
        new_config.paused = false;

        set_config(&env, &new_config);

        env.events().publish((BRIDGE_UNPAUSED,), ());

        Ok(())
    }

    /// Update bridge configuration
    pub fn update_config(
        env: Env,
        min_relayer_stake: Option<Amount>,
        confirmation_threshold: Option<u32>,
        max_gas_price: Option<u64>,
    ) -> Result<(), Error> {
        let config = get_config(&env)?;
        config.admin.require_auth();

        let mut new_config = config;

        if let Some(stake) = min_relayer_stake {
            new_config.min_relayer_stake = stake;
        }

        if let Some(threshold) = confirmation_threshold {
            if threshold == 0 {
                return Err(Error::InvalidInput);
            }
            new_config.confirmation_threshold = threshold;
        }

        if let Some(gas) = max_gas_price {
            new_config.max_gas_price = gas;
        }

        set_config(&env, &new_config);

        Ok(())
    }

    // ==================== Query Functions ====================

    /// Get bridge configuration
    pub fn get_config(env: Env) -> Result<BridgeConfig, Error> {
        get_config(&env)
    }

    /// Get chain configuration
    pub fn get_chain_config(env: Env, chain_id: ChainId) -> Result<ChainConfig, Error> {
        get_chain_config(&env, chain_id)
    }

    /// Get wrapped asset information
    pub fn get_wrapped_asset(env: Env, asset: Address) -> Result<WrappedAssetInfo, Error> {
        get_wrapped_asset(&env, asset)
    }

    /// Get transaction by ID
    pub fn get_transaction(env: Env, tx_id: u64) -> Result<BridgeTransaction, Error> {
        get_transaction(&env, tx_id)
    }

    /// Get relayer information
    pub fn get_relayer(env: Env, address: Address) -> Result<RelayerInfo, Error> {
        get_relayer(&env, &address)
    }

    /// Check if chain is supported
    pub fn is_chain_supported(env: Env, chain_id: ChainId) -> bool {
        is_chain_supported(&env, chain_id)
    }

    /// Get total wrapped amount for an asset
    pub fn get_total_wrapped(env: Env, asset: Address) -> Result<Amount, Error> {
        let wrapped = get_wrapped_asset(&env, asset)?;
        Ok(wrapped.total_wrapped)
    }

    /// Get transaction count
    pub fn get_transaction_count(env: Env) -> u64 {
        get_transaction_counter(&env).unwrap_or(0)
    }
}
