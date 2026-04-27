# 🌟 NovaFund - Decentralized Micro-Investment Platform

<div align="center">

![NovaFund Banner](https://via.placeholder.com/1200x300/6366f1/ffffff?text=NovaFund+Collective)

[![Stellar](https://img.shields.io/badge/Stellar-Network-blue?logo=stellar)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart_Contracts-Soroban-purple)](https://soroban.stellar.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Rust](https://img.shields.io/badge/Rust-1.75-orange?logo=rust)](https://www.rust-lang.org/)

**A decentralized micro-investment and crowdfunding platform on Stellar where contributors pool funds into projects, and smart contracts automatically manage investments, returns, and payouts.**

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Contract Development](#contract-development)
- [Frontend Development](#frontend-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## 🌐 Overview

**NovaFund Collective** is a revolutionary Stellar-based platform that democratizes investment opportunities through community-driven funding. Built on the Stellar blockchain using Soroban smart contracts, NovaFund enables users to propose projects, raise funds, and automatically distribute profits or rewards through trustless, transparent smart contracts.

### Why NovaFund?

- **🔒 Trustless Escrow**: Funds are secured in smart contracts until milestones are met
- **⚡ Instant Settlements**: Leverage Stellar's fast, low-cost transactions
- **🤝 Community-Driven**: Democratic funding decisions and transparent governance
- **📊 Automated Distribution**: Smart contracts handle all payments and profit-sharing
- **🏆 Reputation System**: Build trust through on-chain reputation tokens
- **🌍 Global Access**: Anyone, anywhere can participate in funding opportunities

---

## ✨ Key Features

### 1. 🚀 Project Launch Contracts

Each project is governed by a dedicated smart contract that defines:
- **Funding Goals**: Target amounts and deadlines
- **Token Support**: Accept XLM or custom Stellar tokens
- **Timeline Management**: Automated deadline enforcement
- **Payment Rules**: Flexible contribution structures

### 2. 🔐 Escrow & Milestone Contracts

- **Secure Holding**: Funds locked in escrow until milestones achieved
- **Conditional Release**: Automated partial releases based on progress
- **Refund Protection**: Automatic refunds if milestones aren't met
- **Transparency**: All milestone criteria publicly visible on-chain

### 3. 💰 Profit Distribution Contracts

- **Proportional Payouts**: Automatic distribution based on contribution percentages
- **Recurring Dividends**: Support for ongoing profit-sharing
- **Multi-Token Support**: Distribute returns in various Stellar assets
- **Real-Time Tracking**: Monitor your returns in real-time

### 4. 🔄 Subscription & Pooling Contracts

- **Recurring Investments**: Set up monthly or quarterly contributions
- **Automated Collection**: Smart contracts handle deposit management
- **Portfolio Updates**: Dynamic rebalancing and allocation
- **Flexible Withdrawal**: Exit pools with automated payout calculation

### 5. 👥 Multi-Party Payment Contracts

- **Stakeholder Management**: Support for creators, developers, and advisors
- **Automatic Allocation**: Each party receives their pre-defined share
- **Vesting Schedules**: Time-locked payments for team members
- **Dispute Resolution**: Built-in arbitration mechanisms

### 6. 🏅 Reputation & Reward Layer

- **Reputation Tokens**: Earn trust through successful projects
- **Premium Access**: High reputation unlocks better funding terms
- **Reduced Fees**: Platform incentives for reliable creators
- **Governance Rights**: Participate in platform decision-making

### 7. 🔒 Zero-Knowledge KYC (ZK-KYC)

- **Privacy-Preserving**: Verify identity without storing personal data
- **Cryptographic Proofs**: Only ZK proofs stored on-chain, never raw PII
- **Multiple Providers**: Support for Violet, Galxe, and other ZK-KYC providers
- **Regulatory Compliance**: Meet KYC requirements while maximizing user privacy
- **Reduced Liability**: Minimize platform exposure to sensitive user data

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TS)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Projects │  │ Investor │  │ Portfolio│  │  Wallet  │   │
│  │   Hub    │  │Dashboard │  │ Manager  │  │Integration│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Stellar Network Layer                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Soroban Smart Contracts                  │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │  │
│  │  │Project │ │ Escrow │ │ Profit │ │  Pool  │       │  │
│  │  │Launch  │ │Milestone│ │  Share │ │Subscription│  │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐                  │  │
│  │  │  Multi │ │Reputation│ │ Governance │            │  │
│  │  │  Party │ │ System │ │  Token  │                 │  │
│  │  └────────┘ └────────┘ └────────┘                  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   Data & Storage Layer                       │
│  ┌────────────────┐           ┌──────────────────┐         │
│  │  IPFS Storage  │           │ Stellar Ledger   │         │
│  │ (Project Info) │           │  (Transactions)  │         │
│  └────────────────┘           └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 Smart Contracts

### Contract Overview

| Contract | Purpose | Complexity |
|----------|---------|------------|
| **ProjectLaunch** | Create and manage project funding campaigns | High |
| **Escrow** | Hold funds and release based on milestones | High |
| **ProfitDistribution** | Automatically split returns to investors | Medium |
| **SubscriptionPool** | Manage recurring investment contributions | High |
| **MultiPartyPayment** | Handle multi-stakeholder payment splits | Medium |
| **Reputation** | Track and manage creator reputation | Medium |
| **Governance** | Platform voting and decision-making | High |

### Contract Interactions

```rust
// Example: Project Launch Flow
1. Creator deploys ProjectLaunch contract
2. Investors contribute via contribute() function
3. Funds locked in Escrow contract
4. Creator submits milestone proofs
5. Escrow releases funds if validated
6. ProfitDistribution handles investor returns
7. Reputation contract updates creator score
```

---

## 🛠️ Tech Stack

### Smart Contracts
- **Language**: Rust
- **Framework**: Soroban SDK
- **Blockchain**: Stellar Network (Testnet/Mainnet)
- **Testing**: Soroban CLI, Rust test framework

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript 5.0+
- **Styling**: Tailwind CSS
- **State Management**: Zustand / Redux Toolkit
- **Wallet Integration**: Freighter, XUMM
- **UI Components**: shadcn/ui, Radix UI

### Backend & Infrastructure
- **API**: REST / GraphQL
- **Database**: PostgreSQL (optional for indexing)
- **Storage**: IPFS (project metadata, documents)
- **Deployment**: Docker, Kubernetes
- **CI/CD**: GitHub Actions

### Development Tools
- **Package Manager**: npm / yarn / pnpm
- **Build Tool**: Vite
- **Testing**: Vitest, React Testing Library
- **Linting**: ESLint, Prettier
- **Version Control**: Git

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Rust** (v1.75 or higher)
- **Soroban CLI** ([Installation Guide](https://soroban.stellar.org/docs/getting-started/setup))
- **Git**
- **Docker** (optional, for containerized development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/novafund.git
   cd novafund
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install contract dependencies**
   ```bash
   cd ../contracts
   cargo build --target wasm32-unknown-unknown --release
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start local development**
   ```bash
   # Terminal 1: Start Stellar network (testnet or local)
   soroban network start

   # Terminal 2: Deploy contracts
   cd contracts
   ./scripts/deploy.sh

   # Terminal 3: Start frontend
   cd frontend
   npm run dev
   ```

6. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Connect your Freighter wallet
   - Start exploring NovaFund!

---

## 📁 Project Structure

```
NovaFund/
├── contracts/                 # Soroban smart contracts
│   ├── project-launch/       # Project creation and funding
│   ├── escrow/               # Escrow and milestone management
│   ├── profit-distribution/  # Investor payout logic
│   ├── subscription-pool/    # Recurring investment pools
│   ├── multi-party-payment/  # Multi-stakeholder payments
│   ├── reputation/           # Reputation system
│   ├── governance/           # Platform governance
│   └── shared/               # Shared utilities and libraries
│
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API and blockchain services
│   │   ├── utils/            # Helper functions
│   │   └── types/            # TypeScript type definitions
│   ├── public/               # Static assets
│   └── package.json
│
├── backend/                  # Optional backend services
│   ├── api/                  # REST/GraphQL API
│   ├── indexer/              # Blockchain event indexer
│   └── database/             # Database migrations
│
├── scripts/                  # Deployment and utility scripts
│   ├── deploy.sh             # Contract deployment
│   ├── test.sh               # Run all tests
│   └── setup.sh              # Initial setup
│
├── docs/                     # Documentation
│   ├── contracts/            # Contract documentation
│   ├── api/                  # API documentation
│   └── guides/               # User and developer guides
│
├── tests/                    # Integration tests
│   ├── e2e/                  # End-to-end tests
│   └── integration/          # Contract integration tests
│
├── .github/                  # GitHub workflows
│   └── workflows/
│       ├── ci.yml            # Continuous integration
│       └── deploy.yml        # Deployment automation
│
├── docker-compose.yml        # Docker configuration
├── .env.example              # Environment variables template
├── README.md                 # This file
└── LICENSE                   # MIT License
```

---

## 💻 Contract Development

### Building Contracts

```bash
cd contracts/project-launch
cargo build --target wasm32-unknown-unknown --release
```

### Testing Contracts

```bash
cargo test
```

### Deploying Contracts

```bash
# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/project_launch.wasm \
  --source ACCOUNT \
  --network testnet

# Initialize contract
soroban contract invoke \
  --id CONTRACT_ID \
  --source ACCOUNT \
  --network testnet \
  -- initialize --admin ADMIN_ADDRESS
```

### Contract Documentation

Each contract includes comprehensive inline documentation. Generate docs with:

```bash
cargo doc --open
```

---

## 🎨 Frontend Development

### Running Development Server

```bash
cd frontend
npm run dev
```

### Building for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Code Quality

```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

---

## 🧪 Testing

### Contract Tests

```bash
cd contracts
cargo test --all
```

### Frontend Tests

```bash
cd frontend
npm run test
```

### Integration Tests

```bash
npm run test:integration
```

### End-to-End Tests

```bash
npm run test:e2e
```

---

## 🚢 Deployment

### Testnet Deployment

1. **Configure network**
   ```bash
   soroban network add testnet \
     --rpc-url https://soroban-testnet.stellar.org:443 \
     --network-passphrase "Test SDF Network ; September 2015"
   ```

2. **Deploy contracts**
   ```bash
   ./scripts/deploy.sh testnet
   ```

3. **Deploy frontend**
   ```bash
   npm run build
   # Deploy to Vercel, Netlify, or your preferred host
   ```

### Mainnet Deployment

**⚠️ Important**: Thoroughly test on testnet before mainnet deployment!

```bash
./scripts/deploy.sh mainnet
```

---

## 🗺️ Roadmap

### Phase 1: Foundation (Q1 2026) ✅
- [x] Core smart contract development
- [x] Basic frontend UI
- [x] Wallet integration
- [x] Testnet deployment

### Phase 2: Core Features (Q2 2026) 🚧
- [ ] Project launch and funding
- [ ] Escrow and milestone management
- [ ] Profit distribution system
- [ ] Beta testing program

### Phase 3: Advanced Features (Q3 2026)
- [ ] Subscription pools
- [ ] Multi-party payments
- [ ] Reputation system
- [ ] Governance module

### Phase 4: Ecosystem Growth (Q4 2026)
- [ ] Mainnet launch
- [ ] Mobile app (iOS/Android)
- [ ] API marketplace
- [ ] Partner integrations

### Future Enhancements
- [ ] Cross-chain bridges
- [ ] AI-powered project analytics
- [ ] Social features and community tools
- [ ] Advanced DeFi integrations

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### Ways to Contribute

- 🐛 **Report Bugs**: Open an issue with detailed reproduction steps
- 💡 **Suggest Features**: Share your ideas for improvements
- 📝 **Improve Documentation**: Help make our docs clearer
- 💻 **Submit Code**: Fix bugs or implement new features
- 🧪 **Write Tests**: Improve test coverage
- 🌍 **Translate**: Help localize NovaFund

### Development Process

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Write/update tests**
5. **Commit your changes**
   ```bash
   git commit -m "Add amazing feature"
   ```
6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
7. **Open a Pull Request**

### Code Standards

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

### Community Guidelines

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

## 📄 License

This project is licensed under the **MIT License** -

---


<div align="center">

**⭐ Star us on GitHub — it helps!**

Made with ❤️ using Stellar & Soroban

[Back to Top](#-novafund---decentralized-micro-investment-platform)

</div>

## 💰 Bounty Contribution

- **Task:** Implement 2FA (TOTP/SMS) for Large Payouts
- **Reward:** $10000
- **Source:** GitHub-Paid
- **Date:** 2026-04-27

