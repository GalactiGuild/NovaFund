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

// Cross-chain bridge events
pub const BRIDGE_INITIALIZED: Symbol = symbol_short!("br_init");
pub const SUPPORTED_CHAIN_ADDED: Symbol = symbol_short!("chain_add");
pub const SUPPORTED_CHAIN_REMOVED: Symbol = symbol_short!("chain_rem");
pub const ASSET_WRAPPED: Symbol = symbol_short!("wrap");
pub const ASSET_UNWRAPPED: Symbol = symbol_short!("unwrap");
pub const BRIDGE_DEPOSIT: Symbol = symbol_short!("br_dep");
pub const BRIDGE_WITHDRAW: Symbol = symbol_short!("br_wdraw");
pub const BRIDGE_PAUSED: Symbol = symbol_short!("br_pause");
pub const BRIDGE_UNPAUSED: Symbol = symbol_short!("br_res");
pub const RELAYER_ADDED: Symbol = symbol_short!("rel_add");
pub const RELAYER_REMOVED: Symbol = symbol_short!("rel_rem");
pub const BRIDGE_TX_CONFIRMED: Symbol = symbol_short!("tx_conf");
pub const BRIDGE_TX_FAILED: Symbol = symbol_short!("tx_fail");
pub const CONTRACT_PAUSED: Symbol = symbol_short!("esc_pause");
pub const CONTRACT_RESUMED: Symbol = symbol_short!("esc_resum");

// Upgrade events
pub const UPGRADE_SCHEDULED: Symbol = symbol_short!("upg_sched");
pub const UPGRADE_EXECUTED: Symbol = symbol_short!("upg_exec");
pub const UPGRADE_CANCELLED: Symbol = symbol_short!("upg_canc");