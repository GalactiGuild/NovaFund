import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';
import { AnchorService } from './anchor.service';
import { InitiateDepositDto, DepositStatusDto } from './dto/sep24.dto';

@Injectable()
export class Sep24Service {
  private readonly logger = new Logger(Sep24Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly anchorService: AnchorService,
  ) {}

  async initiateDeposit(dto: InitiateDepositDto) {
    this.logger.log(`Initiating deposit for wallet ${dto.walletAddress}`);

    // Get interactive URL from anchor
    const interactiveUrl = await this.anchorService.getDepositUrl({
      asset_code: dto.assetCode || 'USDC',
      account: dto.walletAddress,
      amount: dto.amount?.toString(),
      lang: dto.language || 'en',
    });

    // Create deposit record
    const deposit = await this.prisma.fiatDeposit.create({
      data: {
        walletAddress: dto.walletAddress,
        assetCode: dto.assetCode || 'USDC',
        amount: dto.amount,
        status: 'pending_user_transfer_start',
        anchorProvider: dto.anchorProvider || 'moneygram',
        interactiveUrl,
        projectId: dto.projectId,
      },
    });

    // Cache deposit for quick lookup
    await this.redisService.set(
      `sep24:deposit:${deposit.id}`,
      deposit,
      3600, // 1 hour
    );

    return {
      id: deposit.id,
      interactiveUrl,
      status: deposit.status,
    };
  }

  async getDepositStatus(depositId: string): Promise<DepositStatusDto> {
    // Try cache first
    const cached = await this.redisService.get(`sep24:deposit:${depositId}`);
    if (cached) {
      return cached as DepositStatusDto;
    }

    // Fetch from database
    const deposit = await this.prisma.fiatDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new BadRequestException('Deposit not found');
    }

    // Check status with anchor
    if (deposit.anchorTransactionId) {
      const anchorStatus = await this.anchorService.getTransactionStatus(
        deposit.anchorTransactionId,
      );

      // Update if status changed
      if (anchorStatus.status !== deposit.status) {
        await this.updateDepositStatus(depositId, anchorStatus.status, anchorStatus);
      }

      return {
        id: deposit.id,
        status: anchorStatus.status,
        amount: deposit.amount,
        assetCode: deposit.assetCode,
        stellarTransactionId: anchorStatus.stellar_transaction_id,
        message: anchorStatus.message,
      };
    }

    return {
      id: deposit.id,
      status: deposit.status,
      amount: deposit.amount,
      assetCode: deposit.assetCode,
    };
  }

  async updateDepositStatus(depositId: string, status: string, anchorData?: any) {
    const deposit = await this.prisma.fiatDeposit.update({
      where: { id: depositId },
      data: {
        status,
        stellarTransactionId: anchorData?.stellar_transaction_id,
        anchorTransactionId: anchorData?.id,
        completedAt: status === 'completed' ? new Date() : undefined,
      },
    });

    // Update cache
    await this.redisService.set(`sep24:deposit:${depositId}`, deposit, 3600);

    // Invalidate related caches
    if (deposit.projectId) {
      await this.redisService.del(`project:${deposit.projectId}`);
    }

    return deposit;
  }

  async handleAnchorCallback(transactionId: string, status: string, data: any) {
    this.logger.log(`Anchor callback for transaction ${transactionId}: ${status}`);

    const deposit = await this.prisma.fiatDeposit.findFirst({
      where: { anchorTransactionId: transactionId },
    });

    if (!deposit) {
      this.logger.warn(`Deposit not found for anchor transaction ${transactionId}`);
      return;
    }

    await this.updateDepositStatus(deposit.id, status, data);
  }
}
