# Escrow Contract Documentation

## Overview

The Escrow Contract is a core trust component of NovaFund that manages project funds and releases them in controlled tranches based on milestone approvals. This contract enforces milestone-based fund releases entirely on-chain.

## Key Features

- **Secure Fund Holding**: Funds are locked in escrow and cannot be released arbitrarily
- **Milestone-Based Releases**: Payments only occur when milestones are completed and approved
- **Validator Voting**: Multiple validators must approve milestones using majority voting
- **Double-Release Prevention**: Once funds are released, they cannot be released again
- **Transparent Tracking**: All milestone transitions and votes are recorded on-chain and emit events

## Data Structures

### EscrowInfo

Stores information about an escrow for a project.

```rust
pub struct EscrowInfo {
    pub project_id: u64,
    pub creator: Address,
    pub token: Address,
    pub total_deposited: Amount,
    pub released_amount: Amount,
    pub validators: Vec<Address>,
}
```

- `project_id`: Unique project identifier
- `creator`: Address of the project creator (has authority to create milestones)
- `token`: Token address for the escrow (currently used for accounting)
- `total_deposited`: Total amount of funds deposited into the escrow
- `released_amount`: Total amount of funds that have been released
- `validators`: List of validator addresses authorized to vote on milestones

### Milestone

Represents a milestone with its current status and voting information.

```rust
pub struct Milestone {
    pub id: u64,
    pub project_id: u64,
    pub description: String,
    pub amount: Amount,
    pub status: MilestoneStatus,
    pub proof_hash: String,
    pub approval_count: u32,
    pub rejection_count: u32,
    pub created_at: Timestamp,
}
```

- `id`: Unique milestone identifier within the project
- `project_id`: Associated project identifier
- `description`: Milestone description
- `amount`: Amount to be released when milestone is approved
- `status`: Current milestone status (Pending, Submitted, Approved, Rejected)
- `proof_hash`: Hash of the milestone proof (empty until submission)
- `approval_count`: Number of approving votes
- `rejection_count`: Number of rejecting votes
- `created_at`: Timestamp when the milestone was created

### MilestoneStatus

Enum representing the lifecycle state of a milestone.

```rust
pub enum MilestoneStatus {
    Pending = 0,      // Created, awaiting submission
    Submitted = 1,    // Submitted with proof, awaiting validator votes
    Approved = 2,     // Approved by majority, funds released
    Rejected = 3,     // Rejected by majority
}
```

## Function Reference

### initialize

Initializes an escrow for a project.

```rust
pub fn initialize(
    env: Env,
    project_id: u64,
    creator: Address,
    token: Address,
    validators: Vec<Address>,
) -> Result<(), Error>
```

**Parameters:**
- `project_id`: Unique project identifier
- `creator`: Address of the project creator (will authorize other calls)
- `token`: Token address for the escrow
- `validators`: List of validator addresses (minimum 3 required)

**Validation:**
- Requires `creator` authorization
- Validators list must have at least 3 addresses
- Escrow must not already exist for this project

**Events:** Emits `ESCROW_INITIALIZED` event

---

### deposit

Deposits funds into the escrow.

```rust
pub fn deposit(
    env: Env,
    project_id: u64,
    amount: Amount,
) -> Result<(), Error>
```

**Parameters:**
- `project_id`: Project identifier
- `amount`: Amount to deposit (must be positive)

**Validation:**
- Escrow must exist
- Amount must be greater than 0

**Note:** Token transfers are handled separately; this function maintains accounting.

**Events:** Emits `FUNDS_LOCKED` event

---

### create_milestone

Creates a new milestone within an escrow.

```rust
pub fn create_milestone(
    env: Env,
    project_id: u64,
    description: String,
    amount: Amount,
) -> Result<(), Error>
```

**Parameters:**
- `project_id`: Project identifier
- `description`: Milestone description
- `amount`: Amount to be released when approved (must be positive)

**Validation:**
- Requires `creator` authorization
- Amount must be greater than 0
- Total milestone amounts must not exceed `total_deposited`

**Invariants:**
- Sum of all milestone amounts ≤ total_deposited (prevents over-allocation)

**Events:** Emits `MILESTONE_CREATED` event

---

### submit_milestone

Submits a milestone with proof for validator voting.

```rust
pub fn submit_milestone(
    env: Env,
    project_id: u64,
    milestone_id: u64,
    proof_hash: String,
) -> Result<(), Error>
```

**Parameters:**
- `project_id`: Project identifier
- `milestone_id`: Milestone identifier
- `proof_hash`: Hash of the milestone proof

**Validation:**
- Requires `creator` authorization
- Milestone must exist
- Milestone must be in `Pending` status

**Side Effects:**
- Changes milestone status to `Submitted`
- Resets approval and rejection vote counts to 0
- Clears previous validator votes

**Events:** Emits `MILESTONE_SUBMITTED` event

---

### vote_milestone

Records a validator's vote on a submitted milestone.

```rust
pub fn vote_milestone(
    env: Env,
    project_id: u64,
    milestone_id: u64,
    approve: bool,
) -> Result<(), Error>
```

**Parameters:**
- `project_id`: Project identifier
- `milestone_id`: Milestone identifier
- `approve`: `true` to approve, `false` to reject

**Validation:**
- Voter must be a validator in the escrow
- Milestone must exist and be in `Submitted` status
- Each validator may vote only once per milestone

