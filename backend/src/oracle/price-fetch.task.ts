import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PriceOracleService } from './price-oracle.service';

/**
 * Cron task that periodically fetches XLM and stablecoin prices
 * from multiple exchanges (Binance, Kraken, Coinbase), computes the
 * median, and persists the result to the database.
 *
 * Default schedule: every 5 minutes (configurable via PRICE_FETCH_INTERVAL_MINUTES).
 */
@Injectable()
export class PriceFetchTask {
  private readonly logger = new Logger(PriceFetchTask.name);

  constructor(
    private readonly priceOracleService: PriceOracleService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('*/5 * * * *', { name: 'price-oracle-fetch' })
  async handleCron(): Promise<void> {
    this.logger.debug('Running scheduled price oracle fetch...');
    try {
      const results = await this.priceOracleService.fetchAndPersistAll();
      this.logger.log(
        `Price oracle updated ${results.length} token(s): ${results.map((r) => `${r.symbol}=$${r.price.toFixed(6)}`).join(', ')}`,
      );
    } catch (err) {
      this.logger.error(`Price oracle cron failed: ${(err as Error).message}`);
    }
  }
}
