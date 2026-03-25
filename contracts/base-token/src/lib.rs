#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    token::{self, Interface as TokenInterface},
    Address, Env, String,
};
use soroban_token_sdk::event::Events;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Allowance(Address, Address), // (from, spender)
    Balance(Address),
    Metadata,  // TokenMetadata struct
    FeeConfig, // FeeConfiguration struct
}

#[contracttype]
#[derive(Clone)]
pub struct TokenMetadata {
    pub decimal: u32,
    pub name: String,
    pub symbol: String,
}

#[contracttype]
#[derive(Clone)]
pub struct FeeConfiguration {
    pub recipient: Address,
    pub fee_basis_points: u32, // out of 10000
}

fn read_balance(env: &Env, address: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(address.clone()))
        .unwrap_or(0)
}

fn write_balance(env: &Env, address: &Address, amount: i128) {
    if amount == 0 {
        return; // optimization
    }
    env.storage()
        .persistent()
        .set(&DataKey::Balance(address.clone()), &amount);
}

fn read_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Allowance(from.clone(), spender.clone()))
        .unwrap_or(0)
}

fn write_allowance(env: &Env, from: &Address, spender: &Address, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Allowance(from.clone(), spender.clone()), &amount);
}

#[contract]
pub struct BaseToken;

#[contractimpl]
impl BaseToken {
    /// Initialize the token with admin, metadata, and fee config
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
        fee_recipient: Address,
        fee_basis_points: u32,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);

        let metadata = TokenMetadata {
            decimal,
            name,
            symbol,
        };
        env.storage().instance().set(&DataKey::Metadata, &metadata);

        if fee_basis_points > 10000 {
            panic!("Fee basis points cannot exceed 10000");
        }

        let fee_config = FeeConfiguration {
            recipient: fee_recipient,
            fee_basis_points,
        };
        env.storage()
            .instance()
            .set(&DataKey::FeeConfig, &fee_config);
    }

    /// Admin can update fee configuration
    pub fn set_fee_config(env: Env, recipient: Address, fee_basis_points: u32) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();

        if fee_basis_points > 10000 {
            panic!("Fee basis points cannot exceed 10000");
        }

        let fee_config = FeeConfiguration {
            recipient,
            fee_basis_points,
        };
        env.storage()
            .instance()
            .set(&DataKey::FeeConfig, &fee_config);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        if amount < 0 {
            panic!("Negative amount");
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let bal = read_balance(&env, &to);
        write_balance(&env, &to, bal.checked_add(amount).unwrap());

        Events::new(&env).mint(admin, to, amount);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        Events::new(&env).set_admin(admin, new_admin);
    }
}

// Implement the standard Token Interface
#[contractimpl]
impl token::Interface for BaseToken {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        read_allowance(&env, &from, &spender)
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32) {
        from.require_auth();
        if amount < 0 {
            panic!("Negative amount");
        }
        write_allowance(&env, &from, &spender, amount);
        Events::new(&env).approve(from, spender, amount, expiration_ledger);
    }

    fn balance(env: Env, id: Address) -> i128 {
        read_balance(&env, &id)
    }

    fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::do_transfer(&env, &from, &to, amount);
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("Negative amount");
        }

        let allowance = read_allowance(&env, &from, &spender);
        if allowance < amount {
            panic!("Insufficient allowance");
        }

        write_allowance(&env, &from, &spender, allowance - amount);
        Self::do_transfer(&env, &from, &to, amount);
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        if amount < 0 {
            panic!("Negative amount");
        }

        let bal = read_balance(&env, &from);
        if bal < amount {
            panic!("Insufficient balance");
        }

        write_balance(&env, &from, bal - amount);
        Events::new(&env).burn(from, amount);
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        if amount < 0 {
            panic!("Negative amount");
        }

        let allowance = read_allowance(&env, &from, &spender);
        if allowance < amount {
            panic!("Insufficient allowance");
        }

        let bal = read_balance(&env, &from);
        if bal < amount {
            panic!("Insufficient balance");
        }

        write_allowance(&env, &from, &spender, allowance - amount);
        write_balance(&env, &from, bal - amount);
        Events::new(&env).burn(from, amount);
    }

    fn decimals(env: Env) -> u32 {
        let meta: TokenMetadata = env.storage().instance().get(&DataKey::Metadata).unwrap();
        meta.decimal
    }

    fn name(env: Env) -> String {
        let meta: TokenMetadata = env.storage().instance().get(&DataKey::Metadata).unwrap();
        meta.name
    }

    fn symbol(env: Env) -> String {
        let meta: TokenMetadata = env.storage().instance().get(&DataKey::Metadata).unwrap();
        meta.symbol
    }
}

impl BaseToken {
    /// Internal transfer logic that computes fees and processes dust correctly.
    fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        if amount < 0 {
            panic!("Negative amount");
        }
        if amount == 0 {
            return;
        }

        let bal = read_balance(env, from);
        if bal < amount {
            panic!("Insufficient balance");
        }

        let fee_config: FeeConfiguration =
            env.storage().instance().get(&DataKey::FeeConfig).unwrap();

        // Calculate fee
        // fee = (amount * fee_basis_points) / 10000
        let fee = (amount
            .checked_mul(fee_config.fee_basis_points as i128)
            .unwrap())
            / 10000;

        // Handle dust limits carefully:
        // If transfer implies a fee, but due to integer math it evaluates to 0,
        // AND the user is not exempt, then small literal transfers bypass the fee.
        // For dust limits, we intercept this by forcing a minimum fee of 1 if fee evaluates to 0 but fee_basis_points > 0.
        // Exception: if the amount is 1, a fee of 1 is 100%, which destroys the transfer.
        // It's standard to let dust bypass (fee=0) or we round up.
        // We will round up if amount > 0 and fee_basis_points > 0 and fee == 0.
        let actual_fee = if fee == 0 && fee_config.fee_basis_points > 0 && amount > 1 {
            1
        } else {
            fee
        };

        let net_amount = amount - actual_fee;

        // Deduct full amount from sender
        write_balance(env, from, bal - amount);

        // Credit to Treasury
        if actual_fee > 0 {
            // Avoid circular updates if destination is treasury
            let treasury_bal = read_balance(env, &fee_config.recipient);
            write_balance(env, &fee_config.recipient, treasury_bal + actual_fee);
            Events::new(env).transfer(from.clone(), fee_config.recipient.clone(), actual_fee);
        }

        // Credit to recipient
        if net_amount > 0 {
            let to_bal = read_balance(env, to);
            write_balance(env, to, to_bal + net_amount);
            Events::new(env).transfer(from.clone(), to.clone(), net_amount);
        }
    }
}

#[cfg(test)]
mod test;
