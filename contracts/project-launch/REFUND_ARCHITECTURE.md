# ProjectLaunch Refund Mechanism - Architecture & Flow Diagrams

## Project Lifecycle State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    Project Created                          │
│              (Status: Active)                               │
│         ┌─────────────────────────────────┐                 │
│         │ Accepts contributions            │                 │
│         │ Not yet at deadline              │                 │
│         └─────────────────────────────────┘                 │
│                      │                                       │
│                      ▼                                       │
│         ┌──────────────────────────┐                        │
│         │ Deadline Reached         │                        │
│         └──────────────────────────┘                        │
│                      │                                       │
│         ┌────────────┴────────────┐                         │
│         │                         │                         │
│         ▼                         ▼                         │
│  funding_goal MET          funding_goal NOT MET            │
│         │                         │                         │
│         ▼                         ▼                         │
│   COMPLETED                   FAILED                        │
│ (No refunds)              (Refunds available)              │
│         │                         │                         │
│         │          mark_project_failed()                   │
│         │          [Permissionless]                        │
│         │                         │                         │
│         │        ┌────────────────┘                         │
│         │        │                                          │
│         │        ▼                                          │
│         │   Processes once:                                │
│         │   - Sets ProjectFailureProcessed                 │
│         │   - Emits PROJECT_FAILED event (if failed)       │
│         │   - Prevents re-processing                       │
│         │                                                   │
│         └────────────────┬────────────────────────────────┘│
│                          │                                  │
│                          ▼                                  │
│       ┌──────────────────────────────────┐                 │
│       │   Contributors can claim refunds  │                 │
│       │    (Only if FAILED status)       │                 │
│       │                                  │                 │
│       │  refund_contributor()            │                 │
│       │  [Permissionless per contributor]│                 │
│       │                                  │                 │
│       │ Sets RefundProcessed flag        │                 │
│       │ Emits REFUND_ISSUED event        │                 │
│       │ Prevents double refunds          │                 │
│       └──────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Refund Processing Flow

```
START: Contributor wants refund
│
└─► Query: Is project status FAILED?
    │
    ├─ NO  ► Check why:
    │       - If COMPLETED: Project succeeded, no refund
    │       - If ACTIVE: Deadline not passed yet
    │       - If CANCELLED: Project cancelled, separate handling
    │       └─ END: Cannot refund
    │
    └─ YES ► Check: Has deadline passed?
             │
             ├─ NO  ► Need to wait until deadline
             │       │
             │       └─ After deadline:
             │           ANY CALLER can execute:
             │           mark_project_failed(project_id)
             │
             └─ YES ► Check: Already refunded?
                      │
                      ├─ YES ► Check storage:
                      │        is_refunded(project_id, contributor)
                      │        │
                      │        ├─ TRUE:  Already got refund ✓
                      │        └─ FALSE: Error in state
                      │
                      └─ NO  ► Execute refund:
                             refund_contributor(project_id, contributor)
                             │
                             ├─ Success:
                             │  - Tokens transferred back
                             │  - RefundProcessed flag set
                             │  - REFUND_ISSUED event emitted
                             │  └─ END: Refund complete ✓
                             │
                             └─ Failure:
                                - No contribution recorded
                                - Already deleted
                                - Contract error
                                └─ END: Cannot refund
```

## Concurrent Refund Handling

```
Project Status: FAILED
Total Contributors: 3 (A, B, C)

Timeline:
T=0: mark_project_failed() called by anyone
     Processes ONCE
     Sets ProjectFailureProcessed flag
     └─ Prevents re-execution

T=1+: Any contributor or third party can claim refunds:

      Path 1 (Contributor A)         Path 2 (Bot)              Path 3 (Contributor C)
      │                              │                          │
      ├─ refund_contributor()        ├─ refund_contributor()   ├─ refund_contributor()
      │  (A, project_id)             │  (B, project_id)        │  (C, project_id)
      │  │                           │  │                      │  │
      │  ├─ Check: FAILED ✓         │  ├─ Check: FAILED ✓     │  ├─ Check: FAILED ✓
      │  │                          │  │                       │  │
      │  ├─ Check: Not refunded ✓   │  ├─ Check: Not refunded✓ │  ├─ Check: Not refunded ✓
      │  │                          │  │                       │  │
      │  ├─ Get amount: 10 XLM      │  ├─ Get amount: 20 XLM   │  ├─ Get amount: 5 XLM
      │  │                          │  │                       │  │
      │  ├─ Transfer: 10 XLM ─────► A  ├─ Transfer: 20 XLM ──► B   ├─ Transfer: 5 XLM ──► C
      │  │                          │  │                       │  │
      │  └─ Set RefundProcessed(A)  │  └─ Set RefundProcessed(B)  └─ Set RefundProcessed(C)
      │                              │                          │
      └─ REFUND_ISSUED(A, 10)        └─ REFUND_ISSUED(B, 20)   └─ REFUND_ISSUED(C, 5)

All operations are INDEPENDENT and CAN RUN IN PARALLEL
Each has its own RefundProcessed flag - NO CONFLICTS
```

