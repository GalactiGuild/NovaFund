# Perk Auction Contract

A Soroban smart contract that allows project creators to sell exclusive perks (NFTs) alongside regular token sales via a Dutch Auction mechanism.

## Features

- **Dutch Auction Pricing**: Prices decrease over time based on ledger sequence
- **Perk Management**: Create and manage exclusive perks for crowdfunding projects
- **Refund Mechanism**: Automatic refunds if auction sells out quickly
- **Purchase Tracking**: Complete audit trail of all perk purchases
- **Admin Controls**: Pause/unpause contract and admin management

## How It Works

### Dutch Auction Mechanism

The auction uses a time-based price decay formula:

```
current_price = max(reserve_price, initial_price - (decay_rate * elapsed_time))
```

- **Initial Price**: Starting price set by creator
- **Reserve Price**: Minimum price the creator will accept
- **Decay Rate**: Calculated as `(initial_price - reserve_price) / duration`
- **Duration**: Length of the auction in ledger sequences

### Quick Sale Refunds

If a perk sells out in the first 25% of the auction duration, early buyers receive refunds for the difference between their purchase price and the reserve price. This encourages early participation while protecting buyers from overpaying.

## Contract Functions

### Core Functions

- `initialize(admin: Address)` - Initialize the contract
- `create_perk(project_id, title, description, metadata_uri, total_supply, initial_price, reserve_price, duration) -> perk_id` - Create a new perk auction
- `purchase_perk(perk_id, buyer) -> price_paid` - Purchase a perk at current price
- `get_perk(perk_id) -> Perk` - Get perk details
- `get_current_price(perk_id) -> price` - Get current auction price
- `get_user_perks(user) -> Vec<perk_id>` - Get user's owned perks

### Admin Functions

- `pause_contract()` - Pause all auction activity
- `unpause_contract()` - Resume auction activity
- `update_admin(new_admin)` - Update contract admin

## Data Structures

### Perk
```rust
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
```

### PerkPurchase
```rust
pub struct PerkPurchase {
    pub perk_id: u64,
    pub buyer: Address,
    pub price_paid: i64,
    pub purchased_at: u64,
    pub token_id: Option<u64>,
}
```

## Usage Example

```rust
// Initialize contract
PerkAuctionContract::initialize(env, admin_address);

// Create a perk
let perk_id = PerkAuctionContract::create_perk(
    env,
    1, // project_id
    "Exclusive NFT Access",
    "Get exclusive access to project NFTs",
    "ipfs://metadata",
    100, // total_supply
    1000, // initial_price (10 XLM)
    100,  // reserve_price (1 XLM)
    10000, // duration (10000 ledger sequences)
);

// Purchase perk
let price = PerkAuctionContract::purchase_perk(env, perk_id, buyer_address);
```

## Security Considerations

- **Access Control**: Only admin can pause/unpause contract
- **Input Validation**: All inputs are validated for bounds and logic
- **Overflow Protection**: All arithmetic operations use checked math
- **Refund Safety**: Refunds are calculated and processed safely
- **Auction Integrity**: Price decay is deterministic and transparent

## Integration Notes

This contract is designed to work alongside:
- **Project Launch Contract**: For linking perks to crowdfunding projects
- **Token Contracts**: For payment processing (requires integration)
- **NFT Contracts**: For actual NFT minting and transfer (requires integration)

## Testing

Run tests with:
```bash
cargo test --package perk-auction
```

## Deployment

1. Ensure all dependencies are installed
2. Build the contract:
   ```bash
   cargo build --release --target wasm32-unknown-unknown --package perk-auction
   ```
3. Deploy to Stellar network using Soroban CLI
4. Initialize with admin address

## License

This contract is part of the NovaFund project and follows the same licensing terms.
