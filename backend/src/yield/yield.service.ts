import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { YieldStats } from './dto/yield-stats.dto';

@Injectable()
export class YieldService {
  constructor(private readonly prisma: PrismaService) {}

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
}