## Double-Refund Prevention Mechanism

```
Data Structure Layers:

┌──────────────────────────────────────────────────────────┐
│ ProjectFailureProcessed Flag                             │
│ Key: (ProjectFailureProcessed, project_id)               │
│                                                           │
│ Purpose: Ensure mark_project_failed() only executes once │
│                                                           │
│ Check: if env.storage().instance().has(&key)             │
│        └─ Returns true after first execution              │
│        └─ Prevents re-processing                         │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ RefundProcessed Flag                                     │
│ Key: (RefundProcessed, project_id, contributor)          │
│ Value: bool (true = refunded)                            │
│                                                           │
│ Purpose: Track which contributors already received       │
│          refunds, preventing double-refunds              │
│                                                           │
│ Check: if env.storage().instance().has(&refund_key)      │
│        └─ Returns true if refund already processed        │
│        └─ Prevents duplicate refund for same contributor │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ ContributionAmount Storage                               │
│ Key: (ContributionAmount, project_id, contributor)       │
│ Value: i128 (total amount contributed)                   │
│                                                           │
│ Purpose: Retrieve original contribution amount for       │
│          accurate refund calculation                     │
│                                                           │
│ Lookup: env.storage().persistent().get(&contribution_key)│
│         └─ Returns exact amount to refund                │
│         └─ Supports multiple contributions per user      │
└──────────────────────────────────────────────────────────┘

Execution Sequence:
┌─────────────────────────────────────────┐
│ refund_contributor() called              │
│ (project_id, contributor_address)       │
└──────────┬────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Verify Project Status                              │
│ ├─ Retrieve: Project from storage                          │
│ └─ Check: status == FAILED                                 │
│           Error if not FAILED                              │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Check Refund History                               │
│ ├─ Key: (RefundProcessed, project_id, contributor)         │
│ │                                                           │
│ └─ Check: env.storage().instance().has(&key)               │
│           ├─ If TRUE:  ERROR - Already refunded            │
│           └─ If FALSE: Continue                            │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Retrieve Contribution Amount                        │
│ ├─ Key: (ContributionAmount, project_id, contributor)      │
│ │                                                           │
│ └─ Check: amount > 0                                       │
│           ├─ If 0:   ERROR - No contribution found         │
│           └─ If > 0: Continue with amount                  │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Transfer Tokens                                    │
│ ├─ Call: TokenClient.transfer()                            │
│ │         (contract_address → contributor, amount)         │
│ │                                                           │
│ └─ If fails: Transaction REVERTS (atomic)                  │
│             RefundProcessed NOT set                        │
│             Retry possible                                 │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Mark as Refunded                                   │
│ ├─ Set: RefundProcessed flag → true                        │
│ │ Key: (RefundProcessed, project_id, contributor)          │
│ │                                                           │
│ └─ Ensures next call detects refund in Step 2              │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Emit Event                                         │
│ ├─ Event: REFUND_ISSUED                                    │
│ └─ Data: (project_id, contributor, amount)                 │
└──────────┬────────────────────────────────────────────────┘
           │
           ▼
       SUCCESS ✓
```

## Gas Cost Analysis Flow

