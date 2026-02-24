import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { LedgerCursor, LedgerInfo, ReorgDetectionResult } from '../types/ledger.types';

/**
 * Service for tracking ledger state and handling re-orgs
 */
@Injectable()
export class LedgerTrackerService {
  private readonly logger = new Logger(LedgerTrackerService.name);
  private readonly network: string;
  private readonly reorgDepthThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.reorgDepthThreshold = this.configService.get<number>('INDEXER_REORG_DEPTH_THRESHOLD', 5);
  }

  /**
   * Get the last processed ledger cursor
   * @returns The ledger cursor or null if not initialized
   */
  async getLastCursor(): Promise<LedgerCursor | null> {
    const cursor = await this.prisma.ledgerCursor.findUnique({
      where: { network: this.network },
    });

    if (!cursor) {
      return null;
    }

    return {
      id: cursor.id,
      network: cursor.network,
      lastLedgerSeq: cursor.lastLedgerSeq,
      lastLedgerHash: cursor.lastLedgerHash || undefined,
      updatedAt: cursor.updatedAt,
      createdAt: cursor.createdAt,
    };
  }

  /**
   * Initialize the cursor for the first time
   * @param startLedger The starting ledger sequence
   * @returns The created cursor
   */
  async initializeCursor(startLedger: number): Promise<LedgerCursor> {
    this.logger.log(`Initializing ledger cursor at ledger ${startLedger} for network ${this.network}`);

    const cursor = await this.prisma.ledgerCursor.upsert({
      where: { network: this.network },
      update: {
        lastLedgerSeq: startLedger,
        lastLedgerHash: null,
      },
      create: {
        network: this.network,
        lastLedgerSeq: startLedger,
        lastLedgerHash: null,
      },
    });

    return {
      id: cursor.id,
      network: cursor.network,
      lastLedgerSeq: cursor.lastLedgerSeq,
      lastLedgerHash: cursor.lastLedgerHash || undefined,
      updatedAt: cursor.updatedAt,
      createdAt: cursor.createdAt,
    };
  }

  /**
   * Update the cursor after processing a ledger
   * @param ledgerSeq The processed ledger sequence
   * @param ledgerHash The ledger hash
   */
  async updateCursor(ledgerSeq: number, ledgerHash?: string): Promise<void> {
    await this.prisma.ledgerCursor.update({
      where: { network: this.network },
      data: {
        lastLedgerSeq: ledgerSeq,
        lastLedgerHash: ledgerHash || null,
      },
    });

    this.logger.debug(`Updated cursor to ledger ${ledgerSeq}`);
  }

  /**
   * Detect if a re-org has occurred
   * Compares the expected ledger hash with the actual hash from the network
   * 
   * @param currentLedger The current ledger info from the network
   * @returns ReorgDetectionResult indicating if re-org occurred
   */
  async detectReorg(currentLedger: LedgerInfo): Promise<ReorgDetectionResult> {
    const cursor = await this.getLastCursor();

    // No cursor yet, no re-org possible
    if (!cursor || !cursor.lastLedgerHash) {
      return {
        hasReorg: false,
        reorgDepth: 0,
        lastValidLedger: currentLedger.sequence - 1,
        newLatestLedger: currentLedger.sequence,
      };
    }

    // If we're at the same sequence, check hash
    if (currentLedger.sequence === cursor.lastLedgerSeq) {
      const hasReorg = currentLedger.hash !== cursor.lastLedgerHash;
      
      if (hasReorg) {
        this.logger.warn(
          `Re-org detected at ledger ${currentLedger.sequence}. ` +
          `Expected hash: ${cursor.lastLedgerHash}, Got: ${currentLedger.hash}`
        );
      }

      return {
        hasReorg,
        reorgDepth: hasReorg ? 1 : 0,
        lastValidLedger: hasReorg ? currentLedger.sequence - 1 : currentLedger.sequence,
        newLatestLedger: currentLedger.sequence,
      };
    }

    // If we've fallen behind, no re-org (just catching up)
    if (currentLedger.sequence > cursor.lastLedgerSeq) {
      return {
        hasReorg: false,
        reorgDepth: 0,
        lastValidLedger: cursor.lastLedgerSeq,
        newLatestLedger: currentLedger.sequence,
      };
    }

    // Current ledger is behind cursor - this indicates a re-org
    this.logger.warn(
      `Re-org detected. Current ledger ${currentLedger.sequence} is behind cursor ${cursor.lastLedgerSeq}`
    );

    return {
      hasReorg: true,
      reorgDepth: cursor.lastLedgerSeq - currentLedger.sequence,
      lastValidLedger: currentLedger.sequence,
      newLatestLedger: currentLedger.sequence,
    };
  }

  /**
   * Handle a detected re-org by rolling back to a safe ledger
   * @param reorgResult The re-org detection result
   * @returns The safe ledger sequence to resume from
   */
  async handleReorg(reorgResult: ReorgDetectionResult): Promise<number> {
    if (!reorgResult.hasReorg) {
      return reorgResult.newLatestLedger;
    }

    this.logger.warn(
      `Handling re-org with depth ${reorgResult.reorgDepth}. ` +
      `Rolling back to ledger ${reorgResult.lastValidLedger}`
    );

    // Calculate rollback depth (add buffer for safety)
    const rollbackDepth = Math.min(
      reorgResult.reorgDepth + 2,
      this.reorgDepthThreshold
    );

    const safeLedgerSeq = Math.max(0, reorgResult.lastValidLedger - rollbackDepth);

    // Delete processed events from the rolled-back ledgers
    await this.prisma.processedEvent.deleteMany({
      where: {
        network: this.network,
        ledgerSeq: {
          gt: safeLedgerSeq,
        },
      },
    });

    this.logger.log(`Deleted processed events after ledger ${safeLedgerSeq}`);

    // Update cursor to safe ledger
    await this.updateCursor(safeLedgerSeq);

    this.logger.log(`Re-org handled. Resuming from ledger ${safeLedgerSeq}`);

    return safeLedgerSeq;
  }

  /**
   * Check if an event has already been processed (idempotency)
   * @param eventId The unique event ID
   * @returns true if already processed
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const count = await this.prisma.processedEvent.count({
      where: {
        eventId,
        network: this.network,
      },
    });

    return count > 0;
  }

  /**
   * Mark an event as processed
   * @param eventId The unique event ID
   * @param ledgerSeq The ledger sequence
   * @param contractId The contract ID
   * @param eventType The event type
   * @param transactionHash The transaction hash
   */
  async markEventProcessed(
    eventId: string,
    ledgerSeq: number,
    contractId: string,
    eventType: string,
    transactionHash: string,
  ): Promise<void> {
    await this.prisma.processedEvent.upsert({
      where: { eventId },
      update: {},
      create: {
        eventId,
        network: this.network,
        ledgerSeq,
        contractId,
        eventType,
        transactionHash,
      },
    });
  }

  /**
   * Get the starting ledger for indexing
   * Uses configured start ledger or latest cursor
   * @param latestLedger The latest ledger on the network
   * @returns The ledger sequence to start from
   */
  async getStartLedger(latestLedger: number): Promise<number> {
    const cursor = await this.getLastCursor();
    const configuredStart = this.configService.get<number>('INDEXER_START_LEDGER');

    if (cursor) {
      // Resume from last processed + 1
      return cursor.lastLedgerSeq + 1;
    }

    if (configuredStart) {
      // Use configured start ledger
      this.logger.log(`Using configured start ledger: ${configuredStart}`);
      await this.initializeCursor(configuredStart - 1);
      return configuredStart;
    }

    // Default: start from current ledger
    this.logger.log(`Starting from current ledger: ${latestLedger}`);
    await this.initializeCursor(latestLedger - 1);
    return latestLedger;
  }

  /**
   * Log indexer progress
   * @param currentLedger The current ledger being processed
   * @param targetLedger The target ledger to catch up to
   * @param eventsProcessed Number of events processed in this batch
   */
  async logProgress(
    currentLedger: number,
    targetLedger: number,
    eventsProcessed: number,
  ): Promise<void> {
    const remaining = targetLedger - currentLedger;
    const progress = ((currentLedger / targetLedger) * 100).toFixed(2);

    this.logger.log(
      `Progress: Ledger ${currentLedger}/${targetLedger} (${progress}%) | ` +
      `Events: ${eventsProcessed} | Remaining: ${remaining}`
    );

    // Store log in database for monitoring
    await this.prisma.indexerLog.create({
      data: {
        level: 'info',
        message: `Processed ledger ${currentLedger}`,
        metadata: {
          currentLedger,
          targetLedger,
          eventsProcessed,
          progress: parseFloat(progress),
          network: this.network,
        },
      },
    });
  }

  /**
   * Log an error
   * @param message Error message
   * @param metadata Additional context
   */
  async logError(message: string, metadata?: Record<string, unknown>): Promise<void> {
    this.logger.error(message, metadata);

    await this.prisma.indexerLog.create({
      data: {
        level: 'error',
        message,
        metadata: (metadata || {}) as any,
      },
    });
  }
}
