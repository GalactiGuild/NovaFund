use soroban_sdk::{symbol_short, Symbol};

// Project events
pub const PROJECT_CREATED: Symbol = symbol_short!("proj_new");
pub const PROJECT_FUNDED: Symbol = symbol_short!("proj_fund");
pub const PROJECT_COMPLETED: Symbol = symbol_short!("proj_done");
pub const PROJECT_FAILED: Symbol = symbol_short!("proj_fail");

// Contribution events
pub const CONTRIBUTION_MADE: Symbol = symbol_short!("contrib");
pub const REFUND_ISSUED: Symbol = symbol_short!("refund");

// Escrow events
pub const FUNDS_LOCKED: Symbol = symbol_short!("lock");
pub const FUNDS_RELEASED: Symbol = symbol_short!("release");
pub const MILESTONE_COMPLETED: Symbol = symbol_short!("milestone");

// Distribution events
pub const PROFIT_DISTRIBUTED: Symbol = symbol_short!("profit");
pub const DIVIDEND_CLAIMED: Symbol = symbol_short!("claim");

// Governance events
pub const PROPOSAL_CREATED: Symbol = symbol_short!("proposal");
pub const VOTE_CAST: Symbol = symbol_short!("vote");
pub const PROPOSAL_EXECUTED: Symbol = symbol_short!("execute");

// Reputation events
pub const USER_REGISTERED: Symbol = symbol_short!("user_reg");
pub const REPUTATION_UPDATED: Symbol = symbol_short!("rep_up");
pub const BADGE_EARNED: Symbol = symbol_short!("badge");
