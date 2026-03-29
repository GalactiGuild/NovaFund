#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, symbol_short, Address, Env, Map,
    Vec, Symbol,
};
use shared::Error;

// Import AMM types
#[soroban_sdk::contractclient(name = "AMMClient")]
pub trait AMMTrait {
    fn get_pool(env: Env, pool_id: u64) -> Pool;
}

#[derive(Clone)]
#[contracttype]
pub struct Pool {
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: i64,
    pub reserve_b: i64,
    pub total_liquidity: i64,
    pub fee_rate: u32,
    pub created_at: u64,
}

#[cfg(test)]
mod tests;

const ADMIN: Symbol = symbol_short!("ADMIN");
const ORDER_BOOK: Symbol = symbol_short!("ORDERS");
const USER_ORDERS: Symbol = symbol_short!("UORDERS");
const NEXT_ORDER_ID: Symbol = symbol_short!("NEXT_ID");
const POOL_ADDRESS: Symbol = symbol_short!("POOL");

/// Order type: Buy or Sell
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OrderType {
    Buy = 0,   // Bid - want to buy token B with token A
    Sell = 1,  // Ask - want to sell token B for token A
}

/// Order status
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OrderStatus {
    Active = 0,
    PartiallyFilled = 1,
    Filled = 2,
    Cancelled = 3,
}

/// Limit Order structure
#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub order_id: u64,
    pub pool_id: u64,
    pub maker: Address,
    pub order_type: OrderType,
    pub price: i64,          // Price in terms of token A per token B (scaled by 1e6)
    pub amount_wanted: i64,  // Amount of token B wanted (for buy) or offered (for sell)
    pub amount_filled: i64,  // Amount already filled
    pub status: OrderStatus,
    pub created_at: u64,
}

/// Order book for a pool
#[contracttype]
#[derive(Clone)]
pub struct OrderBook {
    pub pool_id: u64,
    pub bids: Vec<Order>,  // Buy orders (sorted by price desc)
    pub asks: Vec<Order>,  // Sell orders (sorted by price asc)
}

/// Swap parameters for limit order execution
#[contracttype]
#[derive(Clone)]
pub struct LimitOrderParams {
    pub pool_id: u64,
    pub order_type: OrderType,
    pub price: i64,
    pub amount: i64,
    pub min_fill: i64,     // Minimum amount to fill (for partial fills)
    pub deadline: u64,
}

#[contract]
pub struct LimitOrders;

