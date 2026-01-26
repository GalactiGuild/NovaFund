# Architecture

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [contracts/README.md](file://contracts/README.md)
- [contracts/Cargo.toml](file://contracts/Cargo.toml)
- [contracts/SETUP.md](file://contracts/SETUP.md)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs)
- [contracts/project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs)
- [contracts/escrow/src/lib.rs](file://contracts/escrow/src/lib.rs)
- [frontend/package.json](file://frontend/package.json)
- [frontend/src/app/layout.tsx](file://frontend/src/app/layout.tsx)
- [frontend/src/app/page.tsx](file://frontend/src/app/page.tsx)
- [frontend/src/components/layout/Header.tsx](file://frontend/src/components/layout/Header.tsx)
- [frontend/src/components/layout/Footer.tsx](file://frontend/src/components/layout/Footer.tsx)
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
NovaFund is a decentralized micro-investment platform built on the Stellar blockchain using Soroban smart contracts. It enables creators to launch funding projects, investors to contribute, and smart contracts to manage escrow, milestone-based releases, profit distributions, recurring subscriptions, multi-stakeholder payments, reputation, and governance. The frontend is a React/TypeScript application that integrates with Stellar wallets and interacts with the smart contracts to provide a seamless user experience.

## Project Structure
The repository is organized into three primary areas:
- contracts/: Seven modular Soroban smart contracts plus a shared library for common types, errors, events, utilities, and constants.
- frontend/: A Next.js (React) application written in TypeScript, styled with Tailwind CSS.
- Root documentation and setup guides for contracts and deployment.

```mermaid
graph TB
subgraph "Contracts Workspace"
WS["contracts/Cargo.toml<br/>Workspace config"]
SH["shared/<br/>Common types/errors/events/utils/constants"]
PL["project-launch/<br/>Project creation & funding"]
ES["escrow/<br/>Escrow & milestones"]
PD["profit-distribution/<br/>Investor payouts"]
SP["subscription-pool/<br/>Recurring pools"]
MP["multi-party-payment/<br/>Multi-stakeholder splits"]
RP["reputation/<br/>Creator/investor reputation"]
GV["governance/<br/>Platform governance"]
end
subgraph "Frontend"
FE_PKG["frontend/package.json<br/>React + TypeScript"]
FE_APP["frontend/src/app/*<br/>Pages & layout"]
FE_COMP["frontend/src/components/*<br/>UI & layout"]
end
WS --> SH
WS --> PL
WS --> ES
WS --> PD
WS --> SP
WS --> MP
WS --> RP
WS --> GV
FE_PKG --> FE_APP
FE_PKG --> FE_COMP
```

**Diagram sources**
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [frontend/package.json](file://frontend/package.json#L1-L32)

**Section sources**
- [README.md](file://README.md#L260-L313)
- [contracts/README.md](file://contracts/README.md#L1-L334)
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [frontend/package.json](file://frontend/package.json#L1-L32)

## Core Components
- Shared Library (shared/): Provides common data types, error enums, event symbols, utilities, and constants used across contracts. This ensures consistency and reduces duplication.
- ProjectLaunch: Manages project lifecycle, funding goals, deadlines, and contribution tracking. Emits events for project creation and contributions.
- Escrow: Holds funds in escrow and releases them based on milestone approvals by validators.
- ProfitDistribution: Distributes returns to investors proportionally and tracks claimable dividends.
- SubscriptionPool: Manages recurring investment contributions and dynamic portfolio updates.
- MultiPartyPayment: Splits payments among multiple stakeholders with optional vesting and dispute resolution support.
- Reputation: Tracks on-chain reputation scores and badges for creators and investors.
- Governance: Enables platform-wide proposals, voting, and execution of decisions.

**Section sources**
- [contracts/README.md](file://contracts/README.md#L105-L280)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)
- [contracts/shared/src/types.rs](file://contracts/shared/src/types.rs#L1-L41)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L1-L31)
- [contracts/project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs#L57-L248)
- [contracts/escrow/src/lib.rs](file://contracts/escrow/src/lib.rs#L19-L346)

## Architecture Overview
The system follows a layered architecture:
- Frontend (React/TypeScript): Renders UI, orchestrates user actions, and communicates with the blockchain via wallet providers.
- Stellar Network Layer (Soroban): Executes smart contracts that enforce business logic and maintain immutable state.
- Data & Storage Layer: Off-chain metadata stored on IPFS/Arweave; on-chain transaction records on Stellar ledger; optional backend indexing and PostgreSQL for enhanced UX.

```mermaid
graph TB
UI["Frontend (React + TypeScript)"]
WALLET["Wallet Integration<br/>Freighter/XUMM"]
API["Optional Backend API/Indexer"]
DB["PostgreSQL (optional)"]
IPFS["IPFS/Arweave (metadata)"]
LEDGER["Stellar Ledger"]
SC["Soroban Contracts"]
UI --> WALLET
UI --> API
API --> DB
UI --> LEDGER
LEDGER --> SC
SC --> LEDGER
SC -. "Emit events" .-> UI
SC -. "Emit events" .-> API
API -. "Index events" .-> UI
UI -. "Fetch metadata" .-> IPFS
```

**Diagram sources**
- [README.md](file://README.md#L101-L136)
- [README.md](file://README.md#L169-L191)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L1-L31)

## Detailed Component Analysis

### Modular Contract Architecture
The contracts are organized as a Rust workspace with a shared library and seven specialized contracts. This promotes reuse, testability, and maintainability.

```mermaid
graph LR
SH["shared"]
PL["project-launch"]
ES["escrow"]
PD["profit-distribution"]
SP["subscription-pool"]
MP["multi-party-payment"]
RP["reputation"]
GV["governance"]
SH --> PL
SH --> ES
SH --> PD
SH --> SP
SH --> MP
SH --> RP
SH --> GV
```

**Diagram sources**
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L4-L13)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)

**Section sources**
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [contracts/SETUP.md](file://contracts/SETUP.md#L1-L153)

### Frontend Application Layout and Navigation
The frontend uses Next.js with a root layout that includes a header and footer. The header contains a wallet connect button, and the home page displays a welcome message.

```mermaid
graph TB
LAYOUT["RootLayout<br/>src/app/layout.tsx"]
HEADER["Header<br/>src/components/layout/Header.tsx"]
FOOTER["Footer<br/>src/components/layout/Footer.tsx"]
HOME["Home Page<br/>src/app/page.tsx"]
LAYOUT --> HEADER
LAYOUT --> HOME
LAYOUT --> FOOTER
```

**Diagram sources**
- [frontend/src/app/layout.tsx](file://frontend/src/app/layout.tsx#L1-L29)
- [frontend/src/components/layout/Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [frontend/src/components/layout/Footer.tsx](file://frontend/src/components/layout/Footer.tsx#L1-L15)
- [frontend/src/app/page.tsx](file://frontend/src/app/page.tsx#L1-L16)

**Section sources**
- [frontend/src/app/layout.tsx](file://frontend/src/app/layout.tsx#L1-L29)
- [frontend/src/components/layout/Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [frontend/src/components/layout/Footer.tsx](file://frontend/src/components/layout/Footer.tsx#L1-L15)
- [frontend/src/app/page.tsx](file://frontend/src/app/page.tsx#L1-L16)

### Project Launch Contract Flow
The ProjectLaunch contract manages project creation, funding goals, deadlines, and contributions. It emits events for project creation and contributions, enabling the frontend and optional backend to react.

```mermaid
sequenceDiagram
participant C as "Creator"
participant FL as "Frontend"
participant PL as "ProjectLaunch Contract"
participant ES as "Escrow Contract"
participant PD as "ProfitDistribution Contract"
C->>FL : "Create project"
FL->>PL : "initialize(admin)"
FL->>PL : "create_project(creator, goal, deadline, token, metadata_hash)"
PL-->>FL : "emit PROJECT_CREATED"
FL->>PL : "contribute(project_id, contributor, amount)"
PL-->>FL : "emit CONTRIBUTION_MADE"
Note over PL,ES : "On success, funds moved to Escrow"
FL->>ES : "Initialize escrow and milestones"
FL->>PD : "Register investors and set up distribution"
```

**Diagram sources**
- [contracts/project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs#L74-L248)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L3-L11)

**Section sources**
- [contracts/project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs#L57-L248)
- [contracts/README.md](file://contracts/README.md#L107-L177)

### Escrow and Milestone Approval Flow
The Escrow contract holds funds and releases them based on milestone approvals by validators. It enforces thresholds and tracks approvals/rejections.

```mermaid
flowchart TD
Start(["Milestone Submission"]) --> Validate["Validate milestone status"]
Validate --> |Valid| Approve["Validators vote (approve/reject)"]
Validate --> |Invalid| Error["Return error"]
Approve --> Count["Count approvals vs threshold"]
Count --> Approved{"Approved?"}
Approved --> |Yes| Release["Release funds to project creator"]
Approved --> |No| Rejected["Mark as rejected"]
Release --> Update["Update escrow totals"]
Rejected --> End(["Done"])
Update --> End
Error --> End
```

**Diagram sources**
- [contracts/escrow/src/lib.rs](file://contracts/escrow/src/lib.rs#L220-L307)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L13-L16)

**Section sources**
- [contracts/escrow/src/lib.rs](file://contracts/escrow/src/lib.rs#L19-L346)
- [contracts/README.md](file://contracts/README.md#L178-L194)

### Profit Distribution Contract Flow
The ProfitDistribution contract registers investors, accepts profits, and distributes returns proportionally. It supports manual claims and tracks claimable amounts.

```mermaid
sequenceDiagram
participant FL as "Frontend"
participant PD as "ProfitDistribution Contract"
participant INV as "Investors"
FL->>PD : "register_investors(investor_shares)"
FL->>PD : "deposit_profits(total_profits)"
FL->>PD : "distribute()"
PD-->>INV : "emit PROFIT_DISTRIBUTED"
INV->>PD : "claim_dividends()"
PD-->>INV : "emit DIVIDEND_CLAIMED"
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L195-L211)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L18-L20)

**Section sources**
- [contracts/README.md](file://contracts/README.md#L195-L211)

### Subscription Pool Contract Flow
The SubscriptionPool contract manages recurring contributions, scheduled deposits, and dynamic rebalancing. It tracks subscribers and calculates withdrawals.

```mermaid
flowchart TD
Create["create_pool(strategy)"] --> Subscribe["subscribe(schedule)"]
Subscribe --> Process["process_deposits(timestamp)"]
Process --> Deposit["Collect contributions"]
Deposit --> Rebalance["rebalance(portfolio)"]
Rebalance --> Withdraw["withdraw(calculate_payout)"]
Withdraw --> Done["Payout processed"]
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)

**Section sources**
- [contracts/README.md](file://contracts/README.md#L212-L228)

### Multi-Party Payment Contract Flow
The MultiPartyPayment contract splits incoming payments among stakeholders according to predefined shares, with optional vesting and withdrawal mechanisms.

```mermaid
sequenceDiagram
participant FL as "Frontend"
participant MP as "MultiPartyPayment Contract"
participant STAKEHOLDERS as "Stakeholders"
FL->>MP : "setup_parties(parties_and_shares)"
FL->>MP : "receive_payment(amount)"
MP->>MP : "distribute_shares()"
MP-->>STAKEHOLDERS : "emit payments"
STAKEHOLDERS->>MP : "withdraw_share()"
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L229-L245)

**Section sources**
- [contracts/README.md](file://contracts/README.md#L229-L245)

### Reputation and Governance Contracts
- Reputation: Registers entities, updates scores, issues badges, and tracks historical actions.
- Governance: Creates proposals, accepts votes, delegates voting power, and executes approved changes.

```mermaid
graph LR
REP["Reputation Contract"]
GOV["Governance Contract"]
REP --> REP
GOV --> GOV
```

**Diagram sources**
- [contracts/README.md](file://contracts/README.md#L246-L280)

**Section sources**
- [contracts/README.md](file://contracts/README.md#L246-L280)

## Dependency Analysis
- Internal Dependencies: All contracts depend on the shared library for types, errors, events, and utilities. This centralization reduces duplication and ensures consistent behavior.
- Frontend Dependencies: The frontend depends on Next.js, React, TypeScript, Tailwind CSS, and UI libraries. Wallet integration is facilitated by Freighter/XUMM.
- External Dependencies: Contracts rely on the Soroban SDK and Soroban Token SDK; frontend relies on React ecosystem packages.

```mermaid
graph TB
SH["shared"]
PL["project-launch"]
ES["escrow"]
PD["profit-distribution"]
SP["subscription-pool"]
MP["multi-party-payment"]
RP["reputation"]
GV["governance"]
SH --> PL
SH --> ES
SH --> PD
SH --> SP
SH --> MP
SH --> RP
SH --> GV
```

**Diagram sources**
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L4-L13)
- [contracts/shared/src/lib.rs](file://contracts/shared/src/lib.rs#L1-L20)

**Section sources**
- [contracts/Cargo.toml](file://contracts/Cargo.toml#L1-L38)
- [frontend/package.json](file://frontend/package.json#L11-L30)

## Performance Considerations
- WASM Optimization: Contracts are compiled with release profiles optimized for size and performance, leveraging LTO and strip optimizations.
- Gas Efficiency: Contracts minimize storage operations and use efficient data structures to reduce transaction costs.
- Frontend Optimization: Next.js build pipeline optimizes assets and bundles; wallet interactions should batch calls to reduce on-chain transactions.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Contract Initialization: Ensure contracts are initialized with proper admin addresses and parameters before use.
- Event Handling: Subscribe to emitted events to keep the UI and backend synchronized with on-chain state changes.
- Wallet Integration: Verify wallet provider compatibility (Freighter/XUMM) and handle connection failures gracefully.
- State Synchronization: Use backend indexing to monitor contract events and update local caches for improved responsiveness.

**Section sources**
- [contracts/project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs#L74-L85)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L1-L31)
- [README.md](file://README.md#L169-L191)

## Conclusion
NovaFund’s architecture leverages Rust and Soroban for secure, efficient smart contracts, and a modern React/TypeScript frontend for an intuitive user experience. The modular contract design, shared utilities, and event-driven communication enable scalable and maintainable functionality across project funding, escrow management, profit distribution, recurring investments, multi-stakeholder payments, reputation, and governance.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### System Context Diagrams
These diagrams illustrate how stakeholders interact with the platform.

```mermaid
graph TB
PC["Project Creator"]
INVESTOR["Investor"]
STAKEHOLDER["Stakeholder/Advisors"]
VALIDATOR["Validators"]
PLATFORM["Governance Voters"]
PC --> |"Launch project"| UI["Frontend"]
INVESTOR --> |"Contribute"| UI
STAKEHOLDER --> |"Receive payments"| UI
VALIDATOR --> |"Approve milestones"| UI
PLATFORM --> |"Vote on proposals"| UI
UI --> |"Interacts with"| SC["Soroban Contracts"]
SC --> |"Emits events"| UI
```

**Diagram sources**
- [README.md](file://README.md#L101-L136)
- [contracts/shared/src/events.rs](file://contracts/shared/src/events.rs#L1-L31)

### Infrastructure and Deployment Topology
- Blockchain: Deploy contracts to Stellar Testnet or Mainnet using the Soroban CLI.
- Frontend: Build and deploy static assets to a CDN or hosting provider.
- Optional Backend: Run an indexer to subscribe to contract events and maintain a relational database for enhanced queries and dashboards.

**Section sources**
- [README.md](file://README.md#L425-L454)
- [README.md](file://README.md#L185-L191)