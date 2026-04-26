import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { YieldStats } from './dto/yield-stats.dto';
import {
  WaterfallEngineService,
  WaterfallRecipient,
  WaterfallTierRule,
} from './waterfall-engine.service';

export interface UpsertWaterfallTierInput {
  tierOrder: number;
  recipientType: WaterfallRecipient;
  maxAmount: string | null;
}

@Injectable()
export class YieldService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly waterfallEngine: WaterfallEngineService,
  ) {}

  async getAggregatedYield(): Promise<YieldStats> {
    const result = await this.prisma.yieldEvent.aggregate({
      where: { isActive: true },
      _sum: { amount: true },
      _count: { escrowId: true },
    });

    // Count distinct active escrows
    const activeEscrowCount = await this.prisma.yieldEvent.groupBy({
      by: ['escrowId'],
      where: { isActive: true },
    });

    return {
      totalYield: (result._sum.amount ?? BigInt(0)).toString(),
      activeEscrowCount: activeEscrowCount.length,
    };
  }

  async getProjectWaterfall(projectId: string): Promise<WaterfallTierRule[]> {
    const tiers = await (this.prisma as any).projectPayoutTier.findMany({
      where: { projectId },
      orderBy: { tierOrder: 'asc' },
    });

    return tiers.map((tier: any) => ({
      tierOrder: tier.tierOrder,
      recipientType: tier.recipientType,
      maxAmount: tier.maxAmount === null ? null : BigInt(tier.maxAmount),
    }));
  }

  async configureProjectWaterfall(projectId: string, tiers: UpsertWaterfallTierInput[]): Promise<WaterfallTierRule[]> {
    await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });

    const normalized = [...tiers]
      .sort((a, b) => a.tierOrder - b.tierOrder)
      .map((tier) => ({
        tierOrder: tier.tierOrder,
        recipientType: tier.recipientType,
        maxAmount: tier.maxAmount === null ? null : BigInt(tier.maxAmount),
      }));

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).projectPayoutTier.deleteMany({ where: { projectId } });
      await (tx as any).projectPayoutTier.createMany({
        data: normalized.map((tier) => ({
          projectId,
          tierOrder: tier.tierOrder,
          recipientType: tier.recipientType,
          maxAmount: tier.maxAmount,
        })),
      });
    });

    return this.getProjectWaterfall(projectId);
  }

  async simulateProjectWaterfall(projectId: string, payoutAmount: string) {
    const tiers = await this.getProjectWaterfall(projectId);
    const result = this.waterfallEngine.calculatePayout(BigInt(payoutAmount), tiers);

    return {
      payoutAmount,
      allocations: Object.entries(result.allocations).map(([recipientType, amount]) => ({
        recipientType: recipientType as WaterfallRecipient,
        amount: amount.toString(),
      })),
      unallocatedAmount: result.unallocatedAmount.toString(),
    };
  }
}