```
mark_project_failed(project_id)
│
├─ Storage Read (Instance):
│  └─ Get Project: ~500 units
│
├─ Validation (In-memory):
│  ├─ Compare timestamps: ~10 units
│  ├─ Compare amounts: ~10 units
│  └─ Check status: ~10 units
│
├─ Storage Write (Instance):
│  ├─ Update Project status: ~500 units
│  └─ Set ProjectFailureProcessed flag: ~500 units
│
├─ Event Emission:
│  └─ Publish PROJECT_FAILED: ~100 units
│
└─ TOTAL: ~1,630 units
   └─ Flat cost regardless of contributors


refund_contributor(project_id, contributor)
│
├─ Storage Reads (Instance):
│  ├─ Get Project: ~500 units
│  └─ Has RefundProcessed: ~400 units
│
├─ Storage Read (Persistent):
│  └─ Get ContributionAmount: ~500 units
│
├─ Validation (In-memory):
│  ├─ Check status == FAILED: ~10 units
│  └─ Check amount > 0: ~10 units
│
├─ Token Transfer:
│  └─ TokenClient.transfer(): ~2,500-3,000 units
│
├─ Storage Write (Instance):
│  └─ Set RefundProcessed flag: ~500 units
│
├─ Event Emission:
│  └─ Publish REFUND_ISSUED: ~100 units
│
└─ TOTAL: ~5,000-6,000 units per contributor


Bulk Refund Example (10 contributors)
│
├─ mark_project_failed():
│  └─ Once: ~1,630 units
│
└─ refund_contributor() × 10:
   └─ 10 × ~5,500 = ~55,000 units
       (Some parallelization possible)

TOTAL: ~56,630 units
LIMIT:  10,000,000+ units per transaction
HEADROOM: ~177x safety margin
```

## API Contract Table

```
┌─────────────────────────────────────────────────────────────┐
│ PUBLIC FUNCTIONS                                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ mark_project_failed(project_id) -> Result<(), Error>        │
│ ├─ Permissions: Permissionless                              │
│ ├─ Auth required: No                                        │
│ ├─ Gas: ~1,500 units                                        │
│ ├─ Events: PROJECT_FAILED (if unmet goal)                   │
│ ├─ Idempotent: Yes (second call errors)                     │
│ └─ Side effects:                                            │
│    ├─ Sets ProjectFailureProcessed flag                     │
│    ├─ Changes Project.status                                │
│    └─ Emits event                                           │
│                                                              │
│ refund_contributor(project_id, contributor) -> Result<i128> │
│ ├─ Permissions: Permissionless                              │
│ ├─ Auth required: No                                        │
│ ├─ Gas: ~5,000-6,000 units                                  │
│ ├─ Events: REFUND_ISSUED                                    │
│ ├─ Idempotent: Yes (second call errors)                     │
│ └─ Side effects:                                            │
│    ├─ Transfers tokens                                      │
│    ├─ Sets RefundProcessed flag                             │
│    └─ Emits event                                           │
│                                                              │
│ is_refunded(project_id, contributor) -> bool                │
│ ├─ Permissions: Permissionless (read-only)                  │
│ ├─ Auth required: No                                        │
│ ├─ Gas: ~400 units                                          │
│ ├─ Events: None                                             │
│ ├─ Idempotent: Yes (always same result)                     │
│ └─ Return: true if RefundProcessed flag set                 │
│                                                              │
│ is_failure_processed(project_id) -> bool                    │
│ ├─ Permissions: Permissionless (read-only)                  │
│ ├─ Auth required: No                                        │
│ ├─ Gas: ~400 units                                          │
│ ├─ Events: None                                             │
│ ├─ Idempotent: Yes (always same result)                     │
│ └─ Return: true if ProjectFailureProcessed flag set         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Storage Interaction Matrix

```
         │ Instance │ Persistent │ Ledger │ Event
─────────┼──────────┼────────────┼────────┼───────
mark_     │   R/W    │            │   R    │   W
failed    │  Project │            │ Time   │
          │ Failure  │            │        │
          │ Flags    │            │        │
─────────┼──────────┼────────────┼────────┼───────
refund    │   R/W    │     R      │        │   W
contrib   │  Project │ Contrib.   │        │
          │ Refund   │  Amount    │        │
          │ Flags    │            │        │
─────────┼──────────┼────────────┼────────┼───────
is_       │   Read   │            │        │
refunded  │ Refund   │            │        │
          │ Flags    │            │        │
─────────┼──────────┼────────────┼────────┼───────
is_       │   Read   │            │        │
failure_  │ Failure  │            │        │
processed │ Flags    │            │        │
─────────┼──────────┼────────────┼────────┼───────
```

Legend:
- Instance: Hot storage (frequently accessed, limited size)
- Persistent: Cold storage (historical data, larger)
- Ledger: Blockchain ledger data (timestamp, etc)
- Event: Off-chain event emission
- R/W: Read/Write, R: Read only, W: Write only

This design ensures:
- Fast access to refund flags (instance storage)
- Scalability (persistent storage for contributions)
- Efficiency (minimal ledger reads)
- Auditability (events for all state changes)
