import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnchorService } from './anchor.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AnchorService', () => {
  let service: AnchorService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SEP24_ANCHOR_DOMAIN') return 'testanchor.stellar.org';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnchorService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AnchorService>(AnchorService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDepositUrl', () => {
    it('should return interactive deposit URL', async () => {
      const params = {
        asset_code: 'USDC',
        account: 'GTEST123',
        amount: '100',
      };

      const mockToml = 'TRANSFER_SERVER_SEP0024="https://testanchor.stellar.org/sep24"';
      const mockInteractiveUrl = 'https://testanchor.stellar.org/sep24/deposit?token=abc';

      mockedAxios.get.mockResolvedValueOnce({ data: mockToml });
      mockedAxios.post.mockResolvedValueOnce({
        data: { url: mockInteractiveUrl },
      });

      const result = await service.getDepositUrl(params);

      expect(result).toBe(mockInteractiveUrl);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://testanchor.stellar.org/.well-known/stellar.toml',
      );
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const params = {
        asset_code: 'USDC',
        account: 'GTEST123',
      };

      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.getDepositUrl(params)).rejects.toThrow('Network error');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status from anchor', async () => {
      const transactionId = 'anchor123';
      const mockToml = 'TRANSFER_SERVER_SEP0024="https://testanchor.stellar.org/sep24"';
      const mockTransaction = {
        id: transactionId,
        status: 'completed',
        stellar_transaction_id: 'stellar123',
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockToml });
      mockedAxios.get.mockResolvedValueOnce({
        data: { transaction: mockTransaction },
      });

      const result = await service.getTransactionStatus(transactionId);

      expect(result).toEqual(mockTransaction);
    });
  });

  describe('parseToml', () => {
    it('should parse TOML format correctly', () => {
      const tomlString = `
# Comment
TRANSFER_SERVER_SEP0024="https://anchor.com/sep24"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
      `;

      const result = (service as any).parseToml(tomlString);

      expect(result.TRANSFER_SERVER_SEP0024).toBe('https://anchor.com/sep24');
      expect(result.NETWORK_PASSPHRASE).toBe('Test SDF Network ; September 2015');
    });
  });
});
