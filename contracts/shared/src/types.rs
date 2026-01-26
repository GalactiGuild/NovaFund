use soroban_sdk::{contracttype, Address, String, Vec};

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

#[contracttype]
#[derive(Clone)]
pub struct EscrowInfo {
    pub project_id: u64,
    pub creator: Address,
    pub token: Address,
    pub total_deposited: Amount,
    pub released_amount: Amount,
    pub validators: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum MilestoneStatus {
    Pending = 0,      // Created, awaiting submission
    Submitted = 1,    // Submitted with proof, awaiting validator votes
    Approved = 2,     // Approved by majority, funds released
    Rejected = 3,     // Rejected by majority
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u64,
    pub project_id: u64,
    pub description: String,
    pub amount: Amount,
    pub status: MilestoneStatus,
    pub proof_hash: String,
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

/// Governance proposal structure
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description_hash: Hash,
    pub status: ProposalStatus,
    pub votes_for: i128,
    pub votes_against: i128,
    pub votes_abstain: i128,
    pub start_time: Timestamp,
    pub end_time: Timestamp,
}
