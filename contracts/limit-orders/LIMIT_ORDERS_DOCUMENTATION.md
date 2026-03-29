# Limit Orders Contract for NovaFund AMM

## Overview

This contract implements a gas-optimized limit order system for the NovaFund AMM liquidity pools, allowing users to place buy/sell orders at specific prices and automatically execute when market conditions are met.

## Features

### Core Functionality

1. **Limit Orders**: Place buy or sell orders at specified prices
2. **Order Book**: Maintains sorted order book for each AMM pool
3. **Automatic Matching**: Executes trades when AMM price crosses limit price
4. **Partial Fills**: Supports partial order execution
5. **Market Orders**: Execute against existing limit orders instantly

### Gas Optimization

- **Efficient Storage**: Orders sorted by price in memory, not storage
- **Batched Operations**: Multiple fills in single transaction
- **Lazy Cleanup**: Filled orders removed during next interaction
- **Compact Data Structures**: Minimal on-chain storage footprint

## Architecture

### Data Structures

#### Order

```rust
pub struct Order {
    pub order_id: u64,           // Unique order identifier
    pub pool_id: u64,            // AMM pool ID
    pub maker: Address,          // Order creator
    pub order_type: OrderType,   // Buy or Sell
    pub price: i64,              // Price scaled by 1e6
    pub amount_wanted: i64,      // Total amount desired
    pub amount_filled: i64,      // Amount already filled
    pub status: OrderStatus,     // Current status
    pub created_at: u64,         // Creation timestamp
}
```

#### OrderBook

```rust
pub struct OrderBook {
    pub pool_id: u64,
    pub bids: Vec<Order>,  // Buy orders (sorted by price desc)
    pub asks: Vec<Order>,  // Sell orders (sorted by price asc)
}
```

#### OrderType

```rust
pub enum OrderType {
    Buy = 0,   // Bid - want to buy token B with token A
    Sell = 1,  // Ask - want to sell token B for token A
}
```

#### OrderStatus

```rust
pub enum OrderStatus {
    Active = 0,
    PartiallyFilled = 1,
    Filled = 2,
    Cancelled = 3,
}
```

## Usage

### Initialization

```rust
// Initialize the limit orders contract
LimitOrders::initialize(
    env,
    admin_address,
    amm_pool_address,  // Associated AMM pool contract
);
```

### Placing a Limit Order

```rust
let params = LimitOrderParams {
    pool_id: 1,
    order_type: OrderType::Buy,
    price: 500_000,        // 0.5 token A per token B (scaled by 1e6)
    amount: 1000,          // Amount of token B wanted
    min_fill: 100,         // Minimum acceptable fill (0 for no min)
    deadline: timestamp,   // Order expiration (0 for no expiry)
};

let order_id = LimitOrders::place_order(env, params)?;
```

### Cancelling an Order

```rust
// Only the order maker can cancel
LimitOrders::cancel_order(env, order_id)?;
```

### Getting Order Information

```rust
// Get specific order details
let order = LimitOrders::get_order(env, order_id)?;

// Get all orders for a user
let user_orders = LimitOrders::get_user_orders(env, user_address)?;

// Get full order book for a pool
let order_book = LimitOrders::get_order_book(env, pool_id)?;
```

### Executing a Market Order

```rust
// Instantly execute against existing limit orders
let filled_amount = LimitOrders::execute_market_order(
    env,
    pool_id,
    OrderType::Sell,      // Want to sell
    1000,                 // Amount to sell
    900,                  // Minimum acceptable fill
    deadline,
)?;
```

## Price Encoding

Prices are encoded as integers scaled by 1,000,000 (1e6) to maintain precision:

- `500_000` = 0.5 token A per token B
- `1_000_000` = 1.0 token A per token B  
- `2_500_000` = 2.5 token A per token B

This avoids floating-point arithmetic while maintaining 6 decimal places of precision.

## Order Matching Logic

### Price-Time Priority

1. **Best Price First**: 
   - Bids: Higher prices executed first
   - Asks: Lower prices executed first

2. **Time Priority**: At same price level, earlier orders executed first

3. **Pro-Rata**: If multiple orders at same price, may be filled proportionally (optional)

### Matching Examples

#### Example 1: Buy Order Matching

```
Existing Order Book:
Ask 1: 100 tokens @ 0.52
Ask 2: 200 tokens @ 0.55
Ask 3: 150 tokens @ 0.58

New Market Buy Order: 250 tokens

Execution:
- Fill 100 @ 0.52 (best ask)
- Fill 150 @ 0.55 (next best)
Total: 250 tokens filled
```

#### Example 2: Limit Order Placement

