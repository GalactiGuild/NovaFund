# Contract Architecture

<cite>
**Referenced Files in This Document**
- [Cargo.toml](file://contracts/Cargo.toml)
- [README.md](file://contracts/README.md)
- [SETUP.md](file://contracts/SETUP.md)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml)
- [shared/lib.rs](file://contracts/shared/src/lib.rs)
- [shared/types.rs](file://contracts/shared/src/types.rs)
- [shared/constants.rs](file://contracts/shared/src/constants.rs)
- [shared/utils.rs](file://contracts/shared/src/utils.rs)
- [escrow/Cargo.toml](file://contracts/escrow/Cargo.toml)
- [escrow/lib.rs](file://contracts/escrow/src/lib.rs)
- [profit-distribution/lib.rs](file://contracts/profit-distribution/src/lib.rs)
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs)
- [README.md](file://README.md)
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

## Introduction
This document explains the smart contract architecture for the NovaFund platform, focusing on the Cargo workspace configuration, modular design with shared utilities, and the development workflow. It covers the seven workspace member contracts, the shared library, Soroban SDK 21.0.0 dependencies, Rust 1.75+ requirements, and release profiles optimized for WebAssembly deployment. It also outlines conceptual overviews for beginners and technical details for advanced developers, including WASM compilation, contract ID management, and inter-contract communication patterns.

## Project Structure
The contracts workspace is organized as a Cargo workspace with eight members:
- Seven domain contracts: project-launch, escrow, profit-distribution, subscription-pool, multi-party-payment, reputation, governance
- One shared library: shared

The root workspace defines common package metadata and global dependencies. Each member contract specifies its own package metadata and links to the shared library. The shared library consolidates common types, constants, errors, events, and utilities used across contracts.

```mermaid
graph TB
subgraph "Workspace Root"
WS["Cargo.toml<br/>workspace members, dependencies, profiles"]
end
subgraph "Contracts"
PL["project-launch"]
ES["escrow"]
PD["profit-distribution"]
SP["subscription-pool"]
MMP["multi-party-payment"]
REP["reputation"]
GOV["governance"]
end
subgraph "Shared Library"
SH["shared"]
end
WS --> PL
WS --> ES
WS --> PD
WS --> SP
WS --> MMP
WS --> REP
WS --> GOV
WS --> SH
PL --> SH
ES --> SH
PD --> SH
GOV --> SH
```

**Diagram sources**
- [Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml#L1-L12)
- [escrow/Cargo.toml](file://contracts/escrow/Cargo.toml#L1-L16)
- [profit-distribution/lib.rs](file://contracts/profit-distribution/src/lib.rs#L1-L78)
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L1-L363)

**Section sources**
- [Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [README.md](file://contracts/README.md#L1-L334)

## Core Components
- Workspace configuration: Defines resolver, members, common package metadata (version, edition, rust-version), and global dependencies (soroban-sdk, soroban-token-sdk).
- Release profiles: Two primary profiles are defined:
  - release: optimized for production with LTO, z-level optimization, symbol stripping, abort panic strategy, and single-codegen unit.
  - release-with-logs: inherits release settings and enables debug assertions for logging during testing.
- Shared library: Provides common types, constants, errors, events, and utilities. It is a rlib crate consumed by all contracts.

Key characteristics:
- Rust requirement: 1.75+ enforced at workspace level.
- SDK version: 21.0.0 for both soroban-sdk and soroban-token-sdk.
- Crate types:
  - shared: rlib
  - contracts: cdylib for WASM export

**Section sources**
- [Cargo.toml](file://contracts/Cargo.toml#L15-L38)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml#L1-L12)
- [shared/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)

## Architecture Overview
The contracts are designed around a modular, composable architecture:
- Domain contracts encapsulate specific business logic (project funding, escrow/milestones, profit distribution, subscriptions, multi-party payments, reputation, governance).
- The shared library centralizes cross-cutting concerns to reduce duplication and ensure consistency.
- Contracts communicate via on-chain invocations and shared state keys, emitting events for off-chain indexing.

```mermaid
graph TB
subgraph "Frontend"
FE["React + TypeScript UI"]
end
subgraph "Stellar/Soroban"
subgraph "Contracts"
PL["ProjectLaunch"]
ES["Escrow"]
PD["ProfitDistribution"]
SP["SubscriptionPool"]
MMP["MultiPartyPayment"]
REP["Reputation"]
GOV["Governance"]
end
SH["Shared Library"]
end
FE --> PL
FE --> ES
FE --> PD
FE --> SP
FE --> MMP
FE --> REP
FE --> GOV
PL --> SH
ES --> SH
PD --> SH
GOV --> SH
ES --> PL
PD --> ES
PD --> PL
SP --> PL
MMP --> PL
REP --> PL
GOV --> PL
```

**Diagram sources**
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L1-L363)
- [escrow/lib.rs](file://contracts/escrow/src/lib.rs#L1-L367)
- [profit-distribution/lib.rs](file://contracts/profit-distribution/src/lib.rs#L1-L78)
- [shared/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)

## Detailed Component Analysis

### Shared Library
The shared library provides foundational elements reused across contracts:
- Types: common aliases and structured types used in multiple contracts.
- Constants: platform-wide limits and thresholds.
- Utilities: helper functions for calculations and validations.
- Exports: re-exports enable concise imports in consumers.

```mermaid
classDiagram
class SharedLibrary {
+types
+errors
+events
+utils
+constants
+calculate_percentage(...)
}
class TypesModule {
+Timestamp
+Amount
+BasisPoints
+FeeConfig
+TokenInfo
+UserProfile
}
class ConstantsModule {
+DEFAULT_PLATFORM_FEE
+MAX_PLATFORM_FEE
+MIN_FUNDING_GOAL
+MAX_FUNDING_GOAL
+MIN_PROJECT_DURATION
+MAX_PROJECT_DURATION
+MIN_CONTRIBUTION
+MILESTONE_APPROVAL_THRESHOLD
+MIN_VALIDATORS
+REPUTATION_MIN
+REPUTATION_MAX
+REPUTATION_START
+GOVERNANCE_QUORUM
+VOTING_PERIOD
}
class UtilsModule {
+calculate_percentage(...)
+calculate_fee(...)
+verify_future_timestamp(...)
+verify_past_timestamp(...)
+calculate_share(...)
+validate_basis_points(...)
}
SharedLibrary --> TypesModule : "exports"
SharedLibrary --> ConstantsModule : "exports"
SharedLibrary --> UtilsModule : "exports"
```

**Diagram sources**
- [shared/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [shared/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [shared/constants.rs](file://contracts/shared/src/constants.rs#L1-L40)
- [shared/utils.rs](file://contracts/shared/src/utils.rs#L1-L59)

**Section sources**
- [shared/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [shared/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [shared/constants.rs](file://contracts/shared/src/constants.rs#L1-L40)
- [shared/utils.rs](file://contracts/shared/src/utils.rs#L1-L59)

### Project Launch Contract
The project-launch contract manages project lifecycle, funding goals, deadlines, and contributions. It emits events for project creation and contributions and stores persistent contribution records.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant PL as "ProjectLaunch Contract"
participant SH as "Shared Library"
FE->>PL : "initialize(admin)"
PL->>SH : "constants validation"
PL-->>FE : "initialized"
FE->>PL : "create_project(creator, goal, deadline, token, metadata)"
PL->>SH : "timestamp verification"
PL-->>FE : "project_id"
FE->>PL : "contribute(project_id, contributor, amount)"
PL->>PL : "update totals and store contribution"
PL-->>FE : "success"
```

**Diagram sources**
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L72-L248)
- [shared/constants.rs](file://contracts/shared/src/constants.rs#L1-L40)
- [shared/utils.rs](file://contracts/shared/src/utils.rs#L15-L23)

**Section sources**
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L1-L363)

### Escrow Contract
The escrow contract holds funds and releases them based on milestone approvals by validators. It tracks escrow info, milestone definitions, and validator votes, emitting events for lifecycle actions.

```mermaid
flowchart TD
Start(["Initialize Escrow"]) --> CheckValidators["Validate minimum validators"]
CheckValidators --> Exists{"Escrow exists?"}
Exists --> |Yes| Error["Return AlreadyInitialized"]
Exists --> |No| Create["Create EscrowInfo and milestone counter"]
Create --> PublishInit["Emit ESCROW_INITIALIZED"]
subgraph "Deposit"
D1["deposit(project_id, amount)"] --> D2["Validate amount > 0"]
D2 --> D3["Update total_deposited"]
D3 --> D4["Store escrow and emit FUNDS_LOCKED"]
end
subgraph "Milestone Creation"
C1["create_milestone(project_id, description, amount)"] --> C2["Validate amount and totals"]
C2 --> C3["Compute next milestone id"]
C3 --> C4["Store milestone and increment counter"]
C4 --> C5["Emit MILESTONE_CREATED"]
end
subgraph "Approval Flow"
V1["vote_milestone(project_id, milestone_id, voter, approve)"] --> V2["Verify voter is validator"]
V2 --> V3["Check status Submitted"]
V3 --> V4["Record vote and compute majority"]
V4 --> V5{"Approved?"}
V5 --> |Yes| V6["Set status Approved, release funds, emit APPROVED + FUNDS_RELEASED"]
V5 --> |No| V7["Set status Rejected, emit REJECTED"]
end
```

**Diagram sources**
- [escrow/lib.rs](file://contracts/escrow/src/lib.rs#L22-L307)
- [shared/constants.rs](file://contracts/shared/src/constants.rs#L24-L28)

**Section sources**
- [escrow/lib.rs](file://contracts/escrow/src/lib.rs#L1-L367)

### Profit Distribution Contract
The profit-distribution contract is a placeholder for investor share registration, profit deposits, and dividend claiming. It demonstrates the shared types and event emission patterns.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant PD as "ProfitDistribution Contract"
participant SH as "Shared Library"
FE->>PD : "initialize(project_id, token)"
PD-->>FE : "OK"
FE->>PD : "register_investors(project_id, investors_map)"
PD-->>FE : "OK"
FE->>PD : "deposit_profits(project_id, amount)"
PD-->>FE : "OK"
FE->>PD : "claim_dividends(project_id, investor)"
PD-->>FE : "amount"
```

**Diagram sources**
- [profit-distribution/lib.rs](file://contracts/profit-distribution/src/lib.rs#L31-L78)
- [shared/types.rs](file://contracts/shared/src/types.rs#L21-L40)

**Section sources**
- [profit-distribution/lib.rs](file://contracts/profit-distribution/src/lib.rs#L1-L78)

### Governance Contract
The governance contract provides a foundation for proposals, voting, and delegation. It leverages shared types and constants for consistent behavior across contracts.

```mermaid
flowchart TD
G0["Initialize Governance"] --> G1["Set admin and counters"]
G1 --> G2["create_proposal(...)"]
G2 --> G3["vote(voter, proposal_id, choice)"]
G3 --> G4{"Quorum and threshold reached?"}
G4 --> |Yes| G5["execute_proposal(...)"]
G4 --> |No| G6["Continue tallying"]
```

**Diagram sources**
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L1-L363)
- [shared/constants.rs](file://contracts/shared/src/constants.rs#L35-L39)

**Section sources**
- [project-launch/lib.rs](file://contracts/project-launch/src/lib.rs#L1-L363)

## Dependency Analysis
The workspace enforces consistent dependency management:
- Workspace-level dependencies: soroban-sdk 21.0.0, soroban-token-sdk 21.0.0.
- Workspace-level toolchain: Rust 1.75+.
- Crate types:
  - shared: rlib
  - contracts: cdylib for WASM export
- Dev dependencies: contracts include testutils feature for testing.

```mermaid
graph LR
WS["Workspace"] --> SDK["soroban-sdk 21.0.0"]
WS --> TSDK["soroban-token-sdk 21.0.0"]
WS --> RUST["Rust 1.75+"]
SH["shared"] --> SDK
PL["project-launch"] --> SDK
ES["escrow"] --> SDK
PD["profit-distribution"] --> SDK
GOV["governance"] --> SDK
SH -.->|"path = ../shared"| PL
SH -.->|"path = ../shared"| ES
SH -.->|"path = ../shared"| PD
SH -.->|"path = ../shared"| GOV
```

**Diagram sources**
- [Cargo.toml](file://contracts/Cargo.toml#L21-L23)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml#L7-L8)
- [escrow/Cargo.toml](file://contracts/escrow/Cargo.toml#L7-L9)

**Section sources**
- [Cargo.toml](file://contracts/Cargo.toml#L21-L23)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml#L7-L11)
- [escrow/Cargo.toml](file://contracts/escrow/Cargo.toml#L7-L12)

## Performance Considerations
Production builds are optimized for size and performance:
- opt-level = "z": aggressive size optimization.
- overflow-checks = true: safety without runtime cost in release.
- debug = 0: minimal debug info.
- strip = "symbols": reduces WASM binary size.
- debug-assertions = false: disables debug assertions in release.
- panic = "abort": smaller panic handling.
- codegen-units = 1: enables whole-program optimization.
- lto = true: link-time optimization across crates.

For development with logs, use the release-with-logs profile which inherits release settings and enables debug assertions.

**Section sources**
- [Cargo.toml](file://contracts/Cargo.toml#L25-L38)

## Troubleshooting Guide
Common issues and resolutions:
- Build failures due to missing WASM target:
  - Ensure wasm32-unknown-unknown target is installed.
- Version mismatches:
  - Confirm Rust 1.75+ and matching SDK versions across workspace.
- WASM size and gas concerns:
  - Use release profile with LTO and symbol stripping.
  - Consider soroban-cli optimize step for further size reduction.
- Testing and debugging:
  - Use testutils feature for contracts during development.
  - Enable release-with-logs for targeted diagnostics.

**Section sources**
- [README.md](file://contracts/README.md#L21-L66)
- [SETUP.md](file://contracts/SETUP.md#L37-L126)

## Conclusion
The NovaFund smart contract architecture leverages a Cargo workspace with seven domain contracts and a shared library to achieve modularity, consistency, and maintainability. The workspace enforces Soroban SDK 21.0.0 and Rust 1.75+, while release profiles are tuned for efficient WebAssembly deployment. Contracts use shared types, constants, and utilities, and inter-contract communication follows on-chain invocation patterns with standardized events. This design supports scalable development, clear separation of concerns, and robust production deployments on Stellar’s Soroban.