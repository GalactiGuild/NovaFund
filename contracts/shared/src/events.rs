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
pub const ESCROW_INITIALIZED: Symbol = symbol_short!("esc_init");
pub const FUNDS_LOCKED: Symbol = symbol_short!("lock");
pub const FUNDS_RELEASED: Symbol = symbol_short!("release");
pub const MILESTONE_CREATED: Symbol = symbol_short!("m_create");
pub const MILESTONE_SUBMITTED: Symbol = symbol_short!("m_submit");
pub const MILESTONE_APPROVED: Symbol = symbol_short!("m_apprv");
pub const MILESTONE_REJECTED: Symbol = symbol_short!("m_reject");
pub const MILESTONE_COMPLETED: Symbol = symbol_short!("milestone");
pub const VALIDATORS_UPDATED: Symbol = symbol_short!("v_update");

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

// Multi-party payment events
pub const PAYMENT_SETUP: Symbol = symbol_short!("pay_setup");
pub const PAYMENT_RECEIVED: Symbol = symbol_short!("pay_recv");
pub const PAYMENT_WITHDRAWN: Symbol = symbol_short!("pay_withd");

// Subscription events
pub const SUBSCRIPTION_CREATED: Symbol = symbol_short!("subscr");
pub const SUBSCRIPTION_CANCELLED: Symbol = symbol_short!("sub_cancl");
pub const SUBSCRIPTION_MODIFIED: Symbol = symbol_short!("sub_mod");
pub const SUBSCRIPTION_PAUSED: Symbol = symbol_short!("sub_pause");
pub const SUBSCRIPTION_RESUMED: Symbol = symbol_short!("sub_resum");
pub const PAYMENT_FAILED: Symbol = symbol_short!("pay_fail");
pub const SUBSCRIPTION_PAYMENT: Symbol = symbol_short!("deposit");
