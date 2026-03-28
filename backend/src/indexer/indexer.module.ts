import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { IndexerService } from './services/indexer.service';
import { LedgerTrackerService } from './services/ledger-tracker.service';
import { EventHandlerService } from './services/event-handler.service';
import { DatabaseModule } from '../database.module';
import { StellarModule } from '../stellar/stellar.module';
import { EscrowAuditTask } from './tasks/escrow-audit.task';
import stellarConfig, { indexerConfig } from '../config/stellar.config';

/**
 * Blockchain Indexer Module
 *
 * This module provides background indexing of Stellar blockchain events
 * to synchronize on-chain state with the local database.
 */
@Module({
  imports: [
    // Enable scheduled tasks
    ScheduleModule.forRoot(),
    // Database access
    DatabaseModule,
    // Stellar RPC fallback service
    StellarModule,
    // Configuration
    ConfigModule.forFeature(stellarConfig),
    ConfigModule.forFeature(indexerConfig),
  ],
  providers: [
    // Core indexer service
    IndexerService,
    // Ledger state tracking
    LedgerTrackerService,
    // Event processing
    EventHandlerService,
    // Daily scheduled audit task
    EscrowAuditTask,
  ],
  exports: [
    // Export services for potential external use
    IndexerService,
    LedgerTrackerService,
    EventHandlerService,
  ],
})
export class IndexerModule {}
