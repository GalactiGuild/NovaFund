# Cross-Chain Bridge Contract Implementation

## Overview
The Cross-Chain Bridge contract enables users to bridge assets from other blockchains (Ethereum, Polygon, Binance Smart Chain, etc.) to the Stellar network for use in the NovaFund platform. This allows contributors to use assets from various ecosystems to participate in crowdfunding campaigns.

## Features

### Supported Blockchains
- Ethereum (Chain ID: 1)
- Polygon (Chain ID: 137)
- Binance Smart Chain (Chain ID: 56)
- Avalanche (Chain ID: 43114)
- Arbitrum (Chain ID: 42161)
- Optimism (Chain ID: 10)
- Base (Chain ID: 8453)

### Core Functions

#### Bridge Management
- `initialize(admin, min_relayer_stake, confirmation_threshold)`: Initialize the bridge contract
- `add_supported_chain(chain_id, name, bridge_contract, confirmations_required, gas_cost_estimate)`: Add support for a new blockchain
- `remove_supported_chain(chain_id)`: Remove support for a blockchain
- `pause_bridge()`: Emergency pause the bridge
- `unpause_bridge()`: Resume the bridge after pause
- `update_config(min_relayer_stake, confirmation_threshold, max_gas_price)`: Update bridge configuration

#### Asset Management
- `register_wrapped_asset(asset_code, issuer, original_chain, original_contract, decimals)`: Register a new wrapped asset
- `deposit(source_chain, source_tx_hash, sender, recipient, asset, amount)`: Deposit assets from another chain (called by relayers)
- `withdraw(sender, destination_chain, recipient, asset, amount)`: Initiate withdrawal to another chain
- `confirm_withdrawal(relayer, tx_id, destination_tx_hash)`: Confirm a withdrawal transaction

#### Relayer Management
- `register_relayer(relayer, stake)`: Register a new relayer
- `unregister_relayer(relayer)`: Unregister a relayer

#### Query Functions
- `get_config()`: Get bridge configuration
- `get_chain_config(chain_id)`: Get chain configuration
- `get_wrapped_asset(asset)`: Get wrapped asset information
- `get_transaction(tx_id)`: Get transaction by ID
- `get_relayer(address)`: Get relayer information
- `is_chain_supported(chain_id)`: Check if chain is supported
- `get_total_wrapped(asset)`: Get total wrapped amount for an asset
- `get_transaction_count()`: Get transaction count

## Security Model

### Relayer System
- Relayers must stake tokens to participate
- Minimum stake requirement for registration
- Relayers confirm transactions after observing them on source chains
- Relayers earn rewards for their service

### Transaction Verification
- Multiple confirmations required for cross-chain transactions
- Duplicate transaction prevention
- Chain-specific confirmation thresholds

### Emergency Controls
- Emergency pause functionality
- Admin controls for critical operations

## Architecture

### Data Structures
- `ChainId`: Enum for supported blockchain IDs
- `ChainConfig`: Configuration for each supported chain
- `WrappedAssetInfo`: Information about wrapped assets
- `BridgeTransaction`: Cross-chain transaction records
- `RelayerInfo`: Relayer registration and status
- `BridgeConfig`: Overall bridge configuration

### Storage Keys
- `DataKey::Config`: Bridge configuration
- `DataKey::TxCounter`: Transaction counter
- `DataKey::ChainConfig(chain_id)`: Chain configurations
- `DataKey::WrappedAsset(asset)`: Wrapped asset info
- `DataKey::AssetByOriginal(chain_id, original_contract)`: Mapping of original contracts to wrapped assets
- `DataKey::Transaction(tx_id)`: Transaction records
- `DataKey::TxByHash(chain_id, hash)`: Transaction lookup by source hash
- `DataKey::Relayer(address)`: Relayer information

## Usage Flow

### For Deposits (External Chain → Stellar)
1. User sends assets to bridge contract on external chain
2. Relayer observes transaction and waits for required confirmations
3. Relayer calls `deposit()` function with transaction details
4. Bridge mints wrapped tokens on Stellar and transfers to recipient
5. Transaction is recorded and confirmed

### For Withdrawals (Stellar → External Chain)
1. User calls `withdraw()` with desired destination and amount
2. User burns wrapped tokens on Stellar
3. Relayer observes burn event and processes withdrawal on external chain
4. Relayer calls `confirm_withdrawal()` to finalize
5. Transaction status is updated to executed

## Gas and Cost Considerations
- Each supported chain has a gas cost estimate
- Relayers bear the cost of submitting transactions
- Users may pay fees to compensate relayers
- Efficient batching of operations to minimize costs

## Fallback Mechanisms
- Emergency pause in case of bridge exploits
- Ability to remove compromised chains
- Configurable confirmation thresholds
- Relayer accountability system

## Integration Points
- Works with existing NovaFund ecosystem
- Compatible with Soroban token standards
- Integrates with project-launch, escrow, and other contracts