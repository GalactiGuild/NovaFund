use soroban_sdk::{Address, Env};

use shared::{
    errors::Error,
    events::{INVESTOR_ADDED, INVESTOR_REMOVED, WHITELIST_DISABLED, WHITELIST_ENABLED},
};

use crate::DataKey;

// ---------- storage helpers ----------

fn whitelist_enabled_key(project_id: u64) -> (DataKey, u64) {
    (DataKey::WhitelistEnabled, project_id)
}

fn whitelist_key(project_id: u64, investor: &Address) -> (DataKey, u64, Address) {
    (DataKey::Whitelist, project_id, investor.clone())
}

// ---------- public API ----------

/// Enable the whitelist for a project. Only the project creator may call this.
pub fn enable_whitelist(env: &Env, project_id: u64, caller: &Address) -> Result<(), Error> {
    require_creator(env, project_id, caller)?;
    env.storage()
        .instance()
        .set(&whitelist_enabled_key(project_id), &true);
    env.events()
        .publish((WHITELIST_ENABLED,), (project_id, caller.clone()));
    Ok(())
}

/// Disable the whitelist for a project. Only the project creator may call this.
pub fn disable_whitelist(env: &Env, project_id: u64, caller: &Address) -> Result<(), Error> {
    require_creator(env, project_id, caller)?;
    env.storage()
        .instance()
        .remove(&whitelist_enabled_key(project_id));
    env.events()
        .publish((WHITELIST_DISABLED,), (project_id, caller.clone()));
    Ok(())
}

/// Add an investor to the project whitelist. Only the project creator may call this.
pub fn add_investor(
    env: &Env,
    project_id: u64,
    caller: &Address,
    investor: &Address,
) -> Result<(), Error> {
    require_creator(env, project_id, caller)?;
    env.storage()
        .instance()
        .set(&whitelist_key(project_id, investor), &true);
    env.events()
        .publish((INVESTOR_ADDED,), (project_id, investor.clone()));
    Ok(())
}

/// Remove an investor from the project whitelist. Only the project creator may call this.
pub fn remove_investor(
    env: &Env,
    project_id: u64,
    caller: &Address,
    investor: &Address,
) -> Result<(), Error> {
    require_creator(env, project_id, caller)?;
    env.storage()
        .instance()
        .remove(&whitelist_key(project_id, investor));
    env.events()
        .publish((INVESTOR_REMOVED,), (project_id, investor.clone()));
    Ok(())
}

/// Returns true if the whitelist is active AND the investor is not on it.
/// A disabled whitelist never blocks anyone.
pub fn is_blocked(env: &Env, project_id: u64, investor: &Address) -> bool {
    let enabled: bool = env
        .storage()
        .instance()
        .get(&whitelist_enabled_key(project_id))
        .unwrap_or(false);

    if !enabled {
        return false;
    }

    !env.storage()
        .instance()
        .has(&whitelist_key(project_id, investor))
}

/// Returns whether the whitelist is currently enabled for a project.
pub fn is_whitelist_enabled(env: &Env, project_id: u64) -> bool {
    env.storage()
        .instance()
        .get(&whitelist_enabled_key(project_id))
        .unwrap_or(false)
}

// ---------- internal ----------

fn require_creator(env: &Env, project_id: u64, caller: &Address) -> Result<(), Error> {
    let project: crate::Project = env
        .storage()
        .instance()
        .get(&(DataKey::Project, project_id))
        .ok_or(Error::NotFound)?;

    if project.creator != *caller {
        return Err(Error::Unauthorized);
    }
    Ok(())
}
