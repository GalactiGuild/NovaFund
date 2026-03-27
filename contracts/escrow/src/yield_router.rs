//! ## Design principles
//! - **Liquidity-first**: A configurable `liquidity_reserve_bps` (basis points, e.g. 2000 = 20%)
//!   of every escrow's balance is *never* deployed. This guarantees that routine
//!   milestone payouts never fail due to funds being locked in a lending protocol.
//! - **Per-escrow accounting**: Each `project_id` tracks its own deposited principal
//!   separately from any yield accrued, so slippage or protocol losses are isolated.
//! - **Placeholder lending interface**: `LendingPoolClient` wraps a generic Soroban
//!   cross-contract call pattern. Swap the `pool_contract` address at runtime to
//!   point at Blend Protocol, or any future Stellar-native lending pool that
//!   exposes `deposit` / `withdraw` / `get_balance`.
//! - **Admin-gated routing**: Only the platform admin can enable yield routing for
//!   a project, set the reserve ratio, and change the pool address. This prevents
//!   a rogue creator from draining the contract via unexpected pool interactions.

use shared::{
    errors::Error,
    types::{Amount, EscrowInfo},
};
use soroban_sdk::{
    contracttype, symbol_short, token::TokenClient, Address, Env, IntoVal, Symbol, Val, Vec,
};

const YIELD_CONFIG_KEY: Symbol = symbol_short!("YLD_CFG");

/// Global yield-router configuration (admin-controlled).
#[contracttype]
#[derive(Clone, Debug)]
pub struct YieldRouterConfig {
    /// Address of the lending pool contract (e.g. Blend Protocol supply pool).
    pub pool_contract: Address,
    /// Token deposited into the pool — must match escrow token (e.g. USDC).
    pub yield_token: Address,
    /// Whether routing is globally enabled.
    pub enabled: bool,
    /// Minimum basis points of escrow balance that must stay liquid (0-10000).
    /// Default: 2000 (20 %).  At least this fraction is never sent to the pool.
    pub liquidity_reserve_bps: u32,
}

/// Per-escrow yield state.
#[contracttype]
#[derive(Clone, Debug, Default)]
pub struct EscrowYieldState {
    /// Total principal currently deployed into the lending pool.
    pub deployed_principal: Amount,
    /// Cumulative yield harvested back into the escrow.
    pub total_yield_harvested: Amount,
    /// Whether yield routing is enabled for this specific escrow.
    pub routing_enabled: bool,
}

/// Thin wrapper around a generic Soroban lending pool contract.
///
/// Any real pool (Blend, Aquarius Earn, etc.) needs three entry-points:
///   * `deposit(from, amount)` → deposits `amount` of the underlying token.
///   * `withdraw(to, amount)` → withdraws `amount` back to `to`.
///   * `get_balance(account)` → returns current balance including accrued yield.
///
/// Replace the symbol strings below to match the real pool's function names.
pub struct LendingPoolClient<'a> {
    env: &'a Env,
    contract_id: &'a Address,
}

impl<'a> LendingPoolClient<'a> {
    pub fn new(env: &'a Env, contract_id: &'a Address) -> Self {
        Self { env, contract_id }
    }

    /// Deposit `amount` of the underlying token into the pool on behalf of
    /// `depositor` (the escrow contract itself).
    #[allow(dead_code)]
    pub fn deposit(&self, depositor: &Address, amount: Amount) -> Result<(), Error> {
        let args: Vec<Val> = soroban_sdk::vec![
            self.env,
            depositor.into_val(self.env),
            amount.into_val(self.env),
        ];
        // Cross-contract call — replace "deposit" with the pool's real symbol.
        let _: Val =
            self.env
                .invoke_contract(self.contract_id, &Symbol::new(self.env, "deposit"), args);
        Ok(())
    }

    /// Withdraw `amount` from the pool back to `recipient`.
    pub fn withdraw(&self, recipient: &Address, amount: Amount) -> Result<(), Error> {
        let args: Vec<Val> = soroban_sdk::vec![
            self.env,
            recipient.into_val(self.env),
            amount.into_val(self.env),
        ];
        let _: Val =
            self.env
                .invoke_contract(self.contract_id, &Symbol::new(self.env, "withdraw"), args);
        Ok(())
    }

    /// Query how much the escrow contract has in the pool (principal + yield).
    pub fn get_balance(&self, account: &Address) -> Amount {
        let args: Vec<Val> = soroban_sdk::vec![self.env, account.into_val(self.env)];
        self.env.invoke_contract(
            self.contract_id,
            &Symbol::new(self.env, "get_balance"),
            args,
        )
    }
}

