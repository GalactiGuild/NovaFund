use soroban_sdk::{contract, contractimpl, Address, Env, symbol_short};
use nova_fund_shared::{UpgradeAuditLog, UpgradeStatus, Hash, types::PendingUpgrade};

#[contract]
pub struct ProjectLaunchContract;

#[contractimpl]
impl ProjectLaunchContract {
    /// Enhanced schedule_upgrade with audit logging
    pub fn schedule_upgrade(
        env: &Env,
        proposer: Address,
        new_wasm_hash: Hash,
        proposal_id: u64,
    ) -> u64 {
        proposer.require_auth();

        // Get current WASM hash
        let current_hash = env.deployer().get_current_contract_wasm();
        
        // Generate upgrade ID (use block sequence for uniqueness)
        let upgrade_id = env.ledger().sequence();

        // Validate governance and create pending upgrade
        // ... existing validation logic ...

        // Emit comprehensive audit event
        UpgradeAuditLog::emit_upgrade_scheduled(
            env,
            upgrade_id,
            &current_hash,
            &new_wasm_hash,
            proposal_id,
            &proposer,
            env.ledger().timestamp() + 172_800, // 48-hour time-lock
        );

        upgrade_id
    }

    /// Enhanced execute_upgrade with audit logging
    pub fn execute_upgrade(env: &Env, executor: Address) {
        executor.require_auth();

        // Verify time-lock and pause state
        // ... existing validation logic ...

        let pending = env.storage()
            .persistent()
            .get::<_, PendingUpgrade>(&symbol_short!("UpgradePend"))
            .unwrap();

        let current_hash = env.deployer().get_current_contract_wasm();
        let upgrade_id = env.ledger().sequence();

        // Execute upgrade
        env.deployer().update_current_contract_wasm(pending.wasm_hash);

        // Emit successful execution event
        UpgradeAuditLog::emit_upgrade_executed(
            env,
            upgrade_id,
            &current_hash,
            &pending.wasm_hash,
            0, // proposal_id from storage
            &executor,
            env.ledger().timestamp(),
        );

        // Clear pending upgrade
        env.storage().persistent().remove(&symbol_short!("UpgradePend"));
    }

    /// Enhanced cancel_upgrade with audit logging
    pub fn cancel_upgrade(
        env: &Env,
        admin: Address,
        reason: soroban_sdk::String,
    ) {
        admin.require_auth();

        let pending = env.storage()
            .persistent()
            .get::<_, PendingUpgrade>(&symbol_short!("UpgradePend"));

        if let Some(upgrade) = pending {
            let current_hash = env.deployer().get_current_contract_wasm();
            let upgrade_id = env.ledger().sequence();

            // Emit cancellation event
            UpgradeAuditLog::emit_upgrade_cancelled(
                env,
                upgrade_id,
                &current_hash,
                &upgrade.wasm_hash,
                &admin,
                &reason,
            );

            // Clear pending upgrade
            env.storage().persistent().remove(&symbol_short!("UpgradePend"));
        }
    }
}