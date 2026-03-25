import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BridgeService } from '../bridge.service';

@Injectable()
export class BridgePollTask {
  private readonly logger = new Logger(BridgePollTask.name);

  constructor(private readonly bridgeService: BridgeService) {}

  // Poll every 30 seconds for active bridge transactions
  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron(): Promise<void> {
    this.logger.debug('Polling cross-chain bridge transactions...');
    try {
      await this.bridgeService.pollPendingTransactions();
    } catch (err) {
      this.logger.error(`Bridge poll failed: ${err.message}`);
    }
  }
}
