# Upgradable Proxy Governance Implementation

## Overview

This document describes the implementation of governance-controlled upgrades for NovaFund smart contracts, ensuring that contract evolution is controlled exclusively by the Governance DAO voting mechanism rather than centralized admin keys.

## Architecture

### Key Components

1. **Governance DAO Contract**: The central decision-making body that votes on upgrade proposals
2. **ProjectLaunch Contract**: Core contract with governance-controlled upgrade capability
3. **Escrow Contract**: Can be similarly upgraded using the same pattern

### Upgrade Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Governance DAO Voting                     │
│  1. Proposal created to upgrade specific contract           │
│  2. Token holders vote on proposal                          │
│  3. Proposal executed if quorum reached and majority yes    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Schedule Upgrade (DAO Participant)              │
│  1. Verify governance contract is configured                │
│  2. Verify proposal exists and is executed (approved)       │
│  3. Verify participant voted on the proposal                │
│  4. Set pending upgrade with 48-hour time-lock              │
│  5. Contract must be paused before execution                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│            Execute Upgrade (After 48h Time-Lock)             │
│  1. Verify contract is paused                               │
│  2. Verify time-lock period has passed                      │
│  3. Update contract WASM using Soroban native upgrade      │
│  4. Clear pending upgrade state                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### New Storage Key

```rust
DataKey::GovernanceContract = 11  // Address of the Governance DAO contract
```

### New Functions

#### `set_governance_contract(admin, governance_contract)`

Sets the Governance DAO contract address. Admin-only function.

**Parameters:**
- `admin`: Current admin address
- `governance_contract`: Address of the Governance DAO contract

**Access Control:** Admin only

#### `get_governance_contract()`

Returns the configured Governance DAO contract address (if any).

**Returns:** `Option<Address>` - None if not configured

### Modified Functions

#### `schedule_upgrade(proposer, new_wasm_hash, proposal_id)`

**Changes from previous version:**
- Now requires a valid proposal ID instead of just admin authorization
- Verifies the proposal was executed (approved by DAO)
- Verifies the proposer participated in the vote
- No longer requires admin role - any DAO voter can schedule

**Parameters:**
- `proposer`: Address of a DAO participant who voted on the proposal
- `new_wasm_hash`: WASM hash of the new contract code
- `proposal_id`: ID of the executed governance proposal approving this upgrade

**Validation:**
1. Governance contract must be configured
2. Proposal must exist and be in "executed" state
3. Proposer must have voted on this proposal
4. Proposer must authorize the transaction

**Time-Lock:** 48 hours (172,800 seconds) before execution can occur

#### `execute_upgrade(executor)`

**Changes from previous version:**
- Can be called by anyone (not just admin) after time-lock
- Still requires contract to be paused for security
- Relies on governance approval done at scheduling stage

**Parameters:**
- `executor`: Any address (typically the scheduler or admin)

**Validation:**
1. Executor must authorize the transaction
2. Contract must be paused
3. Pending upgrade must exist
4. Time-lock period must have elapsed

#### `cancel_upgrade(admin)`

**No changes** - Remains admin-only for emergency cancellation

### Constants

```rust
UPGRADE_TIME_LOCK_SECS = 172800  // 48 hours
RESUME_TIME_DELAY = 86400        // 24 hours (for pause/resume)
```

## Security Considerations

### Multi-Layer Security

1. **Governance Approval**: Requires majority vote from token holders
2. **Time-Lock**: 48-hour delay allows community review
3. **Pause Requirement**: Contract must be paused during upgrade (emergency brake)
4. **Resume Delay**: 24-hour delay after pausing before resuming operations

### Attack Mitigation

- **Flash Loan Attacks**: Voting power based on staked tokens prevents flash loan manipulation
- **Rug Pulls**: Admin cannot unilaterally upgrade - requires DAO approval
- **Rushed Upgrades**: 48-hour time-lock ensures adequate review period
- **Malicious Execution**: Contract pause required, allowing community intervention

## Usage Example

