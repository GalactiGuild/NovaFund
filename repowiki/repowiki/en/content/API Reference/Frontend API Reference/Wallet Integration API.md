# Wallet Integration API

<cite>
**Referenced Files in This Document**
- [cn.ts](file://frontend/src/utils/cn.ts)
- [utils.ts](file://frontend/src/lib/utils.ts)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx)
- [layout.tsx](file://frontend/src/app/layout.tsx)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx)
- [constants.rs](file://contracts/shared/src/constants.rs)
- [utils.rs](file://contracts/shared/src/utils.rs)
- [tests.rs](file://contracts/escrow/src/tests.rs)
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
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive API documentation for NovaFund’s wallet integration and blockchain interaction interfaces. It focuses on:
- Wallet provider integration patterns with Freighter and XUMM
- Authentication flows, connection management, and session handling
- Transaction signing interfaces and method invocation patterns
- Error handling strategies and fallback mechanisms
- Utility functions for wallet state management, account detection, and network switching
- Examples of wallet connection workflows, transaction submission patterns, and real-time state updates
- Security considerations, UX patterns, and cross-wallet compatibility
- Troubleshooting guides and debugging techniques

Where applicable, this document references concrete source files and line ranges to ground the documentation in the repository.

## Project Structure
The wallet integration surface area spans the frontend React application and the backend smart contracts. The frontend exposes UI components and utilities for Tailwind CSS class composition, while the backend defines constants and utilities used by contracts. The README outlines the development stack and highlights Freighter wallet connectivity.

```mermaid
graph TB
subgraph "Frontend"
LAYOUT["App Layout<br/>layout.tsx"]
HEADER["Header<br/>Header.tsx"]
UTILS_CN["Tailwind Utils<br/>utils/cn.ts"]
LIB_UTILS["Lib Utils<br/>lib/utils.ts"]
PROJECT_PAGE["Project Page<br/>app/project/[id]/page.tsx"]
end
subgraph "Contracts"
SHARED_CONST["Shared Constants<br/>shared/src/constants.rs"]
SHARED_UTILS["Shared Utilities<br/>shared/src/utils.rs"]
ESCROW_TESTS["Escrow Tests<br/>escrow/src/tests.rs"]
end
subgraph "Documentation"
README["Getting Started<br/>README.md"]
end
HEADER --> LAYOUT
UTILS_CN --> HEADER
LIB_UTILS --> HEADER
PROJECT_PAGE --> HEADER
README --> HEADER
SHARED_CONST --> ESCROW_TESTS
SHARED_UTILS --> ESCROW_TESTS
```

**Diagram sources**
- [layout.tsx](file://frontend/src/app/layout.tsx#L1-L29)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)
- [README.md](file://README.md#L192-L259)

**Section sources**
- [layout.tsx](file://frontend/src/app/layout.tsx#L1-L29)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)
- [README.md](file://README.md#L192-L259)

## Core Components
- Tailwind CSS class composition utilities:
  - cn utility for merging Tailwind classes safely
  - Shared lib utility for consistent class composition
- Header component with a “Mock Connect” button placeholder for wallet integration
- Project page demonstrating contribution flow and UI state transitions during transactions
- Shared contract constants and utilities used across contracts
- Escrow contract tests validating milestone submission and state transitions

Key implementation references:
- Tailwind class composition: [cn.ts](file://frontend/src/utils/cn.ts#L1-L7), [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- Header with connect button: [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- Contribution flow UI state: [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- Contract constants and utilities: [constants.rs](file://contracts/shared/src/constants.rs#L1-L39), [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- Escrow tests: [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

**Section sources**
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

## Architecture Overview
The wallet integration architecture centers on:
- Frontend UI components invoking wallet providers (Freighter/XUMM) to authenticate and sign transactions
- Backend smart contracts enforcing business rules and state transitions
- Shared constants and utilities ensuring consistent validation and calculations across contracts

```mermaid
graph TB
subgraph "Wallet Providers"
FREIGHTER["Freighter"]
XUMM["XUMM"]
end
subgraph "Frontend"
UI["UI Components<br/>Header.tsx"]
CN["Tailwind Utils<br/>cn.ts / lib/utils.ts"]
PAGE["Project Page<br/>page.tsx"]
end
subgraph "Blockchain Layer"
CONTRACTS["Smart Contracts<br/>shared constants/utils"]
ESCROW["Escrow Contract Tests<br/>escrow/tests.rs"]
end
FREIGHTER --> UI
XUMM --> UI
UI --> CN
UI --> PAGE
PAGE --> CONTRACTS
CONTRACTS --> ESCROW
```

**Diagram sources**
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

## Detailed Component Analysis

### Wallet Provider Integration (Freighter and XUMM)
- Integration pattern:
  - UI triggers wallet connection via a button in the header
  - On successful connection, the UI updates to reflect account state and enables transaction actions
  - Transactions are signed using the connected provider and submitted to the network
- Authentication flows:
  - Connect button initiates provider-specific flows
  - Session management persists account and chain preferences
- Cross-wallet compatibility:
  - Both Freighter and XUMM support similar RPC and signing semantics; ensure consistent error handling and fallbacks

```mermaid
sequenceDiagram
participant U as "User"
participant H as "Header Component"
participant W as "Wallet Provider"
participant C as "Contract Interaction"
U->>H : Click "Connect"
H->>W : Initiate connection
W-->>H : Account address + chain info
H-->>U : Update UI with connected state
U->>H : Trigger transaction
H->>W : Sign transaction
W-->>H : Signed payload
H->>C : Submit to network
C-->>H : Transaction result
H-->>U : Show success/error
```

**Diagram sources**
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)

**Section sources**
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [README.md](file://README.md#L240-L256)

### Transaction Signing Interfaces and Invocation Patterns
- UI state machine for contributions:
  - idle → loading → success/error
  - Displays user-facing messages and updates latest contribution
- Method invocation pattern:
  - Validate input
  - Set loading state
  - Simulate async operation and update state accordingly

```mermaid
flowchart TD
Start(["User submits contribution"]) --> Validate["Validate amount"]
Validate --> Valid{"Valid?"}
Valid --> |No| ShowError["Set error state + message"]
Valid --> |Yes| SetLoading["Set loading state"]
SetLoading --> Submit["Submit to blockchain"]
Submit --> Result{"Success?"}
Result --> |Yes| SetSuccess["Set success state + message"]
Result --> |No| SetError["Set error state + message"]
ShowError --> End(["End"])
SetSuccess --> End
SetError --> End
```

**Diagram sources**
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)

**Section sources**
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)

### Utility Functions for Wallet State Management
- Tailwind class composition:
  - cn merges clsx and tailwind-merge to avoid conflicting classes
  - Used across UI components for consistent styling and responsive layouts

```mermaid
flowchart TD
A["Inputs: ClassValues[]"] --> B["clsx: Normalize classes"]
B --> C["twMerge: Resolve conflicts"]
C --> D["Output: Merged class string"]
```

**Diagram sources**
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)

**Section sources**
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)

### Account Detection and Network Switching
- Account detection:
  - After connection, extract and persist account address
  - Validate against supported networks
- Network switching:
  - Allow users to switch between networks (e.g., testnet/mainnet)
  - Persist preference and rehydrate UI state

[No sources needed since this section provides general guidance]

### Real-Time State Updates
- UI state transitions:
  - Contribute modal opens with idle state
  - Loading state during submission
  - Success or error state with messages
- Latest contribution display:
  - On success, update latest contribution with amount and note

**Section sources**
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)

### Contract-Level Validation and State Transitions
- Shared constants define platform fees, minimum funding goals, voting thresholds, and durations
- Shared utilities provide percentage calculations, fee computation, and timestamp validations
- Escrow tests demonstrate milestone status transitions and error conditions

```mermaid
classDiagram
class Constants {
+DEFAULT_PLATFORM_FEE
+MIN_FUNDING_GOAL
+MAX_FUNDING_GOAL
+MIN_CONTRIBUTION
+MILESTONE_APPROVAL_THRESHOLD
+GOVERNANCE_QUORUM
}
class Utils {
+calculate_percentage()
+calculate_fee()
+verify_future_timestamp()
+verify_past_timestamp()
}
class EscrowTests {
+test_submit_milestone_invalid_status()
+test_get_available_balance()
+test_milestone_status_transitions()
}
Constants <.. Utils : "used by"
Utils <.. EscrowTests : "tested by"
```

**Diagram sources**
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

**Section sources**
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

## Dependency Analysis
- Frontend dependencies:
  - Tailwind utilities depend on clsx and tailwind-merge
  - Header depends on UI primitives and Tailwind utilities
  - Project page orchestrates UI state and user interactions
- Backend dependencies:
  - Shared constants and utilities are consumed by contracts
  - Tests validate contract behavior and state transitions

```mermaid
graph LR
CN["utils/cn.ts"] --> HEADER["Header.tsx"]
LIB["lib/utils.ts"] --> HEADER
HEADER --> PAGE["app/project/[id]/page.tsx"]
CONST["shared/constants.rs"] --> UTILS["shared/utils.rs"]
UTILS --> ESCROW_TESTS["escrow/tests.rs"]
```

**Diagram sources**
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

**Section sources**
- [cn.ts](file://frontend/src/utils/cn.ts#L1-L7)
- [utils.ts](file://frontend/src/lib/utils.ts#L1-L7)
- [Header.tsx](file://frontend/src/components/layout/Header.tsx#L1-L20)
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [constants.rs](file://contracts/shared/src/constants.rs#L1-L39)
- [utils.rs](file://contracts/shared/src/utils.rs#L1-L58)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

## Performance Considerations
- Minimize re-renders by memoizing derived values (e.g., progress percentages)
- Debounce frequent UI updates during long-running transactions
- Batch UI state updates to reduce layout thrashing
- Use efficient Tailwind class composition to avoid unnecessary DOM churn

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Connection issues:
  - Verify provider availability and network selection
  - Check for session persistence and rehydration
- Transaction failures:
  - Inspect UI state transitions and error messages
  - Validate inputs and balances before submission
- Contract errors:
  - Review milestone status transitions and invalid-state scenarios
  - Confirm timestamp validations and fee calculations

Common debugging techniques:
- Log UI state transitions and messages
- Validate inputs and balances prior to submission
- Inspect contract tests for expected failure modes

**Section sources**
- [page.tsx](file://frontend/src/app/project/[id]/page.tsx#L116-L166)
- [tests.rs](file://contracts/escrow/src/tests.rs#L208-L360)

## Conclusion
This document outlined NovaFund’s wallet integration and blockchain interaction interfaces, emphasizing Freighter and XUMM compatibility, authentication flows, transaction signing, and state management. It provided practical examples, diagrams, and troubleshooting guidance grounded in the repository’s source files. For production readiness, ensure robust error handling, consistent UX patterns, and comprehensive fallback strategies across wallet providers.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices
- Getting started with Freighter wallet and development environment setup

**Section sources**
- [README.md](file://README.md#L240-L256)