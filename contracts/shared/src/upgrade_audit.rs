use soroban_sdk::{Address, Env, Symbol, symbol_short, Vec};
use crate::types::{Hash, Timestamp, UpgradeAuditLog, UpgradeStatus};
use crate::events::*;

pub struct UpgradeAuditLog;

impl UpgradeAuditLog {
    /// Emit comprehensive upgrade initiation event
    pub fn emit_upgrade_initiated(
        env: &Env,
        upgrade_id: u64,
        old_hash: &Hash,
        new_hash: &Hash,
        proposal_id: u64,
        initiator: &Address,
    ) {
        let topics = (UPGRADE_INITIATED,);
        let data = (
            upgrade_id,
            old_hash,
            new_hash,
            proposal_id,
            initiator,
        );
        env.events().publish(topics, data);
    }

    /// Emit upgrade scheduled event (time-lock started)
    pub fn emit_upgrade_scheduled(
        env: &Env,
        upgrade_id: u64,
        old_hash: &Hash,
        new_hash: &Hash,
        proposal_id: u64,
        executor: &Address,
        time_lock_expires: Timestamp,
    ) {
        let topics = (UPGRADE_SCHEDULED,);
        let data = (
            upgrade_id,
            old_hash,
            new_hash,
            proposal_id,
            executor,
            time_lock_expires,
        );
        env.events().publish(topics, data);
    }

    /// Emit upgrade executed event
    pub fn emit_upgrade_executed(
        env: &Env,
        upgrade_id: u64,
        old_hash: &Hash,
        new_hash: &Hash,
        proposal_id: u64,
        executor: &Address,
        executed_at: Timestamp,
    ) {
        let topics = (UPGRADE_EXECUTED,);
        let data = (
            upgrade_id,
            old_hash,
            new_hash,
            proposal_id,
            executor,
            executed_at,
        );
        env.events().publish(topics, data);
    }

    /// Emit upgrade cancelled event
    pub fn emit_upgrade_cancelled(
        env: &Env,
        upgrade_id: u64,
        old_hash: &Hash,
        new_hash: &Hash,
        executor: &Address,
        reason: &soroban_sdk::String,
    ) {
        let topics = (UPGRADE_CANCELLED,);
        let data = (
            upgrade_id,
            old_hash,
            new_hash,
            executor,
            reason,
        );
        env.events().publish(topics, data);
    }

    /// Emit upgrade failed event
    pub fn emit_upgrade_failed(
        env: &Env,
        upgrade_id: u64,
        old_hash: &Hash,
        new_hash: &Hash,
        reason: &soroban_sdk::String,
    ) {
        let topics = (UPGRADE_FAILED,);
        let data = (
            upgrade_id,
            old_hash,
            new_hash,
            reason,
        );
        env.events().publish(topics, data);
    }
}