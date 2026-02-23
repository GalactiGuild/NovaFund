use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

/// Common timestamp type
pub type Timestamp = u64;

/// Common amount type
pub type Amount = i128;

/// Common percentage type (in basis points, 10000 = 100%)
pub type BasisPoints = u32;

/// Hash type (SHA-256)
pub type Hash = BytesN<32>;

/// Platform fee configuration
#[contracttype]
#[derive(Clone)]
pub struct FeeConfig {
    pub platform_fee: BasisPoints, // Platform fee in basis points
    pub creator_fee: BasisPoints,  // Creator fee in basis points
    pub fee_recipient: Address,    // Address to receive fees
}

/// Token information
#[contracttype]
#[derive(Clone)]
pub struct TokenInfo {
    pub address: Address,
    pub symbol: String,
    pub decimals: u32,
}

/// User profile
#[contracttype]
#[derive(Clone)]
pub struct UserProfile {
    pub address: Address,
    pub reputation_score: i128,
    pub projects_created: u32,
    pub projects_funded: u32,
    pub total_contributed: Amount,
    pub verified: bool,
}

/// Regulatory Jurisdiction
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Jurisdiction {
    Global = 0,
    UnitedStates = 1,
    EuropeanUnion = 2,
    UnitedKingdom = 3,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowInfo {
    pub project_id: u64,
    pub creator: Address,
    pub token: Address,
    pub total_deposited: Amount,
    pub released_amount: Amount,
    pub validators: Vec<Address>,
    pub approval_threshold: u32,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum MilestoneStatus {
    Pending = 0,   // Created, awaiting submission
    Submitted = 1, // Submitted with proof, awaiting validator votes
    Approved = 2,  // Approved by majority, funds released
    Rejected = 3,  // Rejected by majority
}

/// Milestone structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u64,
    pub project_id: u64,
    pub description_hash: Hash,
    pub amount: Amount,
    pub status: MilestoneStatus,
    pub proof_hash: Hash,
    pub approval_count: u32,
    pub rejection_count: u32,
    pub created_at: Timestamp,
}

/// Proposal status
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProposalStatus {
    Active = 0,
    Approved = 1,
    Rejected = 2,
    Executed = 3,
}

/// Voting options
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VoteOption {
    Abstain = 0,
    Yes = 1,
    No = 2,
}

/// Governance proposal structure (token-weighted voting)
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub creator: Address,
    pub payload_ref: soroban_sdk::Bytes, // Reference to proposal details (e.g., IPFS hash, JSON pointer)
    pub start_time: Timestamp,
    pub end_time: Timestamp,
    pub yes_votes: Amount, // Token-weighted yes votes
    pub no_votes: Amount,  // Token-weighted no votes
    pub executed: bool,    // Execution status
}

// ==================== Cross-Chain Bridge Types ====================

/// Supported blockchain networks
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ChainId {
    Ethereum = 1,
    Polygon = 137,
    BinanceSmartChain = 56,
    Avalanche = 43114,
    Arbitrum = 42161,
    Optimism = 10,
    Base = 8453,
}

/// Bridge transaction status
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum BridgeTransactionStatus {
    Pending = 0,
    Confirmed = 1,
    Executed = 2,
    Failed = 3,
    Refunded = 4,
}

/// Bridge operation type
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum BridgeOperationType {
    Deposit = 0,  // Lock assets on source chain, mint on Stellar
    Withdraw = 1, // Burn on Stellar, release on destination chain
}

/// Supported chain configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct ChainConfig {
    pub chain_id: ChainId,
    pub name: String,
    pub bridge_contract_address: BytesN<32>, // Remote bridge contract address
    pub confirmations_required: u32,
    pub is_active: bool,
    pub gas_cost_estimate: u64, // Estimated gas cost for operations
}

/// Wrapped asset information
#[contracttype]
#[derive(Clone, Debug)]
pub struct WrappedAssetInfo {
    pub asset_code: String,
    pub issuer: Address,
    pub original_chain: ChainId,
    pub original_contract: BytesN<32>, // Original contract address on source chain
    pub decimals: u32,
    pub is_active: bool,
    pub total_wrapped: Amount,
}

/// Bridge transaction record
#[contracttype]
#[derive(Clone, Debug)]
pub struct BridgeTransaction {
    pub tx_id: u64,
    pub source_chain: ChainId,
    pub destination_chain: ChainId,
    pub operation: BridgeOperationType,
    pub sender: BytesN<32>, // Address on source chain (32 bytes for compatibility)
    pub recipient: Address, // Stellar address for deposits
    pub asset: Address,     // Wrapped asset address on Stellar
    pub amount: Amount,
    pub status: BridgeTransactionStatus,
    pub confirmations: u32,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
    pub source_tx_hash: BytesN<32>, // Transaction hash on source chain
}

/// Relayer information
#[contracttype]
#[derive(Clone, Debug)]
pub struct RelayerInfo {
    pub address: Address,
    pub stake_amount: Amount,
    pub is_active: bool,
    pub successful_txs: u64,
    pub failed_txs: u64,
}

/// Bridge configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct BridgeConfig {
    pub admin: Address,
    pub paused: bool,
    pub min_relayer_stake: Amount,
    pub confirmation_threshold: u32,
    pub max_gas_price: u64,
    pub emergency_pause_threshold: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct PauseState {
    pub paused: bool,
    pub paused_at: u64,
    pub resume_not_before: u64,
}

/// Pending contract upgrade (time-locked). Used by ProjectLaunch and Escrow.
#[contracttype]
#[derive(Clone, Debug)]
pub struct PendingUpgrade {
    pub wasm_hash: Hash,
    /// Ledger timestamp before which execute_upgrade will fail
    pub execute_not_before: u64,
}