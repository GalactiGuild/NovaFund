import { Test, TestingModule } from '@nestjs/testing';
import { Sep24Service } from './sep24.service';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnchorService } from './anchor.service';
import { BadRequestException } from '@nestjs/common';

describe('Sep24Service', () => {
  let service: Sep24Service;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let anchorService: AnchorService;

  const mockPrismaService = {
    fiatDeposit: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockAnchorService = {
    getDepositUrl: jest.fn(),
    getTransactionStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Sep24Service,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: AnchorService,
          useValue: mockAnchorService,
        },
      ],
    }).compile();

    service = module.get<Sep24Service>(Sep24Service);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    anchorService = module.get<AnchorService>(AnchorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateDeposit', () => {
    it('should create a deposit and return interactive URL', async () => {
      const dto = {
        walletAddress: 'GTEST123',
        assetCode: 'USDC',
        amount: 100,
      };

      const mockInteractiveUrl = 'https://anchor.com/deposit?token=abc';
      const mockDeposit = {
        id: 'deposit123',
        walletAddress: dto.walletAddress,
        assetCode: dto.assetCode,
        amount: dto.amount,
        status: 'pending_user_transfer_start',
        anchorProvider: 'moneygram',
        interactiveUrl: mockInteractiveUrl,
        projectId: null,
      };

      mockAnchorService.getDepositUrl.mockResolvedValue(mockInteractiveUrl);
      mockPrismaService.fiatDeposit.create.mockResolvedValue(mockDeposit);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.initiateDeposit(dto);

      expect(result).toEqual({
        id: 'deposit123',
        interactiveUrl: mockInteractiveUrl,
        status: 'pending_user_transfer_start',
      });
      expect(mockAnchorService.getDepositUrl).toHaveBeenCalledWith({
        asset_code: 'USDC',
        account: dto.walletAddress,
        amount: '100',
        lang: 'en',
      });
      expect(mockPrismaService.fiatDeposit.create).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('getDepositStatus', () => {
    it('should return cached status if available', async () => {
      const depositId = 'deposit123';
      const cachedStatus = {
        id: depositId,
        status: 'completed',
        amount: 100,
        assetCode: 'USDC',
      };

      mockRedisService.get.mockResolvedValue(cachedStatus);

      const result = await service.getDepositStatus(depositId);

      expect(result).toEqual(cachedStatus);
      expect(mockRedisService.get).toHaveBeenCalledWith(`sep24:deposit:${depositId}`);
      expect(mockPrismaService.fiatDeposit.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      const depositId = 'deposit123';
      const mockDeposit = {
        id: depositId,
        walletAddress: 'GTEST123',
        assetCode: 'USDC',
        amount: 100,
        status: 'pending_anchor',
        anchorTransactionId: 'anchor123',
        stellarTransactionId: null,
        projectId: null,
      };

      const mockAnchorStatus = {
        id: 'anchor123',
        status: 'completed',
        stellar_transaction_id: 'stellar123',
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.fiatDeposit.findUnique.mockResolvedValue(mockDeposit);
      mockAnchorService.getTransactionStatus.mockResolvedValue(mockAnchorStatus);
      mockPrismaService.fiatDeposit.update.mockResolvedValue({
        ...mockDeposit,
        status: 'completed',
      });

      const result = await service.getDepositStatus(depositId);

      expect(result.status).toBe('completed');
      expect(mockPrismaService.fiatDeposit.findUnique).toHaveBeenCalledWith({
        where: { id: depositId },
      });
    });

    it('should throw error if deposit not found', async () => {
      const depositId = 'nonexistent';

      mockRedisService.get.mockResolvedValue(null);
      mockPrismaService.fiatDeposit.findUnique.mockResolvedValue(null);

      await expect(service.getDepositStatus(depositId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateDepositStatus', () => {
    it('should update deposit status and cache', async () => {
      const depositId = 'deposit123';
      const newStatus = 'completed';
      const anchorData = {
        id: 'anchor123',
        stellar_transaction_id: 'stellar123',
      };

      const updatedDeposit = {
        id: depositId,
        status: newStatus,
        stellarTransactionId: 'stellar123',
        anchorTransactionId: 'anchor123',
        projectId: null,
      };

      mockPrismaService.fiatDeposit.update.mockResolvedValue(updatedDeposit);
      mockRedisService.set.mockResolvedValue(undefined);
      mockRedisService.del.mockResolvedValue(undefined);

      const result = await service.updateDepositStatus(depositId, newStatus, anchorData);

      expect(result).toEqual(updatedDeposit);
      expect(mockPrismaService.fiatDeposit.update).toHaveBeenCalledWith({
        where: { id: depositId },
        data: expect.objectContaining({
          status: newStatus,
          stellarTransactionId: 'stellar123',
          anchorTransactionId: 'anchor123',
        }),
      });
      expect(mockRedisService.set).toHaveBeenCalled();
    });
  });

  describe('handleAnchorCallback', () => {
    it('should update deposit status on callback', async () => {
      const transactionId = 'anchor123';
      const status = 'completed';
      const data = { stellar_transaction_id: 'stellar123' };

      const mockDeposit = {
        id: 'deposit123',
        anchorTransactionId: transactionId,
      };

      mockPrismaService.fiatDeposit.findFirst.mockResolvedValue(mockDeposit);
      mockPrismaService.fiatDeposit.update.mockResolvedValue({
        ...mockDeposit,
        status,
      });
      mockRedisService.set.mockResolvedValue(undefined);

      await service.handleAnchorCallback(transactionId, status, data);

      expect(mockPrismaService.fiatDeposit.findFirst).toHaveBeenCalledWith({
        where: { anchorTransactionId: transactionId },
      });
    });

    it('should handle callback for non-existent deposit', async () => {
      const transactionId = 'nonexistent';

      mockPrismaService.fiatDeposit.findFirst.mockResolvedValue(null);

      await expect(
        service.handleAnchorCallback(transactionId, 'completed', {}),
      ).resolves.not.toThrow();
    });
  });
});
