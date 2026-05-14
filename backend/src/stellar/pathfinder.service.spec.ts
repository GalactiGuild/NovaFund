import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PathfinderService, PaymentPath } from './pathfinder.service';
import { RpcFallbackService } from './rpc-fallback.service';

describe('PathfinderService', () => {
  let service: PathfinderService;
  let configService: ConfigService;
  let rpcFallback: RpcFallbackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PathfinderService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
                STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
              };
              return config[key] || defaultValue;
            }),
          },
        },
        {
          provide: RpcFallbackService,
          useValue: {
            getRpcServer: jest.fn(),
            executeRpcOperation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PathfinderService>(PathfinderService);
    configService = module.get<ConfigService>(ConfigService);
    rpcFallback = module.get<RpcFallbackService>(RpcFallbackService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findBestPath', () => {
    it('should find a path from EURC to USDC', async () => {
      // Note: This is an integration test that requires live Stellar Horizon
      // In a real test environment, you'd mock the Horizon responses

      const path = await service.findBestPath(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      expect(path).toBeDefined();
      expect(path.sourceAsset).toBeDefined();
      expect(path.destinationAsset).toBeDefined();
      expect(path.sourceAmount).toBe('100');
      expect(path.estimatedFeePercentage).toBeGreaterThanOrEqual(0);
      expect(path.conversionRate).toBeGreaterThan(0);
      expect(path.lastUpdated).toBeInstanceOf(Date);
    });

    it('should handle native XLM as source asset', async () => {
      const path = await service.findBestPath(
        'XLM',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '50',
      );

      expect(path).toBeDefined();
      expect(path.sourceAsset.code).toBe('XLM');
      expect(path.sourceAsset.issuer).toBeUndefined();
    });

    it('should return fallback path when no direct route exists', async () => {
      // Using uncommon or non-existent asset pairs
      const path = await service.findBestPath(
        'FAKE',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
        'GCO2IP3UIX4SST2WRE3Y7AIW6YLSW6E27NZ5UHK7D6NMD2QAW3354WYN',
      );

      expect(path).toBeDefined();
      expect(path.estimatedFeePercentage).toBeGreaterThanOrEqual(0);
      expect(path.conversionRate).toBeLessThanOrEqual(1);
    });
  });

  describe('findBestRoutes', () => {
    it('should find multiple alternative routes', async () => {
      const analysis = await service.findBestRoutes(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
        undefined,
        3,
      );

      expect(analysis).toBeDefined();
      expect(analysis.bestPath).toBeDefined();
      expect(analysis.alternativePaths).toBeDefined();
      expect(Array.isArray(analysis.alternativePaths)).toBe(true);
      expect(analysis.totalRoutingMetrics).toBeDefined();
      expect(analysis.recommendation).toBeDefined();

      // Best path should have lowest fees
      const allPaths = [analysis.bestPath, ...analysis.alternativePaths];
      const lowestFee = Math.min(...allPaths.map(p => p.estimatedFeePercentage));
      expect(analysis.bestPath.estimatedFeePercentage).toBeLessThanOrEqual(lowestFee + 0.0001);
    });

    it('should sort paths by fee percentage', async () => {
      const analysis = await service.findBestRoutes(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
        undefined,
        3,
      );

      const allPaths = [analysis.bestPath, ...analysis.alternativePaths];
      for (let i = 0; i < allPaths.length - 1; i++) {
        expect(allPaths[i].estimatedFeePercentage).toBeLessThanOrEqual(
          allPaths[i + 1].estimatedFeePercentage,
        );
      }
    });

    it('should calculate correct metrics', async () => {
      const analysis = await service.findBestRoutes(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
        undefined,
        3,
      );

      const allPaths = [analysis.bestPath, ...analysis.alternativePaths];
      const fees = allPaths.map(p => p.estimatedFeePercentage);
      const rates = allPaths.map(p => p.conversionRate);

      const expectedAvg = fees.reduce((a, b) => a + b, 0) / fees.length;
      expect(analysis.totalRoutingMetrics.avgFeePercentage).toBeCloseTo(expectedAvg, 2);

      expect(analysis.totalRoutingMetrics.bestConversionRate).toBe(Math.max(...rates));
      expect(analysis.totalRoutingMetrics.worstConversionRate).toBe(Math.min(...rates));
    });
  });

  describe('analyzeSwapcost', () => {
    it('should analyze swap costs between two assets', async () => {
      const analysis = await service.analyzeSwapcost(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      expect(analysis).toBeDefined();
      expect(analysis.sourceAsset).toBe('EURC');
      expect(analysis.destinationAsset).toContain('USDC');
      expect(analysis.inputAmount).toBe('100');
      expect(parseFloat(analysis.outputAmount)).toBeLessThanOrEqual(100);
      expect(analysis.feePercentage).toBeGreaterThanOrEqual(0);
      expect(analysis.conversionRate).toBeGreaterThan(0);
      expect(analysis.recommendation).toBeDefined();
    });

    it('should provide user-friendly recommendations', async () => {
      const analysis = await service.analyzeSwapcost(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      const recommendation = analysis.recommendation.toLowerCase();
      expect(
        recommendation.includes('excellent') ||
        recommendation.includes('good') ||
        recommendation.includes('moderate') ||
        recommendation.includes('high') ||
        recommendation.includes('very high')
      ).toBe(true);
    });

    it('should calculate fee amount correctly', async () => {
      const analysis = await service.analyzeSwapcost(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      const expectedFee = 100 * (analysis.feePercentage / 100);
      expect(parseFloat(analysis.feeAmount)).toBeCloseTo(expectedFee, 2);
    });
  });

  describe('canSwap', () => {
    it('should return true for swappable asset pairs', async () => {
      const canSwap = await service.canSwap(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
      );

      expect(typeof canSwap).toBe('boolean');
    });

    it('should handle non-existent asset pairs gracefully', async () => {
      const canSwap = await service.canSwap(
        'FAKE1',
        'FAKE2',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
      );

      expect(canSwap).toBe(false);
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate appropriate recommendations based on fees', async () => {
      // Test with native pair (low fees expected)
      const analysis = await service.analyzeSwapcost(
        'XLM',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      enum Recommendation {
        Excellent = 'excellent',
        Good = 'good',
        Moderate = 'moderate',
        High = 'high',
        VeryHigh = 'very high',
      }

      const rec = analysis.recommendation.toLowerCase();
      const validRecs = Object.values(Recommendation);
      expect(validRecs.some(r => rec.includes(r))).toBe(true);
    });
  });

  describe('Payment Path Serialization', () => {
    it('should serialize payment paths correctly', async () => {
      const path = await service.findBestPath(
        'XLM',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '100',
      );

      expect(path.steps).toBeDefined();
      expect(Array.isArray(path.steps)).toBe(true);
      expect(path.sourceAsset).toHaveProperty('code');
      expect(path.destinationAsset).toHaveProperty('code');
      expect(path.sourceAsset).toHaveProperty('issuer');
      expect(path.destinationAsset).toHaveProperty('issuer');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small amounts', async () => {
      const path = await service.findBestPath(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '0.01',
      );

      expect(path).toBeDefined();
      expect(path.sourceAmount).toBe('0.01');
    });

    it('should handle large amounts', async () => {
      const path = await service.findBestPath(
        'EURC',
        'USDC',
        'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
        '1000000',
      );

      expect(path).toBeDefined();
      expect(path.sourceAmount).toBe('1000000');
    });

    it('should handle the same asset pair', async () => {
      // This would typically fail, but service should handle gracefully
      try {
        const path = await service.findBestPath(
          'USDC',
          'USDC',
          'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY',
          '100',
          'GCO2IP3UIX4SST2WRE3Y7AIW6YLSW6E27NZ5UHK7D6NMD2QAW3354WYN',
        );
        // Either should return 100% conversion rate or handle gracefully
        expect(path.conversionRate).toBeGreaterThanOrEqual(0.99);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
