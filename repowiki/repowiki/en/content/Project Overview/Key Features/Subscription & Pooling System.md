# Subscription & Pooling System

<cite>
**Referenced Files in This Document**
- [contracts/README.md](file://contracts/README.md)
- [contracts/SETUP.md](file://contracts/SETUP.md)
- [contracts/subscription-pool/src/lib.rs](file://contracts/subscription-pool/src/lib.rs)
- [contracts/subscription-pool/Cargo.toml](file://contracts/subscription-pool/Cargo.toml)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs)
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs)
- [contracts/profit-distribution/src/types.rs](file://contracts/profit-distribution/src/types.rs)
- [contracts/profit-distribution/src/storage.rs](file://contracts/profit-distribution/src/storage.rs)
- [contracts/profit-distribution/src/events.rs](file://contracts/profit-distribution/src/events.rs)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
The Subscription & Pooling System enables recurring investment management and portfolio pooling on the Stellar network via Soroban smart contracts. It supports automated monthly or quarterly contributions, dynamic rebalancing, and flexible withdrawal calculations. The system is designed to integrate with investment contracts to process recurring contributions and allocate proceeds across pool members. This document explains how subscription pools work, how to configure them, how members join and withdraw, and how automated payouts are calculated.

## Project Structure
The Subscription & Pooling System is implemented as a standalone contract module with a shared library providing common types, errors, and utilities. The contract depends on the shared library and exposes core functions for pool lifecycle management.

```mermaid
graph TB
subgraph "Contracts"
SP["subscription-pool<br/>src/lib.rs"]
PD["profit-distribution<br/>src/lib.rs"]
SH["shared<br/>src/lib.rs"]
end
subgraph "Dependencies"
SDK["soroban-sdk"]
TYPES["shared/src/types.rs"]
ERRORS["shared/src/errors.rs"]
EVENTS["shared/src/events.rs"]
end
SP --> SH
SP -.-> SDK
PD --> SH
PD -.-> SDK
SH --> TYPES
SH --> ERRORS
SH --> EVENTS
```

**Diagram sources**
- [contracts/subscription-pool/src/lib.rs](file://contracts/subscription-pool/src/lib.rs#L1-L9)
- [contracts/subscription-pool/Cargo.toml](file://contracts/subscription-pool/Cargo.toml#L7-L16)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L11-L25)

**Section sources**
- [contracts/README.md](file://contracts/README.md#L105-L228)
- [contracts/SETUP.md](file://contracts/SETUP.md#L1-L153)
- [contracts/subscription-pool/Cargo.toml](file://contracts/subscription-pool/Cargo.toml#L1-L16)

## Core Components
- Subscription Pool Contract: Manages recurring investment pools, subscriber schedules, deposit processing, portfolio rebalancing, and withdrawals with payout calculations.
- Shared Library: Provides common types (timestamps, amounts, basis points), error enums, event constants, and helper utilities.
- Profit Distribution Contract: Handles investor share registration, profit deposits, proportional distributions, and dividend claims. It complements the subscription pool by enabling pooled returns distribution.

Key capabilities:
- Pool creation and configuration
- Subscriber enrollment with recurring schedules (weekly/monthly/quarterly)
- Automated deposit collection and allocation
- Dynamic rebalancing of portfolio weights
- Flexible withdrawal calculations and payouts
- Integration with profit distribution for pooled returns

**Section sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L3-L78)

## Architecture Overview
The Subscription & Pooling System follows a modular architecture:
- The subscription pool manages pool state, subscriber schedules, and automated processing.
- The profit distribution contract manages investor shares and distributes returns proportionally.
- The shared library centralizes common types, errors, and events used across contracts.

```mermaid
graph TB
subgraph "Subscription Pool"
SP_API["create_pool()<br/>subscribe()<br/>process_deposits()<br/>rebalance()<br/>withdraw()"]
end
subgraph "Profit Distribution"
PD_API["initialize()<br/>register_investors()<br/>deposit_profits()<br/>distribute()<br/>claim_dividends()"]
end
subgraph "Shared"
TYPES["Timestamp, Amount, BasisPoints<br/>FeeConfig, TokenInfo, UserProfile"]
ERRORS["Error enum<br/>Subscription-related errors"]
EVENTS["Event constants"]
end
SP_API --> TYPES
SP_API --> ERRORS
SP_API --> EVENTS
PD_API --> TYPES
PD_API --> ERRORS
PD_API --> EVENTS
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L31-L78)

## Detailed Component Analysis

### Subscription Pool Contract
The subscription pool contract orchestrates recurring contributions and pool operations. It defines the lifecycle of a pool and the interactions between subscribers and the pool.

```mermaid
classDiagram
class SubscriptionPool {
+create_pool(config) PoolId
+subscribe(pool_id, subscriber, schedule) void
+process_deposits(now) void
+rebalance(pool_id, new_allocations) void
+withdraw(pool_id, subscriber) Payout
}
class Pool {
+pool_id : PoolId
+allocations : Map<Target, BasisPoints>
+balance : Amount
+status : Status
+created_at : Timestamp
}
class Subscriber {
+address : Address
+schedule : Schedule
+joined_at : Timestamp
+total_contributed : Amount
}
class Schedule {
+period : Period
+amount : Amount
+last_billed : Timestamp
+next_due : Timestamp
}
SubscriptionPool --> Pool : "manages"
SubscriptionPool --> Subscriber : "tracks"
Subscriber --> Schedule : "has"
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)

Implementation outline (placeholder):
- Pool creation initializes allocations and status.
- Subscribers enroll with a schedule (weekly/monthly/quarterly) and amount.
- Automated deposit processing checks due dates and collects contributions.
- Rebalancing updates portfolio targets and tracks deviations.
- Withdrawal calculates payouts based on realized gains/losses and remaining capital.

**Section sources**
- [contracts/subscription-pool/src/lib.rs](file://contracts/subscription-pool/src/lib.rs#L1-L9)
- [contracts/README.md](file://contracts/README.md#L212-L228)

### Profit Distribution Contract
The profit distribution contract complements the subscription pool by managing investor shares and distributing returns proportionally. It stores investor share records and emits events for deposits and claims.

```mermaid
sequenceDiagram
participant Pool as "Subscription Pool"
participant PD as "Profit Distribution"
participant Storage as "Storage"
participant Investor as "Investor"
Pool->>PD : "deposit_profits(project_id, amount)"
PD->>Storage : "set_project_token(project_id, token)"
PD->>Storage : "set_investor_share(investor, share)"
PD-->>Pool : "Ok"
Investor->>PD : "claim_dividends(project_id, investor)"
PD->>Storage : "get_investor_share(project_id, investor)"
PD-->>Investor : "claimable_amount"
Investor->>PD : "claim_dividends(project_id, investor)"
PD-->>Investor : "payout"
```

**Diagram sources**
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L36-L78)
- [contracts/profit-distribution/src/storage.rs](file://contracts/profit-distribution/src/storage.rs#L8-L33)
- [contracts/profit-distribution/src/types.rs](file://contracts/profit-distribution/src/types.rs#L3-L18)
- [contracts/profit-distribution/src/events.rs](file://contracts/profit-distribution/src/events.rs#L9-L21)

**Section sources**
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L3-L78)
- [contracts/profit-distribution/src/storage.rs](file://contracts/profit-distribution/src/storage.rs#L1-L33)
- [contracts/profit-distribution/src/types.rs](file://contracts/profit-distribution/src/types.rs#L1-L18)
- [contracts/profit-distribution/src/events.rs](file://contracts/profit-distribution/src/events.rs#L1-L21)

### Shared Types, Errors, and Utilities
Common types define timestamps, amounts, and basis points. Errors include subscription-specific categories such as inactive subscriptions, invalid periods, existing subscriptions, and withdrawal locks. Utilities provide helper calculations.

```mermaid
classDiagram
class Types {
+Timestamp : u64
+Amount : i128
+BasisPoints : u32
+FeeConfig { platform_fee, creator_fee, fee_recipient }
+TokenInfo { address, symbol, decimals }
+UserProfile { address, reputation_score, ... }
}
class Errors {
+SubscriptionNotActive
+InvalidSubscriptionPeriod
+SubscriptionExists
+WithdrawalLocked
}
class Utils {
+calculate_percentage(amount, percentage, total_percentage) i128
}
Utils --> Types : "uses"
Errors --> Types : "relates to"
```

**Diagram sources**
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L16-L20)

**Section sources**
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L16-L20)

### Practical Workflows

#### Investor sets up a subscription plan
- Pool manager creates a pool with initial allocations and status.
- Investor subscribes with a schedule (weekly/monthly/quarterly) and amount.
- The subscription pool records the subscriber and due dates.

```mermaid
sequenceDiagram
participant Manager as "Pool Manager"
participant Pool as "Subscription Pool"
participant Investor as "Investor"
Manager->>Pool : "create_pool(config)"
Pool-->>Manager : "pool_id"
Investor->>Pool : "subscribe(pool_id, subscriber, schedule)"
Pool-->>Investor : "Ok"
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/subscription-pool/src/lib.rs](file://contracts/subscription-pool/src/lib.rs#L3-L8)

#### Pool manager configures allocation strategies
- Pool manager updates allocations to rebalance the portfolio toward target weights.
- Deviations from targets trigger rebalancing actions.

```mermaid
flowchart TD
Start(["Rebalance Request"]) --> LoadAlloc["Load current allocations"]
LoadAlloc --> ComputeDeviation["Compute deviation from targets"]
ComputeDeviation --> Threshold{"Exceeds threshold?"}
Threshold --> |No| End(["No action"])
Threshold --> |Yes| Execute["Execute rebalancing trades"]
Execute --> Update["Update allocations and balance"]
Update --> End
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)

#### Automated collection and allocation
- At scheduled intervals, the pool processes deposits for all subscribers due now.
- Collected funds are allocated according to pool allocations.

```mermaid
sequenceDiagram
participant Scheduler as "Scheduler"
participant Pool as "Subscription Pool"
participant Storage as "Storage"
Scheduler->>Pool : "process_deposits(now)"
Pool->>Storage : "iterate subscribers with next_due <= now"
Pool->>Storage : "debit subscriber and credit pool"
Pool->>Storage : "update last_billed and next_due"
Pool-->>Scheduler : "Ok"
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)

#### Withdrawal and payout calculation
- On withdrawal, the pool calculates realized gains/losses and remaining capital.
- Payout is computed based on proportional share and distribution rules.

```mermaid
flowchart TD
Start(["Withdrawal Request"]) --> CheckEligible{"Eligible to withdraw?"}
CheckEligible --> |No| Error["Return error (e.g., locked)"]
CheckEligible --> |Yes| ComputeRealized["Compute realized gains/losses"]
ComputeRealized --> ComputeRemaining["Compute remaining capital"]
ComputeRemaining --> CalculatePayout["Calculate proportional payout"]
CalculatePayout --> Distribute["Distribute to subscriber"]
Distribute --> End(["Complete"])
Error --> End
```

**Diagram sources**
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)

## Dependency Analysis
The subscription pool contract depends on the shared library for common types, errors, and utilities. The profit distribution contract also depends on the shared library and provides complementary functionality for investor share management and return distribution.

```mermaid
graph TB
SP["subscription-pool/src/lib.rs"] --> SH_LIB["shared/src/lib.rs"]
SP --> SH_TYPES["shared/src/types.rs"]
SP --> SH_ERRORS["shared/src/errors.rs"]
PD["profit-distribution/src/lib.rs"] --> SH_LIB
PD --> SH_TYPES
PD --> SH_ERRORS
```

**Diagram sources**
- [contracts/subscription-pool/Cargo.toml](file://contracts/subscription-pool/Cargo.toml#L7-L16)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L11-L25)

**Section sources**
- [contracts/subscription-pool/Cargo.toml](file://contracts/subscription-pool/Cargo.toml#L7-L16)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L11-L25)

## Performance Considerations
- Minimize storage reads/writes during deposit processing by batching subscriber updates.
- Use efficient data structures for subscriber lists and due-date indexing.
- Offload heavy computations to off-chain systems while keeping critical state on-chain.
- Optimize WASM compilation and consider contract optimization steps for gas efficiency.

## Troubleshooting Guide
Common subscription-related errors and resolutions:
- SubscriptionNotActive: Ensure the pool is active before processing deposits or withdrawals.
- InvalidSubscriptionPeriod: Validate schedule periods (weekly/monthly/quarterly) and amounts.
- SubscriptionExists: Prevent duplicate subscriptions by checking existing records before enrolling.
- WithdrawalLocked: Respect lock-up periods and withdrawal restrictions before allowing exits.

Operational tips:
- Monitor subscriber due dates and reconcile missed payments.
- Validate allocation targets and thresholds for rebalancing.
- Keep track of realized gains/losses for accurate payout calculations.

**Section sources**
- [contracts/shared/src/errors.rs](file://contracts/shared/src/errors.rs#L34-L46)

## Conclusion
The Subscription & Pooling System provides a robust framework for recurring investment management and portfolio pooling on Stellar. By combining automated subscription processing with dynamic rebalancing and flexible withdrawal calculations, it enables scalable, transparent, and efficient pooled investing. Integration with the profit distribution contract further enhances value capture and return distribution for investors.

## Appendices

### API Reference Summary
- Subscription Pool
  - create_pool(config): Initializes a new pool with allocations and status.
  - subscribe(pool_id, subscriber, schedule): Enrolls a subscriber with a recurring schedule.
  - process_deposits(now): Collects scheduled contributions.
  - rebalance(pool_id, new_allocations): Updates portfolio allocations.
  - withdraw(pool_id, subscriber): Calculates and executes payouts.

- Profit Distribution
  - initialize(project_id, token): Initializes distribution for a project.
  - register_investors(project_id, investors): Registers investor shares.
  - deposit_profits(project_id, amount): Adds profits for distribution.
  - claim_dividends(project_id, investor): Allows investor to claim dividends.

**Section sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)
- [contracts/profit-distribution/src/lib.rs](file://contracts/profit-distribution/src/lib.rs#L36-L78)