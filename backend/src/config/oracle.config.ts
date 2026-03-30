import { registerAs } from '@nestjs/config';

export const oracleConfig = registerAs('oracle', () => ({
  binanceApiKey: process.env.BINANCE_API_KEY ?? '',
  krakenApiKey: process.env.KRAKEN_API_KEY ?? '',
  coinbaseApiKey: process.env.COINBASE_API_KEY ?? '',
  supportedTokens: (process.env.ORACLE_SUPPORTED_TOKENS ?? 'XLM,USDC,USDT').split(','),
  fetchIntervalMinutes: parseInt(process.env.PRICE_FETCH_INTERVAL_MINUTES ?? '5', 10),
  requestTimeoutMs: 8000,
  priceCacheTtlSeconds: 60,
}));
