use shared::{
    errors::Error,
    types::{BridgeConfig, BridgeTransaction, ChainConfig, ChainId, RelayerInfo, WrappedAssetInfo},
};
use soroban_sdk::{contracttype, Address, BytesN, Env};

// Storage key types
#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    Config,                               // Bridge configuration
    TxCounter,                            // Transaction counter
    ChainConfig(ChainId),                 // Chain configuration by ChainId
    WrappedAsset(Address),                // Wrapped asset info by asset address
    AssetByOriginal(ChainId, BytesN<32>), // Asset address by chain and original contract
    Transaction(u64),                     // Transaction by ID
    TxByHash(ChainId, BytesN<32>),        // Transaction ID by source hash
    Relayer(Address),                     // Relayer info by address
}

/// Get bridge configuration
pub fn get_config(env: &Env) -> Result<BridgeConfig, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)
}

/// Set bridge configuration
pub fn set_config(env: &Env, config: &BridgeConfig) {
    env.storage().persistent().set(&DataKey::Config, config);
}

/// Check if config exists
pub fn has_config(env: &Env) -> bool {
    env.storage().persistent().has(&DataKey::Config)
}

/// Get transaction counter
pub fn get_transaction_counter(env: &Env) -> Result<u64, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::TxCounter)
        .ok_or(Error::NotInitialized)
}

/// Set transaction counter
pub fn set_transaction_counter(env: &Env, counter: u64) {
    env.storage()
        .persistent()
        .set(&DataKey::TxCounter, &counter);
}

/// Get chain configuration
pub fn get_chain_config(env: &Env, chain_id: ChainId) -> Result<ChainConfig, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::ChainConfig(chain_id))
        .ok_or(Error::NotFound)
}

/// Set chain configuration
pub fn set_chain_config(env: &Env, chain_id: ChainId, config: &ChainConfig) {
    env.storage()
        .persistent()
        .set(&DataKey::ChainConfig(chain_id), config);
}

/// Check if chain is supported
pub fn is_chain_supported(env: &Env, chain_id: ChainId) -> bool {
    get_chain_config(env, chain_id)
        .map(|c| c.is_active)
        .unwrap_or(false)
}

/// Get wrapped asset
pub fn get_wrapped_asset(env: &Env, asset: Address) -> Result<WrappedAssetInfo, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::WrappedAsset(asset))
        .ok_or(Error::NotFound)
}

/// Set wrapped asset
pub fn set_wrapped_asset(env: &Env, asset: Address, wrapped: &WrappedAssetInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::WrappedAsset(asset), wrapped);
}

/// Get wrapped asset by original contract address
pub fn get_wrapped_asset_by_original(
    env: &Env,
    chain_id: ChainId,
    original: &BytesN<32>,
) -> Result<Address, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::AssetByOriginal(chain_id, original.clone()))
        .ok_or(Error::NotFound)
}

/// Set asset mapping by original contract
pub fn set_asset_by_original(env: &Env, chain_id: ChainId, original: &BytesN<32>, asset: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::AssetByOriginal(chain_id, original.clone()), asset);
}

/// Get transaction
pub fn get_transaction(env: &Env, tx_id: u64) -> Result<BridgeTransaction, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Transaction(tx_id))
        .ok_or(Error::NotFound)
}

/// Set transaction
pub fn set_transaction(env: &Env, tx_id: u64, transaction: &BridgeTransaction) {
    env.storage()
        .persistent()
        .set(&DataKey::Transaction(tx_id), transaction);
}

/// Get transaction ID by source hash
pub fn get_transaction_by_source_hash(
    env: &Env,
    chain_id: ChainId,
    hash: &BytesN<32>,
) -> Result<u64, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::TxByHash(chain_id, hash.clone()))
        .ok_or(Error::NotFound)
}

/// Set transaction ID by source hash
pub fn set_transaction_by_source_hash(env: &Env, chain_id: ChainId, hash: &BytesN<32>, tx_id: u64) {
    env.storage()
        .persistent()
        .set(&DataKey::TxByHash(chain_id, hash.clone()), &tx_id);
}

/// Get relayer
pub fn get_relayer(env: &Env, address: &Address) -> Result<RelayerInfo, Error> {
    env.storage()
        .persistent()
        .get(&DataKey::Relayer(address.clone()))
        .ok_or(Error::NotFound)
}

/// Set relayer
pub fn set_relayer(env: &Env, address: &Address, relayer: &RelayerInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::Relayer(address.clone()), relayer);
}

/// Check if address is a relayer
pub fn is_relayer(env: &Env, address: &Address) -> bool {
    get_relayer(env, address)
        .map(|r| r.is_active)
        .unwrap_or(false)
}
