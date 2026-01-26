// TODO: Implement profit distribution contract
// This contract will handle:
// - Register investors and their share percentages
// - Deposit profits for distribution
// - Automatic proportional distribution
// - Dividend claiming mechanism

#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, token::TokenClient, Address, Env, Map};

mod errors;
mod events;
mod storage;
mod types;

#[cfg(test)]
mod tests;

use crate::{
    errors::ContractError,
    events::{emit_claim_event, emit_deposit_event},
    storage::*,
    types::InvestorShare,
};

const PRECISION: i128 = 1_000_000_000_000;

contractmeta!(key = "name", val = "Profit Distribution Contract");

#[contract]
pub struct ProfitDistribution;

#[contractimpl]
impl ProfitDistribution {
    /// Initialize a new profit distribution for a project
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if get_admin(&env).is_some() {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        set_admin(&env, &admin);
        Ok(())
    }

    /// Register the token used for project profits
    pub fn set_token(env: Env, project_id: u64, token: Address) -> Result<(), ContractError> {
        let admin = get_admin(&env).ok_or(ContractError::NotInitialized)?;
        admin.require_auth();
        set_project_token(&env, project_id, &token);
        Ok(())
    }

    /// Register investors with their share percentages
    pub fn register_investors(
        env: Env,
        project_id: u64,
        investors: Map<Address, u32>,
    ) -> Result<(), ContractError> {
        let admin = get_admin(&env).ok_or(ContractError::NotInitialized)?;
        admin.require_auth();

        let mut total_shares: u32 = 0;
        let current_acc = get_acc_profit_per_share(&env, project_id);

        for (investor, share_percentage) in investors.iter() {
            if share_percentage == 0 {
                return Err(ContractError::InvalidSharePercentage);
            }
            total_shares += share_percentage;

            let share = InvestorShare {
                investor: investor.clone(),
                share_percentage,
                accumulated_at_last_update: current_acc,
                claimable_amount: 0,
                total_claimed: 0,
            };
            set_investor_share(&env, project_id, &investor, &share);
        }

        if total_shares > 10000 {
            return Err(ContractError::TotalSharesNot100);
        }

        set_total_shares(&env, project_id, total_shares);
        Ok(())
    }

    /// Deposit profits to be distributed among investors
    pub fn deposit_profits(
        env: Env,
        project_id: u64,
        depositor: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        depositor.require_auth();

        let token_address =
            get_project_token(&env, project_id).ok_or(ContractError::NotInitialized)?;
        let total_shares =
            get_total_shares(&env, project_id).ok_or(ContractError::NotInitialized)?;

        if total_shares == 0 {
            return Err(ContractError::InvalidAmount);
        }

        // Transfer tokens to contract
        let token_client = TokenClient::new(&env, &token_address);
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        // Update global accumulated profit
        let current_acc = get_acc_profit_per_share(&env, project_id);
        let delta = (amount
            .checked_mul(PRECISION)
            .ok_or(ContractError::InvalidAmount)?)
            / (total_shares as i128);
        set_acc_profit_per_share(&env, project_id, current_acc + delta);

        emit_deposit_event(&env, project_id, amount);
        Ok(())
    }

    /// Allow an investor to claim their dividends
    pub fn claim_dividends(
        env: Env,
        project_id: u64,
        investor: Address,
    ) -> Result<i128, ContractError> {
        investor.require_auth();

        let token_address =
            get_project_token(&env, project_id).ok_or(ContractError::NotInitialized)?;
        let mut share =
            get_investor_share(&env, project_id, &investor).ok_or(ContractError::Unauthorized)?;

        let current_acc = get_acc_profit_per_share(&env, project_id);

        // Calculate pending amount
        let pending = (share.share_percentage as i128
            * (current_acc - share.accumulated_at_last_update))
            / PRECISION;
        let total_claimable = share.claimable_amount + pending;

        if total_claimable <= 0 {
            return Err(ContractError::NothingToClaim);
        }

        // Update user state
        share.claimable_amount = 0;
        share.accumulated_at_last_update = current_acc;
        share.total_claimed += total_claimable;
        set_investor_share(&env, project_id, &investor, &share);

        // Transfer funds
        let token_client = TokenClient::new(&env, &token_address);
        token_client.transfer(&env.current_contract_address(), &investor, &total_claimable);

        emit_claim_event(&env, project_id, &investor, total_claimable);
        Ok(total_claimable)
    }

    /// Get investor share information
    pub fn get_investor_share(
        env: Env,
        project_id: u64,
        investor: Address,
    ) -> Result<InvestorShare, ContractError> {
        let mut share =
            get_investor_share(&env, project_id, &investor).ok_or(ContractError::Unauthorized)?;

        let current_acc = get_acc_profit_per_share(&env, project_id);
        let pending = (share.share_percentage as i128
            * (current_acc - share.accumulated_at_last_update))
            / PRECISION;
        share.claimable_amount += pending;

        Ok(share)
    }

    /// Get contract admin
    pub fn get_admin(env: Env) -> Option<Address> {
        get_admin(&env)
    }
}
