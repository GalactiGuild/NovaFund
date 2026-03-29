# Smart Wallet with Social Recovery

## Overview

This contract implements a Soroban smart wallet with social recovery capabilities, following Account Abstraction principles on Stellar. It enables users to recover their wallets through trusted guardians if they lose access to their private keys.

## Features

### Core Functionality

1. **Account Abstraction**: The wallet can execute transactions on behalf of the owner
2. **Social Recovery**: N-of-M guardian system for wallet recovery
3. **Configurable Threshold**: Customizable number of guardian approvals required
4. **Time-Lock Security**: 48-hour waiting period before recovery execution
5. **Guardian Management**: Owner can add/remove guardians dynamically
6. **Replay Protection**: Nonce-based protection against transaction replay

### Security Features

- **Minimum 3 Guardians**: Enforced minimum to prevent centralization
- **Separation of Roles**: Owner cannot be a guardian (prevents self-recovery attacks)
- **Threshold-Based Recovery**: Requires multiple guardians to agree
- **Time-Lock**: 48-hour delay allows owner to intervene if recovery is malicious
- **Owner Cancellation**: Current owner can cancel any recovery attempt

## Architecture

### Data Structures

#### Guardian

```rust
pub struct Guardian {
    pub address: Address,
    pub added_at: u64,
}
```

#### RecoveryRequest

```rust
pub struct RecoveryRequest {
    pub new_owner: Address,
    pub requested_at: u64,
    pub approvals: Vec<Address>,
}
```

## Usage

### Initialization

```rust
// Initialize wallet with owner and 3+ guardians
let guardians = vec![guardian1, guardian2, guardian3, ...];
let threshold = 3; // Need 3 out of N guardians to approve

SmartWallet::initialize(
    env,
    owner_address,
    guardians,
    threshold,
)?;
```

**Requirements:**
- Minimum 3 guardians required
- Threshold must be between 1 and number of guardians
- Owner cannot be a guardian

### Executing Transactions

```rust
// Wallet owner can execute transactions through the wallet
SmartWallet::execute(
    env,
    target_contract,
    payload,      // Encoded function call
    signature,    // Owner's signature
)?;
```

### Managing Guardians

#### Add Guardian

```rust
// Only wallet owner can add guardians
SmartWallet::add_guardian(env, new_guardian_address)?;
```

#### Remove Guardian

```rust
// Only wallet owner can remove guardians
// Cannot remove if it would bring total below 3
SmartWallet::remove_guardian(env, guardian_address)?;
```

### Social Recovery Process

The recovery process involves multiple steps for security:

#### Step 1: Initiate Recovery

Any guardian can initiate recovery:

```rust
// Guardian proposes new owner address
SmartWallet::initiate_recovery(env, new_owner_address)?;
```

This creates a `RecoveryRequest` with the initiator's approval.

#### Step 2: Guardian Approvals

Other guardians review and approve the recovery:

```rust
// Each guardian approves the recovery
SmartWallet::approve_recovery(env)?;
```

Approvals are tracked in the `RecoveryRequest`.

#### Step 3: Execute Recovery

After reaching the threshold and waiting 48 hours:

```rust
// Anyone can execute recovery after conditions are met
SmartWallet::execute_recovery(env)?;
```

**Requirements:**
- At least `threshold` guardian approvals
- 48-hour time-lock period has elapsed
- Recovery request still active

#### Cancel Recovery (Owner Only)

If recovery is malicious, the current owner can cancel:

```rust
SmartWallet::cancel_recovery(env)?;
```

### Query Functions

```rust
// Get current wallet owner
let owner = SmartWallet::get_owner(env)?;

// Get all guardians
let guardians = SmartWallet::get_guardians(env)?;

// Get recovery threshold
let threshold = SmartWallet::get_threshold(env)?;

// Get active recovery request (if any)
let request = SmartWallet::get_recovery_request(env)?;
```

## Recovery Flow Diagram

```
┌─────────────────┐
│ Guardian Lost   │
│ Access          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Initiate        │
│ Recovery        │◄── Any guardian
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Other Guardians │
│ Approve         │◄── Need (threshold - 1) more
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Wait 48 Hours   │◄── Time-lock period
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Execute Recovery│◄── Transfer ownership
└─────────────────┘
```

## Security Considerations

### Guardian Selection

Choose guardians carefully:
- **Diversity**: Different people/organizations
- **Trustworthiness**: People who will act in your best interest
- **Availability**: Guardians who will respond when needed
- **Security**: Guardians with good security practices

Example guardian candidates:
- Family members
- Trusted friends
- Lawyers or financial advisors
- Multi-sig organizations
- Hardware wallets in secure locations

### Threshold Configuration

