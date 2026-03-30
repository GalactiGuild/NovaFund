import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';

export interface SourcePrices {
  binance?: number;
  kraken?: number;
  coinbase?: number;
}

export interface TokenPriceResult {
  symbol: string;
  price: number;
  sources: SourcePrices;
  fetchedAt: Date;
}

/**
 * Pair mappings per exchange.
 * Binance uses USDT as quote; Kraken & Coinbase use USD as quote.
 */
const PAIR_MAP: Record<string, { binance: string; kraken: string; coinbase: string }> = {
  XLM: { binance: 'XLMUSDT', kraken: 'XXLMZUSD', coinbase: 'XLM-USD' },
  USDC: { binance: 'USDCUSDT', kraken: 'USDCUSD', coinbase: 'USDC-USD' },
  USDT: { binance: 'USDTUSDC', kraken: 'USDTZUSD', coinbase: 'USDT-USD' },
};

@Injectable()
export class PriceOracleService {
  private readonly logger = new Logger(PriceOracleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  async fetchAndPersistAll(): Promise<TokenPriceResult[]> {
    const tokens: string[] = this.configService.get<string[]>('oracle.supportedTokens') ?? [
      'XLM',
      'USDC',
      'USDT',
    ];
    const results = await Promise.allSettled(tokens.map((t) => this.fetchAndPersistOne(t)));
    return results
      .filter((r): r is PromiseFulfilledResult<TokenPriceResult> => r.status === 'fulfilled')
      .map((r) => r.value);
  }

  async getLatestPrice(symbol: string): Promise<TokenPriceResult | null> {
    const cacheKey = `oracle:price:${symbol.toUpperCase()}`;
    const cached = await this.redisService.get<TokenPriceResult>(cacheKey);
    if (cached) return cached;

    const record = await this.prisma.tokenPrice.findFirst({
      where: { symbol: symbol.toUpperCase() },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!record) return null;

    const result: TokenPriceResult = {
      symbol: record.symbol,
      price: Number(record.price),
      sources: record.sources as SourcePrices,
      fetchedAt: record.fetchedAt,
    };

    const ttl = this.configService.get<number>('oracle.priceCacheTtlSeconds') ?? 60;
    await this.redisService.set(cacheKey, result, ttl);
    return result;
  }

  async getLatestPrices(): Promise<TokenPriceResult[]> {
    const tokens: string[] = this.configService.get<string[]>('oracle.supportedTokens') ?? [
      'XLM',
      'USDC',
      'USDT',
    ];
    const results = await Promise.allSettled(tokens.map((t) => this.getLatestPrice(t)));
    return results
      .filter((r): r is PromiseFulfilledResult<TokenPriceResult | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((v): v is TokenPriceResult => v !== null);
  }

  // ─────────────────────────────────────────────────────────────
  // Internal fetch + persist
  // ─────────────────────────────────────────────────────────────

  private async fetchAndPersistOne(symbol: string): Promise<TokenPriceResult> {
    const upper = symbol.toUpperCase();
    const sources = await this.fetchFromAllSources(upper);
    const prices = Object.values(sources).filter((p): p is number => p !== undefined && !isNaN(p));

    if (prices.length < 2) {
      throw new Error(
        `Insufficient price sources for ${upper}: only ${prices.length} source(s) available`,
      );
    }

    const median = this.calculateMedian(prices);
    const fetchedAt = new Date();

    await this.prisma.tokenPrice.create({
      data: {
        symbol: upper,
        price: median,
        sources: sources as Prisma.InputJsonValue,
        fetchedAt,
      },
    });

    const result: TokenPriceResult = { symbol: upper, price: median, sources, fetchedAt };

    const ttl = this.configService.get<number>('oracle.priceCacheTtlSeconds') ?? 60;
    await this.redisService.set(`oracle:price:${upper}`, result, ttl);

    this.logger.log(
      `${upper} median=$${median.toFixed(6)} sources=${JSON.stringify(sources)}`,
    );
    return result;
  }

  private async fetchFromAllSources(symbol: string): Promise<SourcePrices> {
    const [binance, kraken, coinbase] = await Promise.allSettled([
      this.fetchBinance(symbol),
      this.fetchKraken(symbol),
      this.fetchCoinbase(symbol),
    ]);

    const sources: SourcePrices = {};
    if (binance.status === 'fulfilled' && binance.value !== null) sources.binance = binance.value;
    if (kraken.status === 'fulfilled' && kraken.value !== null) sources.kraken = kraken.value;
    if (coinbase.status === 'fulfilled' && coinbase.value !== null) sources.coinbase = coinbase.value;

    return sources;
  }

  // ─────────────────────────────────────────────────────────────
  // Per-exchange fetchers
  // ─────────────────────────────────────────────────────────────

  private async fetchBinance(symbol: string): Promise<number | null> {
    const pair = PAIR_MAP[symbol]?.binance;
    if (!pair) return null;

    const apiKey = this.configService.get<string>('oracle.binanceApiKey');
    const config: AxiosRequestConfig = {
      timeout: this.configService.get<number>('oracle.requestTimeoutMs') ?? 8000,
      headers: apiKey ? { 'X-MBX-APIKEY': apiKey } : {},
    };

    try {
      const { data } = await this.requestWithRateLimitRetry<{ price: string }>(
        `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
        config,
        `Binance:${symbol}`,
      );
      const price = parseFloat(data.price);
      if (!isFinite(price) || price <= 0) return null;
      return price;
    } catch (err) {
      this.logger.warn(`Binance fetch failed for ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchKraken(symbol: string): Promise<number | null> {
    const pair = PAIR_MAP[symbol]?.kraken;
    if (!pair) return null;

    const apiKey = this.configService.get<string>('oracle.krakenApiKey');
    const config: AxiosRequestConfig = {
      timeout: this.configService.get<number>('oracle.requestTimeoutMs') ?? 8000,
      headers: apiKey ? { 'API-Key': apiKey } : {},
    };

    try {
      const { data } = await this.requestWithRateLimitRetry<{
        error: string[];
        result: Record<string, { c: string[] }>;
      }>(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, config, `Kraken:${symbol}`);

      if (data.error?.length) {
        this.logger.warn(`Kraken API error for ${symbol}: ${data.error.join(', ')}`);
        return null;
      }
      const key = Object.keys(data.result)[0];
      const price = parseFloat(data.result[key].c[0]);
      if (!isFinite(price) || price <= 0) return null;
      return price;
    } catch (err) {
      this.logger.warn(`Kraken fetch failed for ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchCoinbase(symbol: string): Promise<number | null> {
    const pair = PAIR_MAP[symbol]?.coinbase;
    if (!pair) return null;

    const apiKey = this.configService.get<string>('oracle.coinbaseApiKey');
    const config: AxiosRequestConfig = {
      timeout: this.configService.get<number>('oracle.requestTimeoutMs') ?? 8000,
      headers: apiKey ? { 'CB-ACCESS-KEY': apiKey } : {},
    };

    try {
      const { data } = await this.requestWithRateLimitRetry<{ data: { amount: string } }>(
        `https://api.coinbase.com/v2/prices/${pair}/spot`,
        config,
        `Coinbase:${symbol}`,
      );
      const price = parseFloat(data.data.amount);
      if (!isFinite(price) || price <= 0) return null;
      return price;
    } catch (err) {
      this.logger.warn(`Coinbase fetch failed for ${symbol}: ${(err as Error).message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────

  private calculateMedian(prices: number[]): number {
    const sorted = [...prices].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private async requestWithRateLimitRetry<T>(
    url: string,
    config: AxiosRequestConfig,
    sourceLabel: string,
  ): Promise<AxiosResponse<T>> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await axios.get<T>(url, config);
      } catch (error) {
        const err = error as { response?: { status?: number; headers?: Record<string, string> } };
        const status = err.response?.status;
        const isLastAttempt = attempt === maxAttempts;

        if (status === 429 && !isLastAttempt) {
          const retryAfterHeader = err.response?.headers?.['retry-after'];
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
          const backoffMs = retryAfterSec > 0 ? retryAfterSec * 1000 : attempt * 1000;
          this.logger.warn(`${sourceLabel} rate-limited (429). Retrying in ${backoffMs}ms...`);
          await this.sleep(backoffMs);
          continue;
        }

        throw error;
      }
    }

    throw new Error(`${sourceLabel} request failed after retry attempts`);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
