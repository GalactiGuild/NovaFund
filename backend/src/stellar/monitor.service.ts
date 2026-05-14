import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Horizon } from '@stellar/stellar-sdk';

@Injectable()
export class MonitorService {
  private readonly logger = new Logger(MonitorService.name);
  private horizonServer: Horizon.Server;
  private readonly platformAddresses: string[];
  private readonly slackWebhookUrl?: string;
  private lastCheckedLedger = 0;

  constructor(private readonly config: ConfigService) {
    const horizonUrl = this.config.get<string>(
      'stellar.horizonUrl',
      'https://horizon-testnet.stellar.org',
    );
    this.horizonServer = new Horizon.Server(horizonUrl);

    this.platformAddresses = this.config
      .get<string>('STELLAR_PLATFORM_ADDRESSES', '')
      .split(',')
      .filter(Boolean);

    this.slackWebhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');

    if (this.platformAddresses.length === 0) {
      this.logger.warn('No platform addresses configured for monitoring');
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorTransactions() {
    if (this.platformAddresses.length === 0) return;

    for (const address of this.platformAddresses) {
      try {
        const txs = await this.horizonServer
          .transactions()
          .forAccount(address)
          .order('desc')
          .limit(10)
          .call();

        for (const tx of txs.records) {
          if (tx.ledger <= this.lastCheckedLedger) continue;

          if (!tx.successful) {
            await this.alertFailedTransaction(address, tx);
          }
        }

        if (txs.records.length > 0) {
          this.lastCheckedLedger = Math.max(...txs.records.map((t) => t.ledger));
        }
      } catch (err) {
        this.logger.error(`Failed to monitor address ${address}: ${err.message}`);
      }
    }
  }

  private async alertFailedTransaction(address: string, tx: any) {
    const errorMessage = tx.result_xdr || 'Unknown error';
    const message = `🚨 **Transaction Failed**\n` +
      `Address: ${address}\n` +
      `Hash: ${tx.hash}\n` +
      `Ledger: ${tx.ledger}\n` +
      `Error: ${errorMessage}`;

    this.logger.error(message);

    if (this.slackWebhookUrl) {
      try {
        await fetch(this.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });
      } catch (err) {
        this.logger.error(`Failed to send Slack alert: ${err.message}`);
      }
    }
  }
}
