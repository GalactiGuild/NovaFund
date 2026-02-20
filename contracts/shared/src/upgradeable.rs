pub fn execute_upgrade(env: &Env) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    // Ensure upgrade exists
    if !env.storage().instance().has(&UpgradeKey::PendingWasmHash) {
        panic!("No pending upgrade");
    }

    // Ensure contract is paused
    let paused: bool = env.storage()
        .instance()
        .get(&UpgradeKey::Paused)
        .unwrap();

    if !paused {
        panic!("Contract must be paused before upgrade");
    }

    let scheduled: u64 = env.storage()
        .instance()
        .get(&UpgradeKey::UpgradeTimestamp)
        .unwrap();

    let now = env.ledger().timestamp();

    if now < scheduled {
        panic!("Upgrade timelock not expired");
    }

    let wasm_hash: BytesN<32> = env.storage()
        .instance()
        .get(&UpgradeKey::PendingWasmHash)
        .unwrap();

    env.deployer().update_current_contract_wasm(wasm_hash);

    // Increment version
    let version: u32 = env.storage()
        .instance()
        .get(&UpgradeKey::Version)
        .unwrap();

    env.storage()
        .instance()
        .set(&UpgradeKey::Version, &(version + 1));

    // Clear proposal
    env.storage()
        .instance()
        .remove(&UpgradeKey::PendingWasmHash);

    env.storage()
        .instance()
        .remove(&UpgradeKey::UpgradeTimestamp);
}
