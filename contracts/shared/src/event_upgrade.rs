// Add comprehensive upgrade event constants
pub const UPGRADE_INITIATED: Symbol = symbol_short!("upg_init");      // When upgrade is proposed
pub const UPGRADE_SCHEDULED: Symbol = symbol_short!("upg_sched");     // When upgrade is scheduled with time-lock
pub const UPGRADE_EXECUTED: Symbol = symbol_short!("upg_exec");       // When upgrade is executed
pub const UPGRADE_CANCELLED: Symbol = symbol_short!("upg_canc");      // When upgrade is cancelled
pub const UPGRADE_FAILED: Symbol = symbol_short!("upg_fail");         // When upgrade fails