```
Current AMM Price: 0.50

Place Limit Buy @ 0.45:
- Not immediately matched (below current price)
- Added to bid book
- Will execute if AMM price drops to 0.45

Place Limit Buy @ 0.52:
- Immediately matched against asks
- Gets best available ask price (≥ 0.52)
```

## Integration with AMM

### Price Oracle

The limit order contract monitors AMM pool prices:

```rust
// When AMM price crosses limit price, trigger execution
if amm_price <= limit_buy_price {
    execute_buy_order();
}

if amm_price >= limit_sell_price {
    execute_sell_order();
}
```

### Liquidity Interaction

Limit orders complement AMM liquidity:

1. **Additional Liquidity**: Limit orders provide extra depth
2. **Price Stability**: Reduces slippage for large trades
3. **Arbitrage**: Enables sophisticated trading strategies

## Gas Optimization Strategies

### 1. Storage Minimization

```rust
// ❌ Expensive: Store every order update
env.storage().set(&order_id, &updated_order);

// ✅ Cheap: Batch updates, minimize storage ops
order_books.set(pool_id, updated_book);
```

### 2. Efficient Sorting

```rust
// Insert in sorted order (O(n) but acceptable for small books)
for (i, order) in orders.iter().enumerate() {
    if new_order.price > order.price {
        orders.insert(i, new_order);
        break;
    }
}
```

### 3. Lazy Cleanup

```rust
// Don't actively remove filled orders
// Remove during next order placement/matching
order_book.bids = order_book.bids
    .iter()
    .filter(|o| o.status != OrderStatus::Filled)
    .collect();
```

## Security Considerations

### Access Control

- **Order Cancellation**: Only order maker can cancel
- **Fund Safety**: Tokens only transferred on successful match
- **Reentrancy Protection**: State updates before external calls

### Economic Security

- **Front-Running**: Mitigated by Soroban's FIFO ordering
- **Manipulation**: Price from AMM (harder to manipulate)
- **Insufficient Funds**: Validated before order placement

### Error Handling

```rust
#[derive(Error, Debug)]
pub enum LimitOrderError {
    #[error("Invalid order parameters")]
    InvalidInput,
    
    #[error("Insufficient funds")]
    InsufficientFunds,
    
    #[error("Order not found")]
    NotFound,
    
    #[error("Unauthorized access")]
    Unauthorized,
    
    #[error("Invalid order status")]
    InvalidOrderStatus,
    
    #[error("Deadline passed")]
    DeadlinePassed,
}
```

## Testing

Run comprehensive tests:

```bash
cd contracts/limit-orders
cargo test
```

Test coverage includes:
- ✅ Order placement
- ✅ Order cancellation
- ✅ Partial fills
- ✅ Full fills
- ✅ Market order execution
- ✅ Order book sorting
- ✅ Edge cases (empty book, max values)

## Deployment

### Testnet Deployment

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/limit_orders.wasm \
  --source deployer \
  --network testnet
```

### Initialization

```bash
soroban contract invoke \
  --id LIMIT_ORDER_CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin ADMIN_ADDRESS \
  --amm_pool AMM_POOL_CONTRACT_ID
```

## Future Enhancements

### Planned Features

1. **Stop-Loss Orders**: Trigger market orders at price thresholds
2. **Good-Til-Cancelled (GTC)**: Orders persist until cancelled
3. **Immediate-or-Cancel (IOC)**: Fill immediately or cancel
4. **Fill-or-Kill (FoK)**: Fill completely or cancel entirely
5. **Hidden Orders**: Iceberg orders with hidden size

### Potential Optimizations

1. **Off-Chain Order Book**: Maintain order book off-chain, settle on-chain
2. **Batch Auctions**: Periodic batch execution for better prices
3. **Cross-Margin**: Net positions across multiple orders
4. **Fee Tiers**: Different fees for makers vs takers

## Comparison with Other DEXes

| Feature | NovaFund Limit Orders | Uniswap | Orderly Network |
|---------|----------------------|---------|-----------------|
| Limit Orders | ✅ Yes | ❌ No | ✅ Yes |
| Order Book | ✅ On-chain | ❌ No | ⚠️ Off-chain |
| AMM Integration | ✅ Native | ✅ Native | ⚠️ Separate |
| Gas Cost | Medium | Low | Low |
| Censorship Resistance | ✅ High | ✅ High | ⚠️ Medium |

## Conclusion

This limit order implementation provides advanced trading functionality while maintaining gas efficiency and seamless integration with NovaFund's AMM pools. The design prioritizes security, usability, and performance for retail and institutional traders.

---

**Document Version**: 1.0  
**Last Updated**: March 27, 2026  
**Author**: NovaFund Development Team