Recommended thresholds:
- **3 guardians**: Threshold = 2 or 3
- **5 guardians**: Threshold = 3
- **7 guardians**: Threshold = 4

Balance between:
- **Security**: Higher threshold prevents collusion
- **Availability**: Lower threshold ensures recovery is possible

### Attack Mitigation

#### Guardian Collusion
- **Mitigation**: Set threshold high enough to require multiple conspirators
- **Detection**: Monitor recovery requests

#### Malicious Recovery
- **Mitigation**: 48-hour time-lock allows owner intervention
- **Action**: Owner cancels fraudulent recovery attempt

#### Guardian Unavailability
- **Mitigation**: Have more guardians than minimum threshold
- **Action**: Owner can replace inactive guardians

#### Owner Key Compromise
- **Mitigation**: Guardians can initiate recovery to new owner
- **Action**: Start recovery process immediately

### Best Practices

1. **Regular Updates**: Periodically review and update guardian list
2. **Communication**: Ensure guardians understand their responsibilities
3. **Documentation**: Keep guardians informed about recovery procedures
4. **Testing**: Practice recovery process periodically
5. **Monitoring**: Watch for unauthorized recovery attempts

## Gas Optimization

### Storage Efficiency

```rust
// ✅ Efficient: Store guardians in Map
let mut guardians = Map::<Address, Guardian>::new(&env);

// ❌ Expensive: Multiple separate storage entries
env.storage().set(&guardian1_key, &guardian1);
env.storage().set(&guardian2_key, &guardian2);
```

### Batch Operations

```rust
// ✅ Efficient: Single storage write for all guardians
env.storage().set(&GUARDIANS, &guardians_map);

// ❌ Expensive: Individual writes per guardian
for guardian in guardians {
    env.storage().set(&guardian.address, &guardian);
}
```

## Testing

Run comprehensive tests:

```bash
cd contracts/smart-wallet
cargo test
```

Test coverage includes:
- ✅ Initialization with minimum 3 guardians
- ✅ Adding guardians
- ✅ Removing guardians (maintaining minimum)
- ✅ Recovery initiation by guardian
- ✅ Recovery approval process
- ✅ Threshold enforcement
- ✅ Time-lock requirement
- ✅ Owner cancellation
- ✅ Double approval prevention

## Integration Examples

### DeFi Protocol Interaction

```rust
// Smart wallet interacts with DeFi protocol
let payload = encode_call("deposit", amount);
SmartWallet::execute(
    env,
    defi_protocol_address,
    payload,
    signature,
)?;
```

### NFT Management

```rust
// Wallet owns and manages NFTs
let payload = encode_call("transfer_nft", (token_id, recipient));
SmartWallet::execute(
    env,
    nft_contract_address,
    payload,
    signature,
)?;
```

## Comparison with Traditional Wallets

| Feature | Traditional EOA | Smart Wallet |
|---------|----------------|--------------|
| Recovery | ❌ None | ✅ Social |
| Multi-sig | ❌ No | ✅ Yes (via guardians) |
| Transaction Batching | ❌ No | ✅ Yes |
| Programmable Security | ❌ Fixed | ✅ Customizable |
| Guardian System | ❌ No | ✅ Built-in |
| Time-Locks | ❌ No | ✅ Yes |

## Future Enhancements

### Planned Features

1. **Spending Limits**: Daily/weekly transaction limits
2. **Transaction Rules**: Whitelisted addresses, time restrictions
3. **Inheritance**: Automatic transfer on predefined conditions
4. **Multi-Chain Support**: Recovery across different chains
5. **Guardian Rotation**: Automatic guardian replacement schedule

### Potential Improvements

1. **Signature Aggregation**: BLS signatures for compact multi-sig
2. **Privacy**: Zero-knowledge proofs for recovery
3. **Insurance**: Optional insurance against guardian failure
4. **Reputation**: Guardian reputation scoring system

## Deployment

### Testnet Deployment

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/smart_wallet.wasm \
  --source deployer \
  --network testnet
```

### Initialization

```bash
soroban contract invoke \
  --id WALLET_CONTRACT_ID \
  --source owner \
  --network testnet \
  -- initialize \
  --owner OWNER_ADDRESS \
  --guardians '[GUARDIAN1,GUARDIAN2,GUARDIAN3]' \
  --threshold 3
```

## Conclusion

This smart wallet implementation provides robust account abstraction with secure social recovery. The multi-layer security approach (minimum guardians, threshold approvals, time-locks) ensures funds remain safe while providing a reliable recovery mechanism for users who lose access to their keys.

---

**Document Version**: 1.0  
**Last Updated**: March 27, 2026  
**Author**: NovaFund Development Team
