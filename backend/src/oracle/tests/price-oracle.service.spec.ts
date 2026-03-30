import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PriceOracleService } from '../price-oracle.service';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('PriceOracleService', () => {
  let service: PriceOracleService;

  const mockPrisma = {
    tokenPrice: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, unknown> = {
        'oracle.supportedTokens': ['XLM', 'USDC', 'USDT'],
        'oracle.binanceApiKey': '',
        'oracle.krakenApiKey': '',
        'oracle.coinbaseApiKey': '',
        'oracle.requestTimeoutMs': 8000,
        'oracle.priceCacheTtlSeconds': 60,
      };
      return cfg[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceOracleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PriceOracleService>(PriceOracleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null for getLatestPrice when no record exists', async () => {
    const result = await service.getLatestPrice('XLM');
    expect(result).toBeNull();
  });

  it('should return cached value for getLatestPrice if present', async () => {
    const cached = { symbol: 'XLM', price: 0.12345, sources: { binance: 0.123, kraken: 0.124 }, fetchedAt: new Date() };
    mockRedis.get.mockResolvedValueOnce(cached);
    const result = await service.getLatestPrice('XLM');
    expect(result).toEqual(cached);
  });
});