#[contractimpl]
impl LimitOrders {
    /// Initialize the limit orders contract
    pub fn initialize(env: Env, admin: Address, amm_pool_address: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic_with_error!(&env, Error::AlreadyInit);
        }

        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&POOL_ADDRESS, &amm_pool_address);
        env.storage().instance().set(&NEXT_ORDER_ID, &0u64);
    }

    /// Place a limit order
    pub fn place_order(env: Env, params: LimitOrderParams) -> Result<u64, Error> {
        if env.ledger().timestamp() > params.deadline && params.deadline > 0 {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        if params.amount <= 0 || params.price <= 0 {
            return Err(Error::InvInput);
        }

        // Get or create order book
        let mut order_books: Map<u64, OrderBook> = env
            .storage()
            .instance()
            .get(&ORDER_BOOK)
            .unwrap_or(Map::new(&env));

        let mut order_book = order_books.get(params.pool_id).unwrap_or(OrderBook {
            pool_id: params.pool_id,
            bids: Vec::new(&env),
            asks: Vec::new(&env),
        });

        // Get next order ID
        let order_id: u64 = env.storage().instance().get(&NEXT_ORDER_ID).unwrap_or(0);
        env.storage().instance().set(&NEXT_ORDER_ID, &(order_id + 1));

        // Create new order
        let maker = env.current_contract_address();
        let new_order = Order {
            order_id,
            pool_id: params.pool_id,
            maker: maker.clone(),
            order_type: params.order_type,
            price: params.price,
            amount_wanted: params.amount,
            amount_filled: 0,
            status: OrderStatus::Active,
            created_at: env.ledger().timestamp(),
        };

        // Add to appropriate side of order book
        match params.order_type {
            OrderType::Buy => {
                // Insert bid in descending price order
                let mut inserted = false;
                for (i, bid) in order_book.bids.iter().enumerate() {
                    if params.price > bid.price {
                        order_book.bids.set(i as u32, new_order.clone());
                        inserted = true;
                        break;
                    }
                }
                if !inserted {
                    order_book.bids.push_back(new_order);
                }
            }
            OrderType::Sell => {
                // Insert ask in ascending price order
                let mut inserted = false;
                for (i, ask) in order_book.asks.iter().enumerate() {
                    if params.price < ask.price {
                        order_book.asks.set(i as u32, new_order.clone());
                        inserted = true;
                        break;
                    }
                }
                if !inserted {
                    order_book.asks.push_back(new_order);
                }
            }
        }

        order_books.set(params.pool_id, order_book);
        env.storage().instance().set(&ORDER_BOOK, &order_books);

        // Track user's orders
        let mut user_orders: Map<Address, Vec<u64>> = env
            .storage()
            .instance()
            .get(&USER_ORDERS)
            .unwrap_or(Map::new(&env));
        
        let mut orders = user_orders.get(maker.clone()).unwrap_or(Vec::new(&env));
        orders.push_back(order_id);
        user_orders.set(maker, orders);
        env.storage().instance().set(&USER_ORDERS, &user_orders);

        // Note: Immediate matching would be implemented here
        // For now, order is placed and waits for matching

        Ok(order_id)
    }

    /// Cancel an active order
    pub fn cancel_order(env: Env, order_id: u64) -> Result<(), Error> {
        let caller = env.current_contract_address();
        
        let mut order_books: Map<u64, OrderBook> = env
            .storage()
            .instance()
            .get(&ORDER_BOOK)
            .unwrap_or(Map::new(&env));

        // Find and remove the order
        let mut found = false;
        for (pool_id, mut order_book) in order_books.iter() {
            // Check bids
            let mut new_bids = Vec::new(&env);
            for bid in order_book.bids.iter() {
                if bid.order_id == order_id {
                    if bid.maker != caller {
                        return Err(Error::Unauthorized);
                    }
                    if bid.status != OrderStatus::Active && bid.status != OrderStatus::PartiallyFilled {
                        return Err(shared::Error::InvInput); // Use generic error
                    }
                    found = true;
                    // Don't add to new_bids (remove it)
                } else {
                    new_bids.push_back(bid.clone());
                }
            }
            order_book.bids = new_bids;
            
            // Check asks
            let mut new_asks = Vec::new(&env);
            for ask in order_book.asks.iter() {
                if ask.order_id == order_id {
                    if ask.maker != caller {
                        return Err(Error::Unauthorized);
                    }
                    if ask.status != OrderStatus::Active && ask.status != OrderStatus::PartiallyFilled {
                        return Err(shared::Error::InvInput); // Use generic error
                    }
                    found = true;
                    // Don't add to new_asks (remove it)
                } else {
                    new_asks.push_back(ask.clone());
                }
            }
            order_book.asks = new_asks;
            
            if found {
                order_books.set(pool_id, order_book);
                break;
            }
        }

        if !found {
            return Err(Error::NotFound);
        }

        env.storage().instance().set(&ORDER_BOOK, &order_books);
        Ok(())
    }

    /// Get order details
    pub fn get_order(env: Env, order_id: u64) -> Option<Order> {
        let order_books: Map<u64, OrderBook> = env
            .storage()
            .instance()
            .get(&ORDER_BOOK)
            .unwrap_or(Map::new(&env));

        for (_, order_book) in order_books.iter() {
            for bid in order_book.bids.iter() {
                if bid.order_id == order_id {
                    return Some(bid);
                }
            }
            for ask in order_book.asks.iter() {
                if ask.order_id == order_id {
                    return Some(ask);
                }
            }
        }
        None
    }

    /// Get all orders for a user
    pub fn get_user_orders(env: Env, user: Address) -> Vec<Order> {
        let user_order_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&USER_ORDERS)
            .unwrap_or(Map::new(&env))
            .get(user)
            .unwrap_or(Vec::new(&env));

        let mut result = Vec::new(&env);
        for order_id in user_order_ids.iter() {
            if let Some(order) = Self::get_order(env.clone(), order_id) {
                result.push_back(order);
            }
        }
        result
    }

    /// Get order book for a pool
    pub fn get_order_book(env: Env, pool_id: u64) -> Option<OrderBook> {
        let order_books: Map<u64, OrderBook> = env
            .storage()
            .instance()
            .get(&ORDER_BOOK)
            .unwrap_or(Map::new(&env));
        order_books.get(pool_id)
    }

    /// Execute a market order against existing limit orders
    pub fn execute_market_order(
        env: Env,
        pool_id: u64,
        order_type: OrderType,
        amount: i64,
        min_amount_out: i64,
        deadline: u64,
    ) -> Result<i64, Error> {
        if env.ledger().timestamp() > deadline && deadline > 0 {
            panic_with_error!(&env, Error::DeadlinePass);
        }

        let taker = env.current_contract_address();
        let mut total_filled = 0i64;

        let mut order_books: Map<u64, OrderBook> = env
            .storage()
            .instance()
            .get(&ORDER_BOOK)
            .unwrap_or(Map::new(&env));

        let mut order_book = order_books.get(pool_id).ok_or(Error::NotFound)?;

        // Match against opposite side of order book
        match order_type {
            OrderType::Buy => {
                // Match against asks (sell orders)
                let mut new_asks = Vec::new(&env);
                let mut remaining = amount;

                for ask in order_book.asks.iter() {
                    if remaining <= 0 {
                        new_asks.push_back(ask.clone());
                        continue;
                    }

                    if ask.status == OrderStatus::Active || ask.status == OrderStatus::PartiallyFilled {
                        let fill_amount = remaining.min(ask.amount_wanted - ask.amount_filled);
                        
                        if fill_amount > 0 {
                            // Execute trade between taker and maker
                            Self::execute_trade(&env, pool_id, &taker, &ask.maker, fill_amount, ask.price, order_type)?;
                            
                            total_filled += fill_amount;
                            remaining -= fill_amount;

                            // Update order - keep if not fully filled
                            if ask.amount_filled + fill_amount < ask.amount_wanted {
                                let mut updated_ask = ask.clone();
                                updated_ask.amount_filled += fill_amount;
                                updated_ask.status = OrderStatus::PartiallyFilled;
                                new_asks.push_back(updated_ask);
                            }
                            // If fully filled, don't add back to book
                        } else {
                            new_asks.push_back(ask.clone());
                        }
                    } else {
                        new_asks.push_back(ask.clone());
                    }
                }

                order_book.asks = new_asks;
            }
            OrderType::Sell => {
                // Match against bids (buy orders)
                let mut new_bids = Vec::new(&env);
                let mut remaining = amount;

                for bid in order_book.bids.iter() {
                    if remaining <= 0 {
                        new_bids.push_back(bid.clone());
                        continue;
                    }

                    if bid.status == OrderStatus::Active || bid.status == OrderStatus::PartiallyFilled {
                        let fill_amount = remaining.min(bid.amount_wanted - bid.amount_filled);
                        
                        if fill_amount > 0 {
                            // Execute trade between taker and maker
                            Self::execute_trade(&env, pool_id, &taker, &bid.maker, fill_amount, bid.price, order_type)?;
                            
                            total_filled += fill_amount;
                            remaining -= fill_amount;

                            // Update order - keep if not fully filled
                            if bid.amount_filled + fill_amount < bid.amount_wanted {
                                let mut updated_bid = bid.clone();
                                updated_bid.amount_filled += fill_amount;
                                updated_bid.status = OrderStatus::PartiallyFilled;
                                new_bids.push_back(updated_bid);
                            }
                            // If fully filled, don't add back to book
                        } else {
                            new_bids.push_back(bid.clone());
                        }
                    } else {
                        new_bids.push_back(bid.clone());
                    }
                }

                order_book.bids = new_bids;
            }
        }

        order_books.set(pool_id, order_book);
        env.storage().instance().set(&ORDER_BOOK, &order_books);

        if total_filled < min_amount_out {
            return Err(Error::InsufFunds);
        }

        Ok(total_filled)
    }

    fn execute_trade(
        env: &Env,
        pool_id: u64,
        taker: &Address,
        maker: &Address,
        amount: i64,
        price: i64,
        order_type: OrderType,
    ) -> Result<(), Error> {
        // Calculate token amounts based on price
        // Price is scaled by 1e6, so we need to divide
        let token_a_amount = (amount * price) / 1_000_000;

        // Emit trade event
        env.events().publish(
            (symbol_short!("trade"), pool_id),
            (taker, maker, order_type, amount, price, token_a_amount),
        );

        // Note: Actual token transfers would be handled here
        // This requires integration with token contracts
        
        Ok(())
    }
}
