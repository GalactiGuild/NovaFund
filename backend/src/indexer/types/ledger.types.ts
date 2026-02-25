/**
 * Ledger-related types for blockchain indexing
 */

/**
 * Ledger cursor state stored in database
 */
export interface LedgerCursor {
  id: string;
  network: string;
  lastLedgerSeq: number;
  lastLedgerHash?: string;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Ledger information from Stellar RPC
 */
export interface LedgerInfo {
  sequence: number;
  hash: string;
  prevHash: string;
  closedAt: Date;
  successfulTransactionCount: number;
  failedTransactionCount: number;
}

/**
 * Re-org detection result
 */
export interface ReorgDetectionResult {
  hasReorg: boolean;
  reorgDepth: number;
  lastValidLedger: number;
  newLatestLedger: number;
}

/**
 * Event filter for querying Soroban events
 */
export interface EventFilter {
  type?: string;
  contractIds?: string[];
  topics?: string[][];
}

/**
 * Pagination info for event queries
 */
export interface PaginationInfo {
  cursor?: string;
  limit: number;
}

/**
 * Result of fetching events from RPC
 */
export interface FetchEventsResult {
  events: SorobanEvent[];
  latestLedger: number;
  cursor?: string;
}

import { SorobanEvent } from './event-types';
