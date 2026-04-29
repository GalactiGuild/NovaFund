import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { PrismaService } from '../../prisma.service';
import { LedgerTrackerService } from './ledger-tracker.service';
import { EventHandlerService } from './event-handler.service';
import { DlqService } from './dlq.service';
import { RpcFallbackService } from '../../stellar/rpc-fallback.service';
import { SorobanEvent, ParsedContractEvent, ContractEventType } from '../types/event-types';
import { LedgerInfo } from '../types/ledger.types';
import { ParserService } from './parser.service';
import { ParallelEventProcessorService } from './parallel-event-processor.service';

/**
 * Main indexer service that polls Stellar RPC for contract events
 * and synchronizes them to the local database.
 * 
 * Optimized for low memory usage and high performance using:
 * 1. Stream-based event fetching (batches)
 * 2. Background worker threads for XDR decoding
 * 3. Batch parsing of XDRs to reduce IPC overhead
 */
@Injectable()
export class IndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexerService.name);
  private readonly network: string;
  private readonly pollIntervalMs: number;
  private readonly maxEventsPerFetch: number;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;
  private readonly contractIds: string[];

  private isRunning = false;
  private isShuttingDown = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ledgerTracker: LedgerTrackerService,
    private readonly eventHandler: EventHandlerService,
    private readonly dlqService: DlqService,
    private readonly rpcFallbackService: RpcFallbackService,
    private readonly parserService: ParserService,
    private readonly parallelProcessor: ParallelEventProcessorService,
  ) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.pollIntervalMs = this.configService.get<number>('INDEXER_POLL_INTERVAL_MS', 5000);
    this.maxEventsPerFetch = this.configService.get<number>('INDEXER_MAX_EVENTS_PER_FETCH', 100);
    this.retryAttempts = this.configService.get<number>('INDEXER_RETRY_ATTEMPTS', 3);
    this.retryDelayMs = this.configService.get<number>('INDEXER_RETRY_DELAY_MS', 1000);
    this.contractIds = this.getContractIds();
  }

  private getContractIds(): string[] {
    const contracts: string[] = [];
    const ids = [
      'PROJECT_LAUNCH_CONTRACT_ID',
      'ESCROW_CONTRACT_ID',
      'PROFIT_DISTRIBUTION_CONTRACT_ID',
      'SUBSCRIPTION_POOL_CONTRACT_ID',
      'GOVERNANCE_CONTRACT_ID',
      'REPUTATION_CONTRACT_ID',
      'TOKEN_FACTORY_CONTRACT_ID'
    ];
    for (const id of ids) {
      const val = this.configService.get<string>(id);
      if (val) contracts.push(val);
    }
    return contracts;
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting blockchain indexer...');
    await this.initializeIndexer();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down blockchain indexer...');
    this.isShuttingDown = true;
    while (this.isRunning) {
      await this.sleep(100);
    }
    this.logger.log('Indexer shutdown complete');
  }

  private async initializeIndexer(): Promise<void> {
    try {
      const health = await this.rpcFallbackService.executeRpcOperation(
        async (server) => await server.getHealth(),
        'getHealth'
      );
      this.logger.log(`RPC Health: ${health.status}`);

      const latestLedger = await this.getLatestLedger();
      this.logger.log(`Latest ledger on network: ${latestLedger}`);

      const startLedger = await this.ledgerTracker.getStartLedger(latestLedger);
      this.logger.log(`Starting indexing from ledger ${startLedger}`);

      await this.pollEvents();
    } catch (error) {
      this.logger.error(`Failed to initialize indexer: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Interval(5000)
  async scheduledPoll(): Promise<void> {
    if (this.isShuttingDown) return;
    await this.pollEvents();
  }

  async pollEvents(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const cursor = await this.ledgerTracker.getLastCursor();
      const startLedger = cursor ? cursor.lastLedgerSeq + 1 : 1;
      const latestLedger = await this.getLatestLedger();

      if (cursor && latestLedger < cursor.lastLedgerSeq) {
        const newCursor = Math.max(1, latestLedger - 10);
        this.logger.warn(`Re-org detected. Resetting cursor from ${cursor.lastLedgerSeq} to ${newCursor}`);
        await this.ledgerTracker.updateCursor(newCursor);
        return;
      }

      if (startLedger > latestLedger) return;

      this.logger.log(`Polling events from ledger ${startLedger} to ${latestLedger}`);

      let totalProcessed = 0;
      let totalErrors = 0;
      let totalFound = 0;

      // Collect all events from the stream
      const allEvents: SorobanEvent[] = [];
      for await (const eventBatch of this.fetchEventsStream(startLedger, latestLedger)) {
        allEvents.push(...eventBatch);
      }

      totalFound = allEvents.length;

      if (totalFound > 0) {
        // OPTIMIZATION: Batch parse XDRs using worker threads
        const xdrs = allEvents.map(e => e.value);
        const parsedDataBatch = await this.parserService.parseBatch(xdrs);

        // Convert to parsed events
        const parsedEvents: ParsedContractEvent[] = [];
        for (let i = 0; i < allEvents.length; i++) {
          const event = allEvents[i];
          const parsedData = parsedDataBatch[i];

          const eventTypeSymbol = event.topic[0];
          const eventType = this.parseEventType(eventTypeSymbol);
          if (!eventType) continue;

          const parsedEvent: ParsedContractEvent = {
            eventId: event.id,
            ledgerSeq: event.ledger,
            ledgerClosedAt: new Date(event.ledgerClosedAt),
            contractId: event.contractId,
            eventType,
            transactionHash: event.txHash,
            data: { ...parsedData, eventType, rawXdr: event.value },
            inSuccessfulContractCall: event.inSuccessfulContractCall,
            pagingToken: event.pagingToken,
          };

          parsedEvents.push(parsedEvent);
        }

        // OPTIMIZATION: Process events in parallel using worker pool
        const stats = await this.parallelProcessor.processEventBatch(parsedEvents);
        totalProcessed = stats.processed;
        totalErrors = stats.failed;
      }

      await this.ledgerTracker.updateCursor(latestLedger);
      await this.ledgerTracker.logProgress(latestLedger, latestLedger, totalProcessed);

      if (totalFound > 0) {
        this.logger.log(`Processed ${totalProcessed}/${totalFound} events (${totalErrors} errors) using parallel processing`);
      }
    } catch (error) {
      this.logger.error(`Error in poll cycle: ${error.message}`, error.stack);
      await this.ledgerTracker.logError('Poll cycle failed', { error: error.message });
    } finally {
      this.isRunning = false;
    }
  }

  private async *fetchEventsStream(startLedger: number, _endLedger: number): AsyncGenerator<SorobanEvent[]> {
    let cursor: string | undefined;
    const filters: SorobanRpc.Api.EventFilter[] = this.contractIds.length > 0
      ? this.contractIds.map(id => ({ type: 'contract', contractIds: [id] }))
      : [{ type: 'contract' }];

    let totalFetched = 0;
    do {
      const response = await this.rpcFallbackService.executeRpcOperation(
        async (server) => await server.getEvents({ startLedger, filters, limit: this.maxEventsPerFetch, cursor }),
        'getEvents'
      );

      if (response.events && response.events.length > 0) {
        const batch = response.events.map(event => this.transformRpcEvent(event));
        totalFetched += batch.length;
        yield batch;
      } else break;

      cursor = (response as any).cursor;
      if (totalFetched >= this.maxEventsPerFetch * 5) break;
    } while (cursor);
  }

  private transformRpcEvent(event: SorobanRpc.Api.EventResponse): SorobanEvent {
    return {
      type: event.type,
      ledger: event.ledger,
      ledgerClosedAt: event.ledgerClosedAt,
      contractId: event.contractId.toString(),
      id: event.id,
      pagingToken: event.pagingToken,
      topic: event.topic.map((t: any) => t.toString()),
      value: event.value.toString(),
      inSuccessfulContractCall: event.inSuccessfulContractCall,
      txHash: (event as any).txHash || (event as any).transactionHash || '',
    };
  }

  private parseEventType(symbol: string): ContractEventType | null {
    return Object.values(ContractEventType).find((type) => type === symbol) || null;
  }

  private async getLatestLedger(): Promise<number> {
    const latestLedger = await this.rpcFallbackService.executeRpcOperation(
      async (server) => await server.getLatestLedger(),
      'getLatestLedger'
    );
    return latestLedger.sequence;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
