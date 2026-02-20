use soroban_sdk::{
    contracttype, Address, BytesN, Env
};

#[derive(Clone)]
#[contracttype]
pub enum UpgradeKey {
    Admin,
    PendingWasmHash,
    UpgradeTimestamp,
    Version,
    Paused,
}

const UPGRADE_DELAY: u64 = 48 * 60 * 60; // 48 hours

// -------------------------------------
// Initialization
// -------------------------------------

pub fn initialize_upgrade(env: &Env, admin: Address) {
    if env.storage().instance().has(&UpgradeKey::Admin) {
        panic!("Already initialized");
    }

    admin.require_auth();

    env.storage().instance().set(&UpgradeKey::Admin, &admin);
    env.storage().instance().set(&UpgradeKey::Version, &1u32);
    env.storage().instance().set(&UpgradeKey::Paused, &false);
}

// -------------------------------------
// Pause Control
// -------------------------------------

pub fn pause(env: &Env) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    env.storage().instance().set(&UpgradeKey::Paused, &true);
}

pub fn unpause(env: &Env) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    env.storage().instance().set(&UpgradeKey::Paused, &false);
}

pub fn ensure_not_paused(env: &Env) {
    let paused: bool = env.storage().instance().get(&UpgradeKey::Paused).unwrap();
    if paused {
        panic!("Contract is paused");
    }
}

// -------------------------------------
// Upgrade Proposal
// -------------------------------------

pub fn propose_upgrade(env: &Env, new_wasm_hash: BytesN<32>) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    if env.storage().instance().has(&UpgradeKey::PendingWasmHash) {
        panic!("Upgrade already pending");
    }

    let now = env.ledger().timestamp();

    env.storage().instance().set(&UpgradeKey::PendingWasmHash, &new_wasm_hash);
    env.storage().instance().set(&UpgradeKey::UpgradeTimestamp, &(now + UPGRADE_DELAY));
}

pub fn cancel_upgrade(env: &Env) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    if !env.storage().instance().has(&UpgradeKey::PendingWasmHash) {
        panic!("No pending upgrade");
    }

    env.storage().instance().remove(&UpgradeKey::PendingWasmHash);
    env.storage().instance().remove(&UpgradeKey::UpgradeTimestamp);
}
// -------------------------------------
// Execute Upgrade
// -------------------------------------
if !env.storage().instance().has(&UpgradeKey::PendingWasmHash) {
    panic!("No pending upgrade");
}
let paused: bool = env.storage()
    .instance()
    .get(&UpgradeKey::Paused)
    .unwrap();

if !paused {
    panic!("Contract must be paused before upgrade");
}

pub fn transfer_admin(env: &Env, new_admin: Address) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    env.storage().instance().set(&UpgradeKey::Admin, &new_admin);
}

pub fn execute_upgrade(env: &Env) {
    let admin: Address = get_admin(env);
    admin.require_auth();

    let paused: bool = env.storage()
    .instance()
    .get(&UpgradeKey::Paused)
    .unwrap();

if !paused {
    panic!("Contract must be paused before upgrade");
}

    let scheduled: u64 = env.storage().instance()
        .get(&UpgradeKey::UpgradeTimestamp)
        .unwrap();

    let now = env.ledger().timestamp();

    if now < scheduled {
        panic!("Upgrade timelock not expired");
    }

    let wasm_hash: BytesN<32> = env.storage().instance()
        .get(&UpgradeKey::PendingWasmHash)
        .unwrap();

    env.deployer().update_current_contract_wasm(wasm_hash);

    // Increment version
    let version: u32 = env.storage().instance()
        .get(&UpgradeKey::Version)
        .unwrap();

    env.storage().instance().set(&UpgradeKey::Version, &(version + 1));

    // Clear proposal
    env.storage().instance().remove(&UpgradeKey::PendingWasmHash);
    env.storage().instance().remove(&UpgradeKey::UpgradeTimestamp);
}

// -------------------------------------
// Helpers
// -------------------------------------

fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&UpgradeKey::Admin)
        .unwrap()
}