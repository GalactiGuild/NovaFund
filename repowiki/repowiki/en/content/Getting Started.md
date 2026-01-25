# Getting Started

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [SETUP.md](file://contracts/SETUP.md)
- [Cargo.toml](file://contracts/Cargo.toml)
- [project-launch/Cargo.toml](file://contracts/project-launch/Cargo.toml)
- [project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs)
- [shared/Cargo.toml](file://contracts/shared/Cargo.toml)
- [frontend/package.json](file://frontend/package.json)
- [frontend/next.config.mjs](file://frontend/next.config.mjs)
- [frontend/tailwind.config.ts](file://frontend/tailwind.config.ts)
- [frontend/tsconfig.json](file://frontend/tsconfig.json)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment Configuration](#environment-configuration)
5. [Local Development Setup](#local-development-setup)
6. [First-Time Deployment](#first-time-deployment)
7. [Basic Usage Walkthrough](#basic-usage-walkthrough)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
NovaFund is a decentralized micro-investment and crowdfunding platform built on the Stellar blockchain using Soroban smart contracts. This guide helps you set up a complete development environment, configure your workspace, and run a local test network for rapid iteration. It covers prerequisites, installation, environment variables, contract and frontend setup, deployment basics, and common troubleshooting scenarios.

## Prerequisites
Before starting, ensure your machine meets the following requirements:
- Node.js v18 or higher
- Rust v1.75 or higher
- Soroban CLI (install via the official Soroban installation guide)
- Git
- Docker (optional, for containerized development)

These requirements enable you to compile Rust smart contracts to WebAssembly, interact with the Stellar network, and run a local development server for the frontend.

**Section sources**
- [README.md](file://README.md#L203-L212)

## Installation
Follow these steps to clone the repository and prepare your workspace:

1. Clone the repository
   - Use Git to clone the repository and navigate into the project directory.

2. Install frontend dependencies
   - Change into the frontend directory and install packages using your preferred package manager.

3. Install contract dependencies
   - Change into the contracts directory and build all contracts for the WebAssembly target.

4. Configure environment variables
   - Copy the example environment file to a local .env file and adjust settings as needed.

5. Start local development
   - Terminal 1: Start a local Stellar network (testnet or local).
   - Terminal 2: Deploy contracts using the provided deployment script.
   - Terminal 3: Start the frontend development server.

6. Open your browser
   - Navigate to the local development URL, connect a compatible wallet, and explore NovaFund.

Notes:
- The frontend uses Next.js and runs on port 5173 by default.
- The frontend package scripts define commands for development, building, and linting.

**Section sources**
- [README.md](file://README.md#L213-L257)
- [frontend/package.json](file://frontend/package.json#L5-L10)

## Environment Configuration
Environment variables are essential for connecting to the Stellar network and configuring contract deployment. The repository includes an example environment template that you should copy and customize for your setup.

Key steps:
- Copy the example environment file to a local .env file.
- Adjust network settings, RPC endpoints, and account keys according to your development or testnet configuration.

Tip:
- Keep sensitive credentials out of version control and use the .env file for local overrides.

**Section sources**
- [README.md](file://README.md#L233-L237)
- [README.md](file://README.md#L309-L311)

## Local Development Setup
This section explains how to spin up a local development environment and run the frontend against a local Stellar network.

High-level flow:
- Start a local Stellar network using the Soroban CLI.
- Build and deploy contracts to the network.
- Run the frontend development server.

Recommended terminals:
- Terminal 1: Start the network.
- Terminal 2: Build and deploy contracts.
- Terminal 3: Start the frontend.

Network and deployment commands:
- Start the network with the Soroban CLI.
- Deploy contracts using the provided script.
- Launch the frontend with the development command.

Browser access:
- Open the local URL in your browser.
- Connect a compatible wallet to interact with the frontend and contracts.

**Section sources**
- [README.md](file://README.md#L239-L256)
- [README.md](file://README.md#L241-L246)

## First-Time Deployment
Deploying contracts to a test network involves adding the network configuration and running the deployment script. The repository provides a streamlined process to deploy all contracts to testnet.

Steps:
1. Configure the testnet network using the Soroban CLI with the appropriate RPC endpoint and passphrase.
2. Run the deployment script to deploy and initialize contracts.
3. Build and deploy the frontend to your hosting provider.

Important note:
- Thoroughly test on testnet before considering mainnet deployment.

**Section sources**
- [README.md](file://README.md#L425-L454)

## Basic Usage Walkthrough
Once your environment is running, you can interact with NovaFund as follows:

- Explore the frontend
  - Navigate to the development URL and browse available projects.
  - Connect your wallet to interact with the interface.

- Understand the contract lifecycle
  - Contracts are organized into modules (e.g., project-launch, escrow, profit-distribution).
  - Each contract exposes functions for initialization, project creation, contributions, and more.

- Inspect a sample contract
  - The project-launch contract demonstrates initialization, project creation, and contributions with validation logic and events.

- Build and test contracts
  - Use the workspace configuration to build all contracts.
  - Run tests locally to validate behavior before deployment.

**Section sources**
- [README.md](file://README.md#L260-L313)
- [project-launch/src/lib.rs](file://contracts/project-launch/src/lib.rs#L72-L248)
- [Cargo.toml](file://contracts/Cargo.toml#L1-L38)

## Troubleshooting Guide
Common setup issues and their solutions:

- Node.js version mismatch
  - Symptom: Errors during frontend installation or build.
  - Solution: Ensure Node.js v18 or higher is installed and your PATH reflects the correct version.

- Rust toolchain or target missing
  - Symptom: Compilation errors when building contracts.
  - Solution: Install Rust and add the wasm32-unknown-unknown target. Verify with a check command.

- Soroban CLI not found
  - Symptom: Command not recognized when starting the network or deploying contracts.
  - Solution: Install the Soroban CLI and confirm it is available in your PATH.

- Port conflicts for the frontend
  - Symptom: Cannot start the development server due to port binding issues.
  - Solution: Change the frontend port in your environment or stop the conflicting service.

- Network connectivity issues
  - Symptom: Cannot connect to the local or testnet network.
  - Solution: Verify the network configuration and ensure the RPC endpoint is reachable.

- Contract build failures
  - Symptom: Errors when compiling contracts.
  - Solution: Review the workspace configuration, ensure all dependencies are present, and rebuild with the release profile.

- Wallet connection problems
  - Symptom: Cannot connect a wallet in the frontend.
  - Solution: Confirm your wallet extension is enabled and supports the network you are targeting.

**Section sources**
- [README.md](file://README.md#L203-L212)
- [SETUP.md](file://contracts/SETUP.md#L37-L58)
- [frontend/package.json](file://frontend/package.json#L5-L10)

## Conclusion
You are now ready to develop on NovaFund. Use the steps above to set up your environment, configure networks, deploy contracts, and iterate quickly with the frontend. As you become more familiar with the codebase, explore individual contracts, expand the frontend, and prepare for testnet/mainnet deployments.