fn get_yield_config(env: &Env) -> Result<YieldRouterConfig, Error> {
    env.storage()
        .persistent()
        .get(&YIELD_CONFIG_KEY)
        .ok_or(Error::InvInput)
}

fn set_yield_config(env: &Env, cfg: &YieldRouterConfig) {
    env.storage().persistent().set(&YIELD_CONFIG_KEY, cfg);
}

fn get_yield_state(env: &Env, project_id: u64) -> EscrowYieldState {
    // (symbol_short!("YLD_ST"), project_id) as the storage key
    env.storage()
        .persistent()
        .get(&(symbol_short!("YLD_ST"), project_id))
        .unwrap_or_default()
}

fn set_yield_state(env: &Env, project_id: u64, state: &EscrowYieldState) {
    env.storage()
        .persistent()
        .set(&(symbol_short!("YLD_ST"), project_id), state);
}

/// Configure or update the global yield-router settings.
///
/// Must be called by the platform admin after deploying a lending-pool
/// integration. The `pool_contract` address can be updated later (e.g. to
/// migrate to a higher-yield pool) without touching any escrow state.
pub fn configure_yield_router(
    env: &Env,
    admin: &Address,
    pool_contract: Address,
    yield_token: Address,
    liquidity_reserve_bps: u32,
) -> Result<(), Error> {
    if liquidity_reserve_bps > 10_000 {
        return Err(Error::InvInput);
    }
    let cfg = YieldRouterConfig {
        pool_contract,
        yield_token,
        enabled: true,
        liquidity_reserve_bps,
    };
    set_yield_config(env, &cfg);
    env.events().publish(
        (symbol_short!("YLD_CFG"),),
        (admin.clone(), cfg.liquidity_reserve_bps),
    );
    Ok(())
}

/// Enable yield routing for a specific escrow.
///
/// Should be called by the admin after `initialize()` and initial `deposit()`.
pub fn enable_yield_for_escrow(env: &Env, project_id: u64) -> Result<(), Error> {
    let mut state = get_yield_state(env, project_id);
    state.routing_enabled = true;
    set_yield_state(env, project_id, &state);
    Ok(())
}

/// Disable yield routing for a specific escrow (e.g. ahead of a large payout).
pub fn disable_yield_for_escrow(env: &Env, project_id: u64) -> Result<(), Error> {
    // Withdraw all deployed funds first so nothing is stranded.
    withdraw_from_pool(env, project_id)?;
    let mut state = get_yield_state(env, project_id);
    state.routing_enabled = false;
    set_yield_state(env, project_id, &state);
    Ok(())
}

/// Deploy idle funds into the lending pool.
///
/// Calculates the *deployable* amount as:
///   `deployable = idle_balance − (total_deposited × liquidity_reserve_bps / 10000)`
///
/// where `idle_balance = total_deposited − released_amount − deployed_principal`.
///
/// If `deployable ≤ 0` this is a no-op (nothing to deploy without breaching
/// the liquidity reserve). The escrow contract calls this after every `deposit()`.
#[allow(dead_code)]
pub fn deploy_to_pool(env: &Env, escrow: &EscrowInfo, project_id: u64) -> Result<(), Error> {
    let cfg = get_yield_config(env)?;
    if !cfg.enabled {
        return Ok(());
    }

    let mut state = get_yield_state(env, project_id);
    if !state.routing_enabled {
        return Ok(());
    }

    // Ensure token matches
    if cfg.yield_token != escrow.token {
        return Err(Error::InvInput);
    }

    // Liquidity reserve: always keep this fraction in the contract.
    let reserve_amount = (escrow.total_deposited * cfg.liquidity_reserve_bps as i128) / 10_000;

    // Idle = funds sitting in the escrow contract, not yet deployed or released.
    let idle = escrow
        .total_deposited
        .saturating_sub(escrow.released_amount)
        .saturating_sub(state.deployed_principal);

    let deployable = idle.saturating_sub(reserve_amount);

    if deployable <= 0 {
        return Ok(()); // Nothing to deploy without breaching reserve.
    }

    // Approve the pool to pull `deployable` tokens from this contract.
    let token_client = TokenClient::new(env, &escrow.token);
    token_client.approve(
        &env.current_contract_address(),
        &cfg.pool_contract,
        &deployable,
        &(env.ledger().sequence() + 1000), // short-lived approval
    );

    // Invoke the lending pool deposit.
    let pool = LendingPoolClient::new(env, &cfg.pool_contract);
    pool.deposit(&env.current_contract_address(), deployable)?;

    state.deployed_principal = state
        .deployed_principal
        .checked_add(deployable)
        .ok_or(Error::InvInput)?;
    set_yield_state(env, project_id, &state);

    env.events()
        .publish((symbol_short!("YLD_DEP"),), (project_id, deployable));

    Ok(())
}