**Voting Logic:**
- Approval threshold: 60% of validators (configurable via `MILESTONE_APPROVAL_THRESHOLD`)
- Majority approval (≥60%) → Status becomes `Approved`, funds are released
- Majority rejection → Status becomes `Rejected`
- Insufficient votes → Milestone remains in `Submitted`

**Events:**
- Emits `MILESTONE_APPROVED` and `FUNDS_RELEASED` on approval
- Emits `MILESTONE_REJECTED` on rejection

---

### get_escrow

Retrieves escrow information.

```rust
pub fn get_escrow(env: Env, project_id: u64) -> Result<EscrowInfo, Error>
```

**Parameters:**
- `project_id`: Project identifier

**Returns:** `EscrowInfo` or `Error::NotFound`

---

### get_milestone

Retrieves milestone information.

```rust
pub fn get_milestone(
    env: Env,
    project_id: u64,
    milestone_id: u64,
) -> Result<Milestone, Error>
```

**Parameters:**
- `project_id`: Project identifier
- `milestone_id`: Milestone identifier

**Returns:** `Milestone` or `Error::NotFound`

---

### get_total_milestone_amount

Calculates total amount allocated to all milestones.

```rust
pub fn get_total_milestone_amount(
    env: Env,
    project_id: u64,
) -> Result<Amount, Error>
```

**Parameters:**
- `project_id`: Project identifier

**Returns:** Sum of all milestone amounts

---

### get_available_balance

Calculates remaining available balance in escrow.

```rust
pub fn get_available_balance(
    env: Env,
    project_id: u64,
) -> Result<Amount, Error>
```

**Parameters:**
- `project_id`: Project identifier

**Returns:** `total_deposited - released_amount`

---

## Events

The contract emits the following events for all milestone lifecycle transitions:

| Event | When |
|-------|------|
| `ESCROW_INITIALIZED` | Escrow is initialized |
| `FUNDS_LOCKED` | Funds are deposited |
| `MILESTONE_CREATED` | Milestone is created |
| `MILESTONE_SUBMITTED` | Milestone is submitted with proof |
| `MILESTONE_APPROVED` | Milestone reaches majority approval |
| `FUNDS_RELEASED` | Funds are released for approved milestone |
| `MILESTONE_REJECTED` | Milestone reaches majority rejection |

## Error Handling

The contract uses structured `Error` enums for all expected failures:

| Error | Condition |
|-------|-----------|
| `NotInitialized` | Escrow doesn't exist |
| `AlreadyInitialized` | Escrow already exists |
| `Unauthorized` | Caller lacks required authority |
| `InvalidInput` | Invalid parameters |
| `NotFound` | Milestone doesn't exist |
| `InvalidMilestoneStatus` | Milestone is not in expected status |
| `NotAValidator` | Caller is not a validator |
| `AlreadyVoted` | Validator already voted on this milestone |
| `InsufficientEscrowBalance` | Milestone amount exceeds available funds |

## Storage Keys

The contract uses composite storage keys to prevent collisions:

| Key Format | Purpose |
|-----------|---------|
| `("escrow", project_id)` | Escrow information |
| `("milestone", project_id, milestone_id)` | Milestone information |
| `("m_counter", project_id)` | Milestone ID counter |
| `("v_vote", project_id, milestone_id, validator)` | Validator vote record |

## Constants

- `MILESTONE_APPROVAL_THRESHOLD`: 60% (6000 basis points)
- `MIN_VALIDATORS`: 3 validators required per project

## Invariants

1. **Validators are explicitly whitelisted**: Only addresses in the validators list can vote
2. **Total milestone amounts ≤ escrow total**: Prevents over-allocation
3. **One vote per validator per milestone**: No double voting
4. **Majority voting rule**: Approval requires ≥60% of validators
5. **Funds never released more than once**: released_amount only increases monotonically
6. **released_amount ≤ total_deposited**: No over-release

## Example Workflow

```
1. initialize(project_1, creator, xlm_token, [validator1, validator2, validator3])
   → Escrow created with 3 validators

2. deposit(project_1, 10000)
   → total_deposited = 10000

3. create_milestone(project_1, "Feature A", 3000)
   → Milestone 0 created with 3000 XLM, status = Pending

4. submit_milestone(project_1, 0, "hash_abc123")
   → Milestone 0 status = Submitted

5. vote_milestone(project_1, 0, true) [validator1]
   → approval_count = 1

6. vote_milestone(project_1, 0, true) [validator2]
   → approval_count = 2, status = Approved, released_amount = 3000
   → Emits MILESTONE_APPROVED and FUNDS_RELEASED

7. get_available_balance(project_1)
   → Returns 7000 (10000 - 3000)
```

## Testing

The contract includes comprehensive unit tests covering:

- Escrow initialization
- Multiple milestone creation
- Successful majority approval flow
- Rejection flow
- Prevention of double-release
- Correct released_amount updates
- Storage key collision prevention
- Event emission verification

Run tests with:
```bash
cargo test --package escrow
```

## Implementation Notes

1. **No Panic on Expected Failures**: All validatable conditions use `Error` returns
2. **Safe Arithmetic**: Uses `checked_add` and `checked_sub` to prevent overflow
3. **Composite Keys**: Project ID and milestone ID are combined to prevent collisions
4. **Timestamp Tracking**: All milestones record creation timestamp for audit trails
5. **Efficient Voting**: Vote records use validator addresses as part of composite keys

## Future Enhancements

- Weighted voting based on validator reputation
- Time-based milestone deadlines
- Automatic fund release after deadline
- Partial milestone completion support
- Appeal/dispute resolution mechanism
