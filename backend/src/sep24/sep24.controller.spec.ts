import { Test, TestingModule } from '@nestjs/testing';
import { Sep24Controller } from './sep24.controller';
import { Sep24Service } from './sep24.service';

describe('Sep24Controller', () => {
  let controller: Sep24Controller;
  let service: Sep24Service;

  const mockSep24Service = {
    initiateDeposit: jest.fn(),
    getDepositStatus: jest.fn(),
    handleAnchorCallback: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Sep24Controller],
      providers: [
        {
          provide: Sep24Service,
          useValue: mockSep24Service,
        },
      ],
    }).compile();

    controller = module.get<Sep24Controller>(Sep24Controller);
    service = module.get<Sep24Service>(Sep24Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeposit', () => {
    it('should initiate a deposit', async () => {
      const dto = {
        walletAddress: 'GTEST123',
        assetCode: 'USDC',
        amount: 100,
      };

      const expectedResult = {
        id: 'deposit123',
        interactiveUrl: 'https://anchor.com/deposit',
        status: 'pending_user_transfer_start',
      };

      mockSep24Service.initiateDeposit.mockResolvedValue(expectedResult);

      const result = await controller.initiateDeposit(dto);

      expect(result).toEqual(expectedResult);
      expect(mockSep24Service.initiateDeposit).toHaveBeenCalledWith(dto);
    });
  });

  describe('getDepositStatus', () => {
    it('should return deposit status', async () => {
      const depositId = 'deposit123';
      const expectedStatus = {
        id: depositId,
        status: 'completed',
        amount: 100,
        assetCode: 'USDC',
        stellarTransactionId: 'stellar123',
      };

      mockSep24Service.getDepositStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getDepositStatus(depositId);

      expect(result).toEqual(expectedStatus);
      expect(mockSep24Service.getDepositStatus).toHaveBeenCalledWith(depositId);
    });
  });

  describe('handleCallback', () => {
    it('should handle anchor callback', async () => {
      const dto = {
        transaction: {
          id: 'anchor123',
          status: 'completed',
          stellar_transaction_id: 'stellar123',
        },
      };

      mockSep24Service.handleAnchorCallback.mockResolvedValue(undefined);

      const result = await controller.handleCallback(dto);

      expect(result).toEqual({ success: true });
      expect(mockSep24Service.handleAnchorCallback).toHaveBeenCalledWith(
        'anchor123',
        'completed',
        dto.transaction,
      );
    });
  });
});