### Step 1: Configure Governance Contract

```rust
// Admin sets up governance integration
client.set_governance_contract(
    &admin,
    &governance_contract_address
);
```

### Step 2: Create Governance Proposal

```rust
// In Governance contract:
let proposal_id = governance_client.create_proposal(
    &proposer,
    &upgrade_proposal_payload,  // Contains new WASM hash
    &start_time,
    &end_time,
);
```

### Step 3: DAO Votes

```rust
// Token holders vote on the proposal
governance_client.vote(&proposal_id, &voter, &true); // true = support upgrade
```

### Step 4: Finalize Proposal

```rust
// After voting period ends
governance_client.finalize(&proposal_id);
// Proposal is now "executed" if it passed
```

### Step 5: Schedule Upgrade

```rust
// Any voter can schedule the upgrade
project_launch_client.schedule_upgrade(
    &voter_who_participated,
    &new_wasm_hash,
    &proposal_id,
);
```

### Step 6: Pause Contract

```rust
// Wait for time-lock, then pause
project_launch_client.pause(&admin);
```

### Step 7: Execute Upgrade

```rust
// After 48-hour time-lock
project_launch_client.execute_upgrade(&anyone);
```

### Step 8: Resume Operations

```rust
// After 24-hour resume delay
project_launch_client.resume(&admin);
```

## Testing

Comprehensive tests are included in `project-launch/src/lib.rs`:

```bash
cd contracts
cargo test --package project-launch
```

**Test Coverage:**
- ✅ Setting governance contract
- ✅ Scheduling upgrade without governance fails
- ✅ Scheduling upgrade with invalid proposal fails
- ✅ Scheduling upgrade without voting participation fails
- ✅ Scheduling upgrade with valid proposal succeeds
- ✅ Executing upgrade before time-lock fails
- ✅ Executing upgrade without pause fails
- ✅ Executing upgrade after time-lock succeeds
- ✅ Cancelling upgrade clears pending state

## Migration Path

For existing deployments:

1. **Current State**: Admin-controlled upgrades
2. **Transition**: Admin calls `set_governance_contract()` to enable governance control
3. **Future State**: All upgrades require DAO approval

**Backward Compatibility**: If governance contract is not set, the contract can maintain backward compatibility mode (optional, based on implementation choice).

## Integration with Other Contracts

The same pattern can be applied to:

- **Escrow Contract**: For milestone-based fund release logic upgrades
- **Profit Distribution**: For changing distribution algorithms
- **AMM Liquidity Pools**: For fee structure or formula updates

Each contract should:
1. Add `GovernanceContract` storage key
2. Implement `set_governance_contract()`
3. Modify upgrade functions to require DAO approval
4. Add comprehensive tests

## Audit Recommendations

Before production deployment:

1. **Third-Party Audit**: Engage a reputable smart contract audit firm
2. **Bug Bounty**: Launch a bug bounty program for the upgrade mechanism
3. **Community Review**: Allow sufficient time for community analysis
4. **Testnet Deployment**: Deploy and test on Stellar testnet first
5. **Gradual Rollout**: Start with non-critical contracts

## Governance Best Practices

### Proposal Content
Upgrade proposals should include:
- Detailed description of changes
- Security audit reports
- Test coverage summary
- Migration plan (if breaking changes)
- Rollback plan (if issues discovered)

### Voting Period
Recommended minimum 7 days for upgrade proposals to ensure:
- Adequate community discussion
- Time for technical review
- Global participation across time zones

### Quorum Requirements
Consider requiring higher quorum for upgrades (e.g., 20% of total supply) vs. regular proposals.

## Conclusion

This implementation ensures NovaFund contracts can evolve through decentralized governance while maintaining strong security guarantees. The multi-layer approach (governance approval + time-lock + pause mechanism) provides robust protection against malicious upgrades while enabling legitimate protocol improvements.

---

**Document Version**: 1.0  
**Last Updated**: March 27, 2026  
**Author**: NovaFund Development Team
