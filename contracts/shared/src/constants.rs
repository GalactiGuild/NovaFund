/// Default platform fee (2.5%)
pub const DEFAULT_PLATFORM_FEE: u32 = 250;

/// Maximum platform fee (10%)
pub const MAX_PLATFORM_FEE: u32 = 1000;

/// Minimum project funding goal
pub const MIN_FUNDING_GOAL: i128 = 10_000_000_000; // 1,000 XLM (with 7 decimals)

/// Maximum project funding goal
pub const MAX_FUNDING_GOAL: i128 = 10_000_000_000_000; // 1,000,000 XLM

/// Minimum project duration (1 day in seconds)
pub const MIN_PROJECT_DURATION: u64 = 86400;

/// Maximum project duration (180 days in seconds)
pub const MAX_PROJECT_DURATION: u64 = 15552000;

/// Minimum contribution amount
pub const MIN_CONTRIBUTION: i128 = 100_000_000; // 10 XLM

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

// ==================== Dispute Resolution Constants ====================

/// Minimum stake required to register as a juror (e.g., 500 tokens)
pub const MIN_JUROR_STAKE: i128 = 5_000_000_000;

/// Default jury size (must be odd)
pub const JURY_SIZE: u32 = 7;

/// Jury size for appeals (must be odd and larger than JURY_SIZE)
pub const APPEAL_JURY_SIZE: u32 = 13;

/// Voting commit period (e.g., 3 days in seconds)
pub const VOTING_COMMIT_PERIOD: u64 = 259200;

/// Voting reveal period (e.g., 2 days in seconds)
pub const VOTING_REVEAL_PERIOD: u64 = 172800;

/// Appeal window period (e.g., 5 days in seconds)
pub const APPEAL_WINDOW_PERIOD: u64 = 432000;

/// Flat fee for filing an appeal
pub const APPEAL_FEE: i128 = 1_000_000_000;

/// Maximum number of appeals allowed
pub const MAX_APPEALS: u8 = 2;

// Max & Min threshold consts
pub const MIN_APPROVAL_THRESHOLD: u32 = 5100; // 51% minimum
pub const MAX_APPROVAL_THRESHOLD: u32 = 10000; // 100% maximum
pub const RESUME_TIME_DELAY: u64 = 86400; // 24 hours in seconds

/// Minimum delay before a scheduled upgrade can be executed (48 hours)
pub const UPGRADE_TIME_LOCK_SECS: u64 = 172800; // 48 * 3600
