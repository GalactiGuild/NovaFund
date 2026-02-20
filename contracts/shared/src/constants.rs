/// Platform constants
use soroban_sdk::{symbol_short, Symbol};

/// Default platform fee (2.5%)
pub const DEFAULT_PLATFORM_FEE: u32 = 250;

/// Maximum platform fee (10%)
pub const MAX_PLATFORM_FEE: u32 = 1000;

/// Minimum project funding goal
pub const MIN_FUNDING_GOAL: i128 = 1_000_0000000; // 1,000 XLM (with 7 decimals)

/// Maximum project funding goal
pub const MAX_FUNDING_GOAL: i128 = 1_000_000_0000000; // 1,000,000 XLM

/// Minimum project duration (1 day in seconds)
pub const MIN_PROJECT_DURATION: u64 = 86400;

/// Maximum project duration (180 days in seconds)
pub const MAX_PROJECT_DURATION: u64 = 15552000;

/// Minimum contribution amount
pub const MIN_CONTRIBUTION: i128 = 10_0000000; // 10 XLM

/// Voting threshold for milestone approval (60%)
pub const MILESTONE_APPROVAL_THRESHOLD: u32 = 6000;

/// Minimum validators required
pub const MIN_VALIDATORS: u32 = 3;

/// Reputation score ranges
pub const REPUTATION_MIN: i128 = 0;
pub const REPUTATION_MAX: i128 = 10000;
pub const REPUTATION_START: i128 = 100;

/// Governance quorum (20%)
pub const GOVERNANCE_QUORUM: u32 = 2000;

/// Voting period duration (7 days in seconds)
pub const VOTING_PERIOD: u64 = 604800;

pub const ESCROW_INITIALIZED: Symbol = symbol_short!("esc_init");
pub const FUNDS_LOCKED: Symbol = symbol_short!("f_lock");
pub const MILESTONE_CREATED: Symbol = symbol_short!("mile_cr");
pub const MILESTONE_SUBMITTED: Symbol = symbol_short!("mile_sub");
pub const MILESTONE_APPROVED: Symbol = symbol_short!("mile_apr");
pub const MILESTONE_REJECTED: Symbol = symbol_short!("mile_rej");
pub const FUNDS_RELEASED: Symbol = symbol_short!("fund_rel");

/// Maximum number of items in a batch operation
pub const MAX_BATCH_SIZE: u32 = 20;
