#![no_std]

use shared::Error;
use soroban_sdk::{
    contractimpl, contracttype, panic_with_error, symbol_short, Address, Env, Map,
    Symbol, Vec, String,
};

pub struct PerkAuctionContract;

#[derive(Clone)]
#[contracttype]
pub struct Perk {
    pub id: u64,
    pub project_id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub metadata_uri: String,
    pub total_supply: u64,
    pub current_supply: u64,
    pub initial_price: i64,
    pub reserve_price: i64,
    pub start_price: i64,
    pub current_price: i64,
    pub decay_rate: i64,
    pub start_ledger: u64,
    pub duration: u64,
    pub sold_out: bool,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct PerkPurchase {
    pub perk_id: u64,
    pub buyer: Address,
    pub price_paid: i64,
    pub purchased_at: u64,
    pub token_id: Option<u64>,
}

#[contracttype]
pub struct AuctionState {
    pub next_perk_id: u64,
    pub total_perks: u64,
    pub admin: Address,
    pub is_paused: bool,
}

// Storage keys
const ADMIN: Symbol = symbol_short!("ADMIN");
const AUCTION_STATE: Symbol = symbol_short!("AUCTION_ST");
const PERKS: Symbol = symbol_short!("PERKS");
const PURCHASES: Symbol = symbol_short!("PURCHASE");
const USER_PERKS: Symbol = symbol_short!("USER_PERK");

#[contractimpl]
impl PerkAuctionContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic_with_error!(&env, Error::AlreadyInit);
        }

        let state = AuctionState {
            next_perk_id: 1,
            total_perks: 0,
            admin: admin.clone(),
            is_paused: false,
        };

        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&AUCTION_STATE, &state);
    }

    pub fn create_perk(
        env: Env,
        project_id: u64,
        title: String,
        description: String,
        metadata_uri: String,
        total_supply: u64,
        initial_price: i64,
        reserve_price: i64,
        duration: u64,
    ) -> u64 {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        if total_supply == 0 {
            panic_with_error!(&env, Error::InvInput);
        }

        if initial_price <= reserve_price {
            panic_with_error!(&env, Error::InvInput);
        }

        if duration == 0 {
            panic_with_error!(&env, Error::InvInput);
        }

        let mut state: AuctionState = env.storage().instance().get(&AUCTION_STATE).unwrap();
        let perk_id = state.next_perk_id;

        let current_ledger: u32 = env.ledger().sequence();
        let decay_rate = Self::calculate_decay_rate(initial_price, reserve_price, duration);

        let perk = Perk {
            id: perk_id,
            project_id,
            creator: env.current_contract_address(),
            title,
            description,
            metadata_uri,
            total_supply,
            current_supply: 0,
            initial_price,
            reserve_price,
            start_price: initial_price,
            current_price: initial_price,
            decay_rate,
            start_ledger: current_ledger as u64,
            duration,
            sold_out: false,
            created_at: current_ledger as u64,
        };

        let mut perks: Map<u64, Perk> = env.storage().instance().get(&PERKS).unwrap_or(Map::new(&env));
        perks.set(perk_id, perk);
        env.storage().instance().set(&PERKS, &perks);

        state.next_perk_id += 1;
        state.total_perks += 1;
        env.storage().instance().set(&AUCTION_STATE, &state);

        perk_id
    }

    pub fn purchase_perk(env: Env, perk_id: u64, buyer: Address) -> i64 {
        let state: AuctionState = env.storage().instance().get(&AUCTION_STATE).unwrap();
        
        if state.is_paused {
            panic_with_error!(&env, Error::Paused);
        }

        let mut perks: Map<u64, Perk> = env.storage().instance().get(&PERKS).unwrap();
        let mut perk: Perk = perks.get(perk_id).unwrap_or_else(|| {
            panic_with_error!(&env, Error::NotFound);
        });

        if perk.sold_out || perk.current_supply >= perk.total_supply {
            panic_with_error!(&env, Error::InsufFunds);
        }

        let current_price = Self::get_current_price_internal(&env, &perk);
        
        // Check if auction has ended
        let current_ledger: u32 = env.ledger().sequence();
        if current_ledger > (perk.start_ledger as u32) + (perk.duration as u32) {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        // Process payment (simplified - in real implementation, would transfer tokens)
        // For now, we'll just record the purchase
        
        let purchase = PerkPurchase {
            perk_id,
            buyer: buyer.clone(),
            price_paid: current_price,
            purchased_at: current_ledger as u64,
            token_id: None, // Would be minted in real NFT implementation
        };

        let mut purchases: Vec<PerkPurchase> = env.storage().instance()
            .get(&PURCHASES)
            .unwrap_or(Vec::new(&env));
        purchases.push_back(purchase);

        // Update user's perk ownership
        let mut user_perks: Vec<u64> = env.storage().instance()
            .get(&USER_PERKS)
            .unwrap_or(Vec::new(&env));
        user_perks.push_back(perk_id);
        env.storage().instance().set(&USER_PERKS, &user_perks);

        // Update perk state
        perk.current_supply += 1;
        let sold_out = perk.current_supply >= perk.total_supply;
        if sold_out {
            perk.sold_out = true;
        }
        perk.current_price = Self::get_next_price(&env, &perk);

        perks.set(perk_id, perk);
        env.storage().instance().set(&PERKS, &perks);
        env.storage().instance().set(&PURCHASES, &purchases);

        // Handle refunds if auction sold out quickly
        if sold_out {
            Self::handle_quick_sale_refunds(&env, perk_id);
        }

        current_price
    }

    pub fn get_perk(env: Env, perk_id: u64) -> Perk {
        let perks: Map<u64, Perk> = env.storage().instance().get(&PERKS).unwrap();
        perks.get(perk_id).unwrap_or_else(|| {
            panic_with_error!(&env, Error::NotFound);
        })
    }

    pub fn get_current_price(env: Env, perk_id: u64) -> i64 {
        let perk: Perk = Self::get_perk(env.clone(), perk_id);
        Self::get_current_price_internal(&env, &perk)
    }

    pub fn get_user_perks(env: Env, user: Address) -> Vec<u64> {
        // In a real implementation, this would be user-specific storage
        // For now, return all purchases by this user
        let purchases: Vec<PerkPurchase> = env.storage().instance()
            .get(&PURCHASES)
            .unwrap_or(Vec::new(&env));
        
        let mut user_perks = Vec::new(&env);
        for purchase in purchases.iter() {
            if purchase.buyer == user {
                user_perks.push_back(purchase.perk_id);
            }
        }
        user_perks
    }

    pub fn pause_contract(env: Env) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        let mut state: AuctionState = env.storage().instance().get(&AUCTION_STATE).unwrap();
        state.is_paused = true;
        env.storage().instance().set(&AUCTION_STATE, &state);
    }

    pub fn unpause_contract(env: Env) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        let mut state: AuctionState = env.storage().instance().get(&AUCTION_STATE).unwrap();
        state.is_paused = false;
        env.storage().instance().set(&AUCTION_STATE, &state);
    }

    pub fn update_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        env.storage().instance().set(&ADMIN, &new_admin);
    }

    // Helper functions
    fn get_current_price_internal(env: &Env, perk: &Perk) -> i64 {
        let current_ledger: u32 = env.ledger().sequence();
        let elapsed = current_ledger.saturating_sub(perk.start_ledger as u32);
        
        if elapsed >= perk.duration as u32 {
            perk.reserve_price
        } else {
            let price_reduction = perk.decay_rate.checked_mul(elapsed as i64).unwrap();
            let new_price = perk.start_price.checked_sub(price_reduction).unwrap();
            new_price.max(perk.reserve_price)
        }
    }

    fn get_next_price(env: &Env, perk: &Perk) -> i64 {
        let current_ledger: u32 = env.ledger().sequence();
        let elapsed = current_ledger.saturating_sub(perk.start_ledger as u32);
        
        if elapsed >= perk.duration as u32 {
            perk.reserve_price
        } else {
            let price_reduction = perk.decay_rate.checked_mul((elapsed + 1) as i64).unwrap();
            let new_price = perk.start_price.checked_sub(price_reduction).unwrap();
            new_price.max(perk.reserve_price)
        }
    }

    fn calculate_decay_rate(initial_price: i64, reserve_price: i64, duration: u64) -> i64 {
        if duration == 0 {
            return 0;
        }
        
        let price_difference = initial_price.checked_sub(reserve_price).unwrap();
        price_difference.checked_div(duration as i64).unwrap()
    }

    fn handle_quick_sale_refunds(env: &Env, perk_id: u64) {
        // If auction sold out quickly (before reaching reserve price),
        // refund difference to early buyers
        let perks: Map<u64, Perk> = env.storage().instance().get(&PERKS).unwrap();
        let perk: Perk = perks.get(perk_id).unwrap();
        
        let purchases: Vec<PerkPurchase> = env.storage().instance()
            .get(&PURCHASES)
            .unwrap_or(Vec::new(&env));
        
        let current_ledger: u32 = env.ledger().sequence();
        let elapsed = current_ledger.saturating_sub(perk.start_ledger as u32);
        
        // If sold out in first 25% of auction duration
        if elapsed < (perk.duration as u32).checked_div(4).unwrap() {
            for purchase in purchases.iter() {
                if purchase.perk_id == perk_id {
                    let refund_amount = purchase.price_paid.checked_sub(perk.reserve_price).unwrap();
                    if refund_amount > 0 {
                        // In real implementation, transfer refund tokens to buyer
                        // For now, we'll just log that a refund is due
                        // This would require token integration
                    }
                }
            }
        }
    }
}
