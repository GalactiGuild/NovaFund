import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { PrismaService } from '../../prisma.service';
import { LedgerTrackerService } from './ledger-tracker.service';
import { EventHandlerService } from './event-handler.service';
import { DlqService } from './dlq.service';
import { RpcFallbackService } from '../../stellar/rpc-fallback.service';
import { ParserService } from './parser.service';
import { SorobanEvent, ParsedContractEvent, ContractEventType } from '../types/event-types';

/**
 * Service for indexing Soroban contract events.
 * Optimized for low memory usage using stream-based batch processing
 * and offloaded XDR parsing via background worker threads.
 */
@Injectable()
export class SorobanEventIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SorobanEventIndexerService.name);
  private readonly network: string;
  private readonly pollIntervalMs: number;
  private readonly maxEventsPerFetch: number;
  private readonly contractIds: string[];
  private readonly reorgDepthThreshold: number;

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
  ) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.pollIntervalMs = this.configService.get<number>('SOROBAN_INDEXER_POLL_INTERVAL_MS', 5000);
    this.maxEventsPerFetch = this.configService.get<number>('SOROBAN_INDEXER_MAX_EVENTS_PER_FETCH', 100);
    this.reorgDepthThreshold = this.configService.get<number>('INDEXER_REORG_DEPTH_THRESHOLD', 5);
    this.contractIds = this.getContractIds();
  }

  private getContractIds(): string[] {
    const contracts: string[] = [];
    const projectLaunch = this.configService.get<string>('PROJECT_LAUNCH_CONTRACT_ID');
    if (projectLaunch) contracts.push(projectLaunch);
    const escrow = this.configService.get<string>('ESCROW_CONTRACT_ID');
    if (escrow) contracts.push(escrow);
    
    const sorobanContracts = this.configService.get<string>('SOROBAN_CONTRACT_IDS');
    if (sorobanContracts) {
      contracts.push(...sorobanContracts.split(',').map(id => id.trim()));
    }
    return [...new Set(contracts)];
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Starting Soroban Event Indexer...');
    await this.initializeIndexer();
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down Soroban Event Indexer...');
    this.isShuttingDown = true;
    while (this.isRunning) {
      await this.sleep(100);
    }
    this.logger.log('Soroban Event Indexer shutdown complete');
  }

  private async initializeIndexer(): Promise<void> {
    try {
      const health = await this.rpcFallbackService.executeRpcOperation(
        async (server) => await server.getHealth(),
        'getHealth'
      );
      this.logger.log(`Soroban RPC Health: ${health.status}`);

      const latestLedger = await this.getLatestLedger();
      this.logger.log(`Latest Soroban ledger on network: ${latestLedger}`);

      await this.pollEvents();
    } catch (error) {
      this.logger.error(`Failed to initialize Soroban indexer: ${error.message}`);
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

      if (startLedger > latestLedger) return;

      this.logger.log(`Polling Soroban events from ledger ${startLedger} to ${latestLedger}`);

      if (cursor) {
        await this.handleReorgs(cursor, latestLedger);
      }

      let totalProcessed = 0;
      let totalFound = 0;

      for await (const eventBatch of this.fetchEventsStream(startLedger, latestLedger)) {
        totalFound += eventBatch.length;
        
        // OPTIMIZATION: Batch parse XDRs using worker threads
        const xdrs = eventBatch.map(e => e.value);
        const parsedDataBatch = await this.parserService.parseBatch(xdrs);

        for (let i = 0; i < eventBatch.length; i++) {
          const event = eventBatch[i];
          const parsedData = parsedDataBatch[i];

          try {
            if (await this.isEventProcessed(event.id)) continue;

            const eventType = this.extractEventType(event.topic);
            if (!eventType) continue;

            const parsedEvent: ParsedContractEvent = {
              eventId: event.id,
              ledgerSeq: event.ledger,
              ledgerClosedAt: new Date(event.ledgerClosedAt),
              contractId: event.contractId,
              eventType,
              transactionHash: event.txHash,
              data: parsedData,
              inSuccessfulContractCall: event.inSuccessfulContractCall,
            };

            await this.eventHandler.processEvent(parsedEvent);

            await this.prisma.processedEvent.create({
              data: {
                eventId: event.id,
                network: this.network,
                ledgerSeq: event.ledger,
                contractId: event.contractId,
                eventType: parsedEvent.eventType,
                transactionHash: event.txHash,
              },
            });

            totalProcessed++;
          } catch (error) {
            this.logger.error(`Failed to process Soroban event ${event.id}: ${error.message}`);
            await this.dlqService.push(event, error);
          }
        }
      }

      await this.ledgerTracker.updateCursor(latestLedger);
      this.logger.log(`Processed ${totalProcessed}/${totalFound} Soroban events`);

    } catch (error) {
      this.logger.error(`Error in Soroban polling loop: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async *fetchEventsStream(startLedger: number, endLedger: number): AsyncGenerator<SorobanEvent[]> {
    let cursor: string | undefined;
    const filters: SorobanRpc.Api.EventFilter[] = [{
      type: 'contract',
      contractIds: this.contractIds,
    }];

    let totalFetched = 0;
    do {
      const response = await this.rpcFallbackService.executeRpcOperation(
        async (server) => await server.getEvents({ startLedger, filters, limit: this.maxEventsPerFetch, cursor }),
        'getEvents'
      );

      if (response.events && response.events.length > 0) {
        const batch = response.events
          .filter(event => event.ledger <= endLedger)
          .map(event => this.transformRpcEvent(event));
        
        totalFetched += batch.length;
        yield batch;
      } else break;

      cursor = (response as any).cursor;
      if (totalFetched >= this.maxEventsPerFetch * 10) break;
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

  private async isEventProcessed(eventId: string): Promise<boolean> {
    // Note: This method needs ledgerSeq to use the compound unique constraint
    // For now, using a query that checks by eventId only
    const existing = await this.prisma.processedEvent.findFirst({
      where: { eventId },
    });
    return !!existing;
  }

  private extractEventType(topic: string[]): ContractEventType | null {
    const symbol = topic[0];
    const mapping: Record<string, ContractEventType> = {
      'proj_new': ContractEventType.PROJECT_CREATED,
      'contrib': ContractEventType.CONTRIBUTION_MADE,
      'm_apprv': ContractEventType.MILESTONE_APPROVED,
      'release': ContractEventType.FUNDS_RELEASED,
      'proj_fund': ContractEventType.PROJECT_FUNDED,
      'proj_done': ContractEventType.PROJECT_COMPLETED,
      'refund': ContractEventType.REFUND_ISSUED,
    };
    return mapping[symbol] || null;
  }

  private async handleReorgs(cursor: any, latestLedger: number): Promise<void> {
    // TODO: Implement getLedger method for RPC fallback service
    // const ledger = await this.rpcFallbackService.executeRpcOperation(
    //   async (server) => await server.getLedger(cursor.lastLedgerSeq),
    //   'getLedger'
    // );

    // For now, skip reorg detection
    this.logger.debug('Reorg detection skipped - getLedger not implemented');
  }

  private async getLatestLedger(): Promise<number> {
    const response = await this.rpcFallbackService.executeRpcOperation(
      async (server) => await server.getLatestLedger(),
      'getLatestLedger'
    );
    return response.sequence;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}