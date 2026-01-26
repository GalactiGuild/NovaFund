#![no_std]

use shared::{
    errors::Error,
    events::{PAYMENT_RECEIVED, PAYMENT_SETUP, PAYMENT_WITHDRAWN},
};
use soroban_sdk::{contract, contractimpl, contracttype, token::TokenClient, Address, Env, Map};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Stakeholder(u64, Address), // (project_id, stakeholder) -> BasisPoints
    StakeholderInfo(u64, Address), // (project_id, stakeholder) -> StakeholderInfo
    ProjectToken(u64),         // project_id -> Address
    AccPaymentPerShare(u64),   // project_id -> i128
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct StakeholderInfo {
    pub shares: u32,
    pub accumulated_at_last_update: i128,
    pub claimable_amount: i128,
}

#[contract]
pub struct MultiPartyPayment;

#[cfg(test)]
mod tests;

const PRECISION: i128 = 1_000_000_000_000;

#[contractimpl]
impl MultiPartyPayment {
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    pub fn setup_payment(
        env: Env,
        project_id: u64,
        token: Address,
        stakeholders: Map<Address, u32>,
    ) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        let mut total_shares: u32 = 0;
        let current_acc = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::AccPaymentPerShare(project_id))
            .unwrap_or(0);

        for (address, shares) in stakeholders.iter() {
            total_shares += shares;
            let info = StakeholderInfo {
                shares,
                accumulated_at_last_update: current_acc,
                claimable_amount: 0,
            };
            env.storage().persistent().set(
                &DataKey::StakeholderInfo(project_id, address.clone()),
                &info,
            );
        }

        if total_shares != 10000 {
            return Err(Error::InvalidInput); // Must be exactly 100%
        }

        env.storage()
            .persistent()
            .set(&DataKey::ProjectToken(project_id), &token);

        env.events().publish((PAYMENT_SETUP,), project_id);
        Ok(())
    }

    pub fn receive_payment(
        env: Env,
        project_id: u64,
        payer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        payer.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        let token_address: Address = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectToken(project_id))
            .ok_or(Error::NotFound)?;
        let token_client = TokenClient::new(&env, &token_address);

        // Transfer to contract
        token_client.transfer(&payer, &env.current_contract_address(), &amount);

        // Update global accumulated payment
        let current_acc = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::AccPaymentPerShare(project_id))
            .unwrap_or(0);
        let delta = (amount.checked_mul(PRECISION).ok_or(Error::InvalidInput)?) / 10000;
        env.storage().persistent().set(
            &DataKey::AccPaymentPerShare(project_id),
            &(current_acc + delta),
        );

        env.events()
            .publish((PAYMENT_RECEIVED,), (project_id, payer, amount));
        Ok(())
    }

    pub fn withdraw(env: Env, project_id: u64, stakeholder: Address) -> Result<i128, Error> {
        stakeholder.require_auth();

        let token_address: Address = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectToken(project_id))
            .ok_or(Error::NotFound)?;
        let mut info: StakeholderInfo = env
            .storage()
            .persistent()
            .get(&DataKey::StakeholderInfo(project_id, stakeholder.clone()))
            .ok_or(Error::NotFound)?;

        let current_acc = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::AccPaymentPerShare(project_id))
            .unwrap_or(0);

        let pending =
            (info.shares as i128 * (current_acc - info.accumulated_at_last_update)) / PRECISION;
        let total_claimable = info.claimable_amount + pending;

        if total_claimable <= 0 {
            return Err(Error::InvalidInput);
        }

        info.claimable_amount = 0;
        info.accumulated_at_last_update = current_acc;
        env.storage().persistent().set(
            &DataKey::StakeholderInfo(project_id, stakeholder.clone()),
            &info,
        );

        let token_client = TokenClient::new(&env, &token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &stakeholder,
            &total_claimable,
        );

        env.events().publish(
            (PAYMENT_WITHDRAWN,),
            (project_id, stakeholder, total_claimable),
        );
        Ok(total_claimable)
    }

    pub fn get_balance(env: Env, project_id: u64, stakeholder: Address) -> Result<i128, Error> {
        let info: StakeholderInfo = env
            .storage()
            .persistent()
            .get(&DataKey::StakeholderInfo(project_id, stakeholder))
            .ok_or(Error::NotFound)?;
        let current_acc = env
            .storage()
            .persistent()
            .get::<_, i128>(&DataKey::AccPaymentPerShare(project_id))
            .unwrap_or(0);

        let pending =
            (info.shares as i128 * (current_acc - info.accumulated_at_last_update)) / PRECISION;
        Ok(info.claimable_amount + pending)
    }
}
