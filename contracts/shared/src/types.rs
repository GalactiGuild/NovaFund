/// Upgrade audit log entry - tracks all upgrade attempts on-chain
#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeAuditLog {
    pub upgrade_id: u64,              // Unique identifier for this upgrade
    pub old_hash: Hash,               // Previous contract WASM hash
    pub new_hash: Hash,               // New contract WASM hash
    pub proposal_id: u64,             // Associated governance proposal ID
    pub executor: Address,            // Address that initiated/executed the upgrade
    pub initiator: Address,           // Address that initially proposed the upgrade
    pub status: UpgradeStatus,        // Current status of upgrade attempt
    pub scheduled_at: Timestamp,      // When upgrade was scheduled
    pub executed_at: Timestamp,       // When upgrade was executed (0 if not executed)
    pub cancelled_at: Timestamp,      // When upgrade was cancelled (0 if not cancelled)
    pub time_lock_expires: Timestamp, // When time-lock expires (48 hours after scheduled)
    pub reason: String,               // Reason for upgrade/cancellation
}

/// Upgrade status tracking
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum UpgradeStatus {
    Scheduled = 0,  // Pending execution (time-locked)
    Executed = 1,   // Successfully executed
    Cancelled = 2,  // Cancelled by admin
    Failed = 3,     // Execution failed
}