# AMM Liquidity Pools Contract

A professional Automated Market Maker (AMM) implementation for project tokens on the Soroban platform, inspired by Uniswap v2 with additional optimizations and security features.

## Features

### Core AMM Functionality
- **Constant Product AMM**: Implements the classic `x * y = k` formula for automated price discovery
- **Liquidity Pools**: Create and manage pools for any pair of project tokens
- **Swaps**: Execute token swaps with automatic price calculation and slippage protection
- **Liquidity Provision**: Add and remove liquidity with proportional ownership

### Advanced Features
- **Flash Loan Protection**: Built-in protection against flash loan attacks with 0.05% fee
- **Liquidity Provider Rewards**: Fee accumulation and reward distribution system
- **Batch Operations**: Gas-optimized batch swapping and liquidity operations
- **Gas Optimization**: Efficient storage patterns and minimal external calls

### Security Features
- **Slippage Protection**: Minimum output amounts prevent unfavorable trades
- **Deadline Protection**: Time-based protection against stale transactions
- **Admin Controls**: Secure admin functions for fee management
- **Input Validation**: Comprehensive validation of all parameters

## Architecture

### Core Components

1. **AMMLiquidityPools**: Main contract with core AMM logic
2. **RewardManager**: Handles fee distribution and liquidity rewards
3. **GasOptimizer**: Batch operations and gas optimization utilities

### Key Data Structures

```rust
pub struct Pool {
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_liquidity: i128,
    pub fee_rate: u32,
    pub created_at: u64,
}

pub struct UserPosition {
    pub pool_id: u64,
    pub liquidity: i128,
    pub token_a_amount: i128,
    pub token_b_amount: i128,
    pub last_fee_claimed: u64,
}
```

## Usage

### Initialization
```rust
// Initialize the contract with admin and default fee rate (30 basis points = 0.3%)
AMMLiquidityPools::initialize(env, admin_address, 30u32);
```

### Creating a Pool
```rust
// Create a new liquidity pool for token pair
let pool_id = AMMLiquidityPools::create_pool(env, token_a, token_b);
```

### Adding Liquidity
```rust
let liquidity = AMMLiquidityPools::add_liquidity(
    env,
    LiquidityParams {
        token_a,
        token_b,
        amount_a: 1000,
        amount_b: 1000,
        min_liquidity: 950,
        deadline: current_time + 300,
    }
);
```

### Swapping Tokens
```rust
let amount_out = AMMLiquidityPools::swap(
    env,
    SwapParams {
        token_in,
        token_out,
        amount_in: 100,
        min_amount_out: 95,
        deadline: current_time + 300,
    }
);
```

### Removing Liquidity
```rust
let (amount_a, amount_b) = AMMLiquidityPools::remove_liquidity(
    env,
    pool_id,
    liquidity_amount,
    min_amount_a,
    min_amount_b,
    deadline,
);
```

### Claiming Fees
```rust
let (fee_a, fee_b) = RewardManager::claim_fees(env, pool_id);
```

## Mathematical Formulas

### Constant Product Formula
```
x * y = k
```
Where `x` and `y` are the reserves of the two tokens, and `k` is a constant.

### Swap Calculation
```
amount_out = (reserve_out * amount_in_with_fee) / (reserve_in + amount_in_with_fee)
```

### Liquidity Calculation
For first liquidity provider:
```
liquidity = sqrt(amount_a * amount_b)
```

For subsequent providers:
```
liquidity = min(amount_a * total_liquidity / reserve_a, amount_b * total_liquidity / reserve_b)
```

## Fee Structure

- **Trading Fee**: Default 0.3% (30 basis points), configurable by admin
- **Flash Loan Fee**: 0.05% (5 basis points)
- **Fee Distribution**: All trading fees go to liquidity providers

## Security Considerations

### Flash Loan Protection
- 0.05% fee on flash loans
- Callback verification required
- Atomic execution ensures repayment

### Slippage Protection
- `min_amount_out` parameter prevents unfavorable trades
- `min_liquidity` parameter protects liquidity providers

### Deadline Protection
- All operations include deadline parameter
- Prevents execution of stale transactions

## Gas Optimization

### Batch Operations
- Multiple swaps in single transaction
- Reduced storage reads through caching
- Optimized parameter encoding

### Storage Efficiency
- Minimal storage slots per pool
- Efficient data structures
- Lazy loading of user positions

## Testing

Run the comprehensive test suite:

```bash
cargo test --package amm-liquidity-pools
```

Test coverage includes:
- Contract initialization
- Pool creation and management
- Liquidity provision and removal
- Token swapping with various scenarios
- Error conditions and edge cases
- Mathematical calculations

## Integration

This AMM contract is designed to integrate seamlessly with the NovaFund ecosystem:

- **Project Tokens**: Works with any Soroban-compatible token
- **Cross-Chain Bridge**: Compatible with cross-chain token transfers
- **Governance**: Admin functions can be controlled by governance contracts
- **Identity**: Integrates with the identity system for user management

## Future Enhancements

- **Concentrated Liquidity**: Uniswap v3-style concentrated liquidity positions
- **Multi-Token Pools**: Support for more than two tokens per pool
- **Dynamic Fees**: Time-based or volume-based fee adjustments
- **Yield Farming**: Additional reward mechanisms for liquidity providers
- **Oracle Integration**: Price oracle integration for accurate market data

## License

MIT License - see LICENSE file for details.
