import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma.service';

export interface YieldSnapshotPoint {
  snapshotDate: string;
  apy: string;
  dailyYield: string;
  totalPrincipal: string;
  asset?: string | null;
}

export interface YieldTrend {
  last7Days: YieldSnapshotPoint[];
  last30Days: YieldSnapshotPoint[];
  last90Days: YieldSnapshotPoint[];
}

@Injectable()
export class YieldSnapshotService {
  private readonly logger = new Logger(YieldSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncDailySnapshots(): Promise<void> {
    const snapshotDate = this.startOfUtcDay(new Date());
    this.logger.log(`Starting daily yield snapshot sync for ${snapshotDate.toISOString()}`);

    try {
      await this.createDailySnapshots(snapshotDate);
      this.logger.log(`Daily yield snapshot sync completed for ${snapshotDate.toISOString()}`);
    } catch (error) {
      this.logger.error(`Failed to sync daily yield snapshots: ${error.message}`, error.stack);
    }
  }

  async getProjectYieldHistory(projectId: string, days = 90): Promise<YieldSnapshotPoint[]> {
    const rows = await this.prisma.yieldSnapshot.findMany({
      where: { projectId },
      orderBy: { snapshotDate: 'desc' },
      take: days,
    });

    return rows
      .map((row) => ({
        snapshotDate: row.snapshotDate.toISOString(),
        apy: row.apy.toString(),
        dailyYield: row.dailyYield.toString(),
        totalPrincipal: row.totalPrincipal.toString(),
        asset: row.asset ?? null,
      }))
      .reverse();
  }

  async getProjectYieldTrends(projectId: string): Promise<YieldTrend> {
    const snapshots = await this.getProjectYieldHistory(projectId, 90);

    return {
      last7Days: snapshots.slice(-7),
      last30Days: snapshots.slice(-30),
      last90Days: snapshots,
    };
  }

  private async createDailySnapshots(snapshotDate: Date): Promise<void> {
    const windowStart = new Date(snapshotDate.getTime() - 24 * 60 * 60 * 1000);

    const [projects, yieldRows] = await Promise.all([
      this.prisma.project.findMany({
        where: { currentFunds: { gt: 0n } },
        select: {
          id: true,
          contractId: true,
          currentFunds: true,
          tokenAddress: true,
        },
      }),
      this.prisma.yieldEvent.groupBy({
        by: ['escrowId', 'asset'],
        where: {
          createdAt: {
            gte: windowStart,
            lt: snapshotDate,
          },
          isActive: true,
        },
        _sum: { amount: true },
      }),
    ]);

    if (projects.length === 0) {
      this.logger.log('No active yield-bearing projects found for snapshot sync');
      return;
    }

    const yieldByEscrow = new Map<string, { amount: bigint; asset?: string }>();

    for (const row of yieldRows) {
      const amount = row._sum.amount ?? 0n;
      const existing = yieldByEscrow.get(row.escrowId);
      if (!existing) {
        yieldByEscrow.set(row.escrowId, { amount, asset: row.asset ?? undefined });
        continue;
      }

      existing.amount += amount;
      if (!existing.asset && row.asset) {
        existing.asset = row.asset;
      }
    }

    for (const project of projects) {
      const yieldData = yieldByEscrow.get(project.contractId);
      const dailyYield = yieldData?.amount ?? 0n;
      const asset = yieldData?.asset ?? project.tokenAddress ?? 'native';
      const apy = this.calculateApy(dailyYield, project.currentFunds);

      // TODO: Implement yieldSnapshot model in Prisma schema
      await this.prisma.yieldSnapshot.upsert({
        where: {
          projectId_snapshotDate: {
            projectId: project.id,
            snapshotDate,
          },
        },
        create: {
          projectId: project.id,
          escrowId: project.contractId,
          snapshotDate,
          dailyYield,
          totalPrincipal: project.currentFunds,
          apy: apy as any,
          asset,
        },
        update: {
          escrowId: project.contractId,
          dailyYield,
          totalPrincipal: project.currentFunds,
          apy: apy as any,
          asset,
        },
      });
      this.logger.log(`Yield snapshot for project ${project.id} created/updated`);
    }
  }

  private calculateApy(dailyYield: bigint, totalPrincipal: bigint): Decimal {
    if (totalPrincipal === 0n) {
      return new Decimal(0);
    }

    return new Decimal(dailyYield.toString())
      .div(new Decimal(totalPrincipal.toString()))
      .times(36500)
      .toDecimalPlaces(6);
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
