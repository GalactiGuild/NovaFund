import { Test, TestingModule } from '@nestjs/testing';
import { ReservesService } from './reserves.service';
import { StellarService } from './stellar.service';
import { PriceOracleService } from '../oracle/price-oracle.service';
import { ConfigService } from '@nestjs/config';

describe('ReservesService', () => {
  let service: ReservesService;
  let stellarService: jest.Mocked<StellarService>;
  let priceOracle: jest.Mocked<PriceOracleService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockStellarService = {
      getBalances: jest.fn(),
      executeSwap: jest.fn(),
    };

    const mockPriceOracle = {
      getLatestPrice: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservesService,
        { provide: StellarService, useValue: mockStellarService },
        { provide: PriceOracleService, useValue: mockPriceOracle },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ReservesService>(ReservesService);
    stellarService = module.get(StellarService);
    priceOracle = module.get(PriceOracleService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should rebalance when deviation exceeds threshold', async () => {
    // Setup config
    configService.get.mockImplementation((key) => {
      if (key === 'stellar.treasury') {
        return {
          rebalanceThreshold: 0.05,
          wallets: [
            { assetCode: 'XLM', targetRatio: 0.5, walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY' },
            { assetCode: 'USDC', targetRatio: 0.5, walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY' },
          ],
        };
      }
      return null;
    });

    // Setup balances (total $200, 75% XLM, 25% USDC -> needs rebalance)
    stellarService.getBalances.mockResolvedValue([
      { asset_type: 'native', balance: '1500' } as any, // 1500 XLM @ $0.1 = $150
      { asset_code: 'USDC', asset_issuer: 'ISSUER', balance: '50' } as any, // 50 USDC @ $1 = $50
    ]);

    // Setup prices
    priceOracle.getLatestPrice.mockImplementation(async (symbol) => {
      if (symbol === 'XLM') return { price: 0.1 } as any;
      if (symbol === 'USDC') return { price: 1.0 } as any;
      return null;
    });

    await service.checkAndRebalance();

    // Should swap XLM for USDC
    // Target is $100 each. Current is $150 XLM, $50 USDC.
    // Need to swap $50 worth of XLM for USDC.
    // $50 / 0.1 = 500 XLM.
    expect(stellarService.executeSwap).toHaveBeenCalled();
    const [sourceAsset, destAsset, amount] = stellarService.executeSwap.mock.calls[0];
    expect(sourceAsset.code).toBe('XLM');
    expect(destAsset.code).toBe('USDC');
    expect(parseFloat(amount)).toBeCloseTo(500);
  });

  it('should not rebalance when within threshold', async () => {
    configService.get.mockReturnValue({
      rebalanceThreshold: 0.05,
      wallets: [
        { assetCode: 'XLM', targetRatio: 0.5, walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY' },
        { assetCode: 'USDC', targetRatio: 0.5, walletAddress: 'GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTLXASMSTQUCHP7DTLD5QPS3LY' },
      ],
    });

    stellarService.getBalances.mockResolvedValue([
      { asset_type: 'native', balance: '1020' } as any, // $102
      { asset_code: 'USDC', asset_issuer: 'ISSUER', balance: '98' } as any, // $98
    ]);

    priceOracle.getLatestPrice.mockImplementation(async (symbol) => {
      if (symbol === 'XLM') return { price: 0.1 } as any;
      if (symbol === 'USDC') return { price: 1.0 } as any;
      return null;
    });

    await service.checkAndRebalance();

    expect(stellarService.executeSwap).not.toHaveBeenCalled();
  });
});
