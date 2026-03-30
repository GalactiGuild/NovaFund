import { Controller, Get, Param, NotFoundException, Logger } from '@nestjs/common';
import { PriceOracleService, TokenPriceResult } from './price-oracle.service';

@Controller('oracle/prices')
export class PriceOracleController {
  private readonly logger = new Logger(PriceOracleController.name);

  constructor(private readonly priceOracleService: PriceOracleService) {}

  /**
   * GET /oracle/prices
   * Returns the latest persisted price for every supported token.
   */
  @Get()
  async getLatestPrices(): Promise<TokenPriceResult[]> {
    return this.priceOracleService.getLatestPrices();
  }

  /**
   * GET /oracle/prices/:symbol
   * Returns the latest persisted price for a single token (e.g. XLM, USDC, USDT).
   */
  @Get(':symbol')
  async getLatestPrice(@Param('symbol') symbol: string): Promise<TokenPriceResult> {
    const result = await this.priceOracleService.getLatestPrice(symbol.toUpperCase());
    if (!result) {
      throw new NotFoundException(`No price data found for symbol: ${symbol.toUpperCase()}`);
    }
    return result;
  }
}
