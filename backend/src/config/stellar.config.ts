import { registerAs } from '@nestjs/config';

export interface StellarNetworkConfig {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  projectLaunchContractId: string;
  escrowContractId: string;
  profitDistributionContractId?: string;
  subscriptionPoolContractId?: string;
  governanceContractId?: string;
  reputationContractId?: string;
}

export interface IndexerConfig {
  pollIntervalMs: number;
  startLedger?: number;
  reorgDepthThreshold: number;
  maxEventsPerFetch: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export default registerAs('stellar', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  projectLaunchContractId: process.env.PROJECT_LAUNCH_CONTRACT_ID || '',
  escrowContractId: process.env.ESCROW_CONTRACT_ID || '',
  profitDistributionContractId: process.env.PROFIT_DISTRIBUTION_CONTRACT_ID,
  subscriptionPoolContractId: process.env.SUBSCRIPTION_POOL_CONTRACT_ID,
  governanceContractId: process.env.GOVERNANCE_CONTRACT_ID,
  reputationContractId: process.env.REPUTATION_CONTRACT_ID,
}));

export const indexerConfig = registerAs('indexer', () => ({
  pollIntervalMs: parseInt(process.env.INDEXER_POLL_INTERVAL_MS || '5000', 10),
  startLedger: process.env.INDEXER_START_LEDGER
    ? parseInt(process.env.INDEXER_START_LEDGER, 10)
    : undefined,
  reorgDepthThreshold: parseInt(process.env.INDEXER_REORG_DEPTH_THRESHOLD || '5', 10),
  maxEventsPerFetch: parseInt(process.env.INDEXER_MAX_EVENTS_PER_FETCH || '100', 10),
  retryAttempts: parseInt(process.env.INDEXER_RETRY_ATTEMPTS || '3', 10),
  retryDelayMs: parseInt(process.env.INDEXER_RETRY_DELAY_MS || '1000', 10),
}));