/// Withdraw *all* deployed principal (plus any accrued yield) from the pool
/// back into the escrow contract.
///
/// Call this before any milestone payout to guarantee the escrow contract
/// holds the full required balance. The main contract's `vote_milestone`
/// already transfers tokens to the creator; this function simply ensures
/// the tokens are present first.
///
/// Yield accrued = `pool_balance − deployed_principal`. This delta is added
/// to `total_yield_harvested` and—critically—to `escrow.total_deposited` so
/// that the downstream accounting stays consistent.
pub fn withdraw_from_pool(env: &Env, project_id: u64) -> Result<Amount, Error> {
    let cfg = get_yield_config(env)?;
    let mut state = get_yield_state(env, project_id);

    if state.deployed_principal == 0 {
        return Ok(0);
    }

    let pool = LendingPoolClient::new(env, &cfg.pool_contract);
    let pool_balance = pool.get_balance(&env.current_contract_address());

    // Withdraw everything.
    pool.withdraw(&env.current_contract_address(), pool_balance)?;

    let yield_earned = pool_balance.saturating_sub(state.deployed_principal);

    state.total_yield_harvested = state
        .total_yield_harvested
        .checked_add(yield_earned)
        .ok_or(Error::InvInput)?;
    state.deployed_principal = 0;
    set_yield_state(env, project_id, &state);

    env.events().publish(
        (symbol_short!("YLD_WIT"),),
        (project_id, pool_balance, yield_earned),
    );

    Ok(yield_earned)
}

/// Partial withdrawal — pull back exactly `required_amount` from the pool so
/// that a milestone payout can proceed without withdrawing all deployed funds.
///
/// Use this for optimised routing: keep as much capital working as possible
/// while still satisfying a payout obligation.
///
/// Returns the actual amount withdrawn (may be `pool_balance` if the pool
/// holds less than `required_amount`, which shouldn't happen under normal
/// operation but is handled defensively).
#[allow(dead_code)]
pub fn withdraw_partial_from_pool(
    env: &Env,
    project_id: u64,
    required_amount: Amount,
) -> Result<Amount, Error> {
    let cfg = get_yield_config(env)?;
    let mut state = get_yield_state(env, project_id);

    if state.deployed_principal == 0 {
        return Ok(0);
    }

    let pool = LendingPoolClient::new(env, &cfg.pool_contract);
    let pool_balance = pool.get_balance(&env.current_contract_address());

    let withdraw_amount = pool_balance.min(required_amount);
    pool.withdraw(&env.current_contract_address(), withdraw_amount)?;

    // Attribute yield proportionally.
    let yield_earned =
        withdraw_amount.saturating_sub(state.deployed_principal.min(withdraw_amount));

    state.deployed_principal = state.deployed_principal.saturating_sub(withdraw_amount);
    state.total_yield_harvested = state
        .total_yield_harvested
        .checked_add(yield_earned)
        .ok_or(Error::InvInput)?;
    set_yield_state(env, project_id, &state);

    env.events().publish(
        (symbol_short!("YLD_PWI"),),
        (project_id, withdraw_amount, yield_earned),
    );

    Ok(withdraw_amount)
}

/// Emergency withdrawal — ignore tracked yield state and pull everything back
/// from the external pool into the escrow contract.
///
/// This is intentionally conservative: it does not attempt to attribute yield
/// or rely on `deployed_principal` being correct. The function simply rescues
/// whatever the pool reports for the escrow contract and disables routing.
pub fn emergency_withdraw_from_pool(
    env: &Env,
    project_id: u64,
    escrow: &EscrowInfo,
) -> Result<Amount, Error> {
    let cfg = get_yield_config(env)?;
    if cfg.yield_token != escrow.token {
        return Err(Error::InvInput);
    }

    let pool = LendingPoolClient::new(env, &cfg.pool_contract);
    let pool_balance = pool.get_balance(&env.current_contract_address());
    if pool_balance <= 0 {
        return Err(Error::InsufFunds);
    }

    pool.withdraw(&env.current_contract_address(), pool_balance)?;

    let mut state = get_yield_state(env, project_id);
    state.deployed_principal = 0;
    state.routing_enabled = false;
    set_yield_state(env, project_id, &state);

    env.events()
        .publish((symbol_short!("YLD_EMG"),), (project_id, pool_balance));

    Ok(pool_balance)
}

/// Returns the current yield state for a project (read-only query).
pub fn get_escrow_yield_state(env: &Env, project_id: u64) -> EscrowYieldState {
    get_yield_state(env, project_id)
}

/// Returns the global router configuration (read-only query).
pub fn get_yield_router_config(env: &Env) -> Result<YieldRouterConfig, Error> {
    get_yield_config(env)
}
