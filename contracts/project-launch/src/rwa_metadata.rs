use soroban_sdk::{Address, Env, String};

use shared::errors::Error;

use crate::{DataKey, Project};

pub(crate) fn write_rwa_metadata_cid(
    env: &Env,
    project_id: u64,
    admin: &Address,
    cid: &String,
) -> Result<(), Error> {
    let project: Project = env
        .storage()
        .instance()
        .get(&(DataKey::Project, project_id))
        .ok_or(Error::NotFound)?;

    if project.creator != *admin {
        return Err(Error::Unauthorized);
    }

    admin.require_auth();
    env.storage()
        .persistent()
        .set(&(DataKey::RwaMetadataCid, project_id), cid);

    Ok(())
}

pub(crate) fn read_rwa_metadata_cid(env: &Env, project_id: u64) -> Option<String> {
    env.storage()
        .persistent()
        .get(&(DataKey::RwaMetadataCid, project_id))
}
