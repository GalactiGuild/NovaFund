# NovaFund Smart Contracts

This directory contains all Soroban smart contracts for the NovaFund platform.

## 📁 Contract Overview

### Core Contracts

1. **project-launch/** - Project creation and funding campaigns
2. **escrow/** - Escrow management and milestone-based fund releases
3. **profit-distribution/** - Automated investor payout distribution
4. **subscription-pool/** - Recurring investment pool management
5. **multi-party-payment/** - Multi-stakeholder payment splitting
6. **reputation/** - Creator and investor reputation system
7. **governance/** - Platform governance and voting mechanisms

### Shared Libraries

8. **shared/** - Common utilities, types, and helper functions

## 🔄 Contract Upgrade Capability (#33)

**ProjectLaunch** and **Escrow** support secure, time-locked upgrades using Soroban’s native upgrade mechanism (no proxy pattern).

### Flow

1. **Schedule** – Admin calls `schedule_upgrade(admin, new_wasm_hash)`. The new WASM must already be uploaded to the ledger. A 48-hour time-lock starts.
2. **Pause** – Before executing, the contract must be paused (`pause(admin)`). Escrow already had pause; ProjectLaunch has pause for emergency and for upgrades.
3. **Execute** – After 48 hours, admin calls `execute_upgrade(admin)`. The contract replaces its own WASM via `env.deployer().update_current_contract_wasm(wasm_hash)`. State (instance and persistent storage) is unchanged.
4. **Resume** – Admin calls `resume(admin)` after the resume delay (24h for Escrow/ProjectLaunch).

### Access control

- Only the contract **admin** can schedule, execute, or cancel upgrades. Use a multi-sig or governance-controlled address as admin for production.
- **Escrow:** `execute_upgrade` requires the contract to be **paused**.
- **ProjectLaunch:** `execute_upgrade` also requires the contract to be **paused**.

### Constants (shared)

- `UPGRADE_TIME_LOCK_SECS` = 172800 (48 hours). Minimum delay between schedule and execute.
- `RESUME_TIME_DELAY` = 86400 (24 hours). Minimum delay before resume after pause.

### Functions

| Contract       | schedule_upgrade(admin, wasm_hash) | execute_upgrade(admin) | cancel_upgrade(admin) | get_pending_upgrade() |
|----------------|------------------------------------|-------------------------|------------------------|------------------------|
| ProjectLaunch  | ✓                                  | ✓ (requires paused)     | ✓                      | ✓                      |
| Escrow         | ✓                                  | ✓ (requires paused)     | ✓                      | ✓                      |

### Tests

Upgrade and pause behaviour is covered by unit tests: time-lock, require-pause, admin-only, and cancel. Run:

```bash
cargo test --package project-launch --package escrow
```

## 🛠️ Development Setup

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add wasm32 target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli --features opt
```

### Building Contracts

```bash
# Build all contracts
cargo build --target wasm32-unknown-unknown --release

# Build specific contract
cd project-launch
cargo build --target wasm32-unknown-unknown --release
```

### Testing Contracts

```bash
# Run all tests
cargo test --all

# Run tests for specific contract
cd escrow
cargo test
```

### Optimizing Contracts

```bash
# Build optimized WASM
cargo build --target wasm32-unknown-unknown --release

# Optimize with soroban-cli
soroban contract optimize --wasm target/wasm32-unknown-unknown/release/project_launch.wasm
```

## 🚀 Deployment

### Testnet Deployment

```bash
# Configure testnet
soroban network add testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"

# Create account (save the secret key!)
soroban keys generate deployer --network testnet

# Fund account
soroban keys fund deployer --network testnet

# Deploy contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/project_launch.wasm \
  --source deployer \
  --network testnet
```

### Contract Initialization

Each contract requires initialization after deployment. Example:

```bash
soroban contract invoke \
  --id CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin ADMIN_ADDRESS \
  --fee_rate 250
```

## 📋 Contract Details

### 1. Project Launch Contract

**Purpose**: Manage project creation, funding goals, and contribution tracking

**Key Functions**:
- `initialize(admin)` - Initialize contract with admin address
- `create_project(creator, funding_goal, deadline, token, metadata_hash)` - Create new funding campaign
- `contribute(project_id, contributor, amount)` - Add funds to project
- `get_project(project_id)` - Retrieve project details
- `get_user_contribution(project_id, contributor)` - Get total contribution for a specific user

**Usage Examples**:

```bash
# Initialize contract
soroban contract invoke \
  --id CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize \
  --admin GD5DJQD... \

# Create a new project
soroban contract invoke \
  --id CONTRACT_ID \
  --source creator \
  --network testnet \
  -- create_project \
  --creator GD5DJQD... \
  --funding_goal 10000000000 \
  --deadline 1735689600 \
  --token GBPP... \
  --metadata_hash "QmXxx... "

# Contribute to a project
soroban contract invoke \
  --id CONTRACT_ID \
  --source contributor \
  --network testnet \
  -- contribute \
  --project_id 0 \
  --contributor GD5DJQD... \
  --amount 1000000000

# Get project information
soroban contract invoke \
  --id CONTRACT_ID \
  --network testnet \
  -- get_project \
  --project_id 0
```

**Parameters**:
- `funding_goal`: Minimum 1,000 XLM (1,000_0000000 stroops)
- `deadline`: Must be 1-180 days from creation
- `amount`: Minimum 10 XLM per contribution
- `metadata_hash`: IPFS/Arweave hash for project details

**Expected Behavior**:
- Projects start with `Active` status
- Contributions only accepted before deadline
- Events emitted for project creation and contributions
- Contribution amount per user tracked in O(1) storage
- Full contribution history available via events/indexers
- Project IDs increment sequentially from 0

**State Management**:
- Project metadata (creator, goal, deadline, token, status)
- IPFS/Arweave hash for off-chain project details
- Current funding amount and contribution history
- Project status (Active, Completed, Failed, Cancelled)

### 2. Escrow Contract

**Purpose**: Hold funds securely and release based on milestone completion

**Key Functions**:
- `deposit_funds()` - Lock funds in escrow
- `submit_milestone()` - Creator submits milestone proof
- `approve_milestone()` - Validators approve milestone
- `release_funds()` - Automated release upon approval
- `request_refund()` - Request funds back if milestones fail
- `update_validators(new_validators)` - Update the list of approved validators (Admin only)

**State Management**:
- Escrow balance
- Milestone definitions and status
- Validator list
- Release schedule

### 3. Profit Distribution Contract

**Purpose**: Automatically distribute returns to investors proportionally using an O(1) scalability pattern.

**Key Functions**:
- `initialize(admin)` - Initialize contract with admin address
- `set_token(project_id, token)` - Register the token used for project profits
- `register_investors(project_id, investors)` - Record investment shares (Map of address to basis points)
- `deposit_profits(project_id, depositor, amount)` - Add profits for distribution (O(1) update)
- `claim_dividends(project_id, investor)` - Manual claim of pending dividends by investor
- `get_investor_share(project_id, investor)` - Query investor's current share and pending claimable amount

**State Management**:
- Investor registry with percentages
- Claimable amounts per investor
- Distribution history
- Total profits distributed

### 4. Subscription Pool Contract

**Purpose**: Manage recurring investment contributions and pool allocations.

**Key Functions**:
- `initialize(admin)` - Initialize contract with admin address
- `subscribe(subscriber, token, amount_per_period, period_seconds)` - Create or update a subscription
- `deposit(subscriber)` - Process a recurring deposit (transfers funds if period has passed)
- `withdraw(subscriber, amount)` - Withdraw funds from the subscription balance
- `get_subscription(subscriber)` - Query subscription details and balance

**State Management**:
- Subscriber list with schedules
- Pool balance and allocation
- Investment strategy parameters
- Historical performance data

### 5. Multi-Party Payment Contract

**Purpose**: Split payments among multiple stakeholders automatically

**Key Functions**:
- `setup_parties()` - Define stakeholders and shares
- `receive_payment()` - Accept incoming funds
- `distribute_shares()` - Split to all parties
- `update_allocation()` - Modify share percentages
- `withdraw_share()` - Party claims their portion

**State Management**:
- Party addresses and percentages
- Claimable balances per party
- Vesting schedules (if applicable)
- Payment history

### 6. Reputation Contract

**Purpose**: Track and manage on-chain reputation for creators and investors

**Key Functions**:
- `register_entity()` - Create reputation profile
- `update_score()` - Modify reputation based on actions
- `issue_badge()` - Award achievement tokens
- `get_reputation()` - Query reputation score
- `slash_reputation()` - Penalize bad actors

**State Management**:
- Reputation scores per address
- Badge collection per entity
- Historical actions and outcomes
- Verification status

### 7. Governance Contract

**Purpose**: Enable platform governance and community voting

**Key Functions**:
- `create_proposal()` - Submit governance proposal
- `vote()` - Cast vote on proposal
- `execute_proposal()` - Implement approved changes
- `delegate_votes()` - Delegate voting power
- `get_voting_power()` - Query vote weight

**State Management**:
- Active proposals
- Vote tallies
- Voting power per address
- Delegation mappings
- Execution queue

## 🔧 Shared Library

The `shared/` directory contains common utilities:

- **types.rs** - Shared data structures
  - `FeeConfig` - Platform fee configuration
  - `TokenInfo` - Token Information
  - `UserProfile` - User Profile
  - `EscrowInfo` - Escrow Information
  - `MilestoneStatus` - Milestone Status
  - `Milestone` - Milestone
  
- **errors.rs** - Common error types
  - 1: NotInitialized
  - 2: AlreadyInitialized
  - 3: Unauthorized
  - 4: InvalidInput
  - 5: NotFound
  - 100: ProjectNotActive
  - 101: ProjectAlreadyExists
  - 102: FundingGoalNotReached
  - 103: DeadlinePassed
  - 104: InvalidProjectStatus
  - 200: InsufficientEscrowBalance
  - 201: MilestoneNotApproved
  - 202: InvalidMilestoneStatus
  - 203: NotAValidator
  - 204: AlreadyVoted
  - 300: InsufficientFunds
  - 301: InvalidDistribution
  - 302: NoClaimableAmount
  - 303: DistributionFailed
  - 400: SubscriptionNotActive
  - 401: InvalidSubscriptionPeriod
  - 402: SubscriptionExists
  - 403: WithdrawalLocked
  - 500: ReputationTooLow
  - 501: InvalidReputationScore
  - 502: BadgeNotEarned
  - 600: ProposalNotActive
  - 601: InsufficientVotingPower
  - 602: ProposalAlreadyExecuted
  - 603: QuorumNotReached
  - 1000: InvalidFundingGoal
  - 1001: InvalidDeadline
  - 1002: ProjectNotFound
  - 1003: ContributionTooLow
  
- **events.rs** - Event definitions
  - PROJECT_CREATED     ("proj_new")
  - PROJECT_FUNDED      ("proj_fund")
  - PROJECT_COMPLETED   ("proj_done")
  - PROJECT_FAILED      ("proj_fail")
  - CONTRIBUTION_MADE   ("contrib")
  - REFUND_ISSUED       ("refund")
  - FUNDS_LOCKED        ("lock")
  - FUNDS_RELEASED      ("release")
  - MILESTONE_COMPLETED ("milestone")
  - PROFIT_DISTRIBUTED  ("profit")
  - DIVIDEND_CLAIMED    ("claim")
  - PROPOSAL_CREATED    ("proposal")
  - VOTE_CAST           ("vote")
  - PROPOSAL_EXECUTED   ("execute")
  - REPUTATION_UPDATED  ("rep_up")
  - BADGE_EARNED        ("badge")
  
- **utils.rs** - Helper functions
  
- **constants.rs** - Platform constants
  - `DEFAULT_PLATFORM_FEE`, `MIN_FUNDING_GOAL`, `MAX_PROJECT_DURATION`
  - `ESCROW_INITIALIZED`, `FUNDS_LOCKED`, `FUNDS_RELEASED`
  - `MILESTONE_CREATED`, `MILESTONE_SUBMITTED`, `MILESTONE_APPROVED`, `MILESTONE_REJECTED`

## 🧪 Testing Strategy

### Unit Tests
Each contract includes comprehensive unit tests in `src/test.rs`

### Integration Tests
Cross-contract interactions tested in `tests/` directory

### Test Coverage
```bash
cargo tarpaulin --out Html --output-dir coverage
```

## 📊 Gas Optimization

All contracts are optimized for minimal transaction costs:
- Efficient data structures
- Minimal storage operations
- Optimized WASM compilation
- Proper use of Soroban SDK features

## 🔐 Security Considerations

- **Access Control**: Admin-only functions protected
- **Reentrancy Protection**: Guards on external calls
- **Integer Overflow**: Checked arithmetic operations
- **Input Validation**: All parameters validated
- **Audit Status**: Pending third-party audit

## 📚 Additional Resources

- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Stellar Network](https://www.stellar.org/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [NovaFund Docs](https://docs.novafund.io)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](../LICENSE) for details.
