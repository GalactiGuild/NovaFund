import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface HorizonFeePayload {
  fee_charged?: string | number;
  hash?: string;
  ledger?: number;
}

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordHorizonFee(source: string, payload: HorizonFeePayload): Promise<void> {
    if (payload.fee_charged === undefined || payload.fee_charged === null) {
      return;
    }

    const feeCharged = BigInt(payload.fee_charged);
    const dayStart = this.startOfUtcDay(new Date());

    try {
      await this.prisma.$transaction(async (tx: any) => {
        await tx.operationalCostEvent.create({
          data: {
            txHash: payload.hash,
            source,
            feeCharged,
            ledger: payload.ledger,
            capturedAt: new Date(),
          },
        });

        await tx.operationalCost.upsert({
          where: { date: dayStart },
          create: {
            date: dayStart,
            totalFeeCharged: feeCharged,
            eventCount: 1,
          },
          update: {
            totalFeeCharged: { increment: feeCharged },
            eventCount: { increment: 1 },
          },
        });
      });
    } catch (error) {
      this.logger.warn(`Failed to persist operational cost event: ${error.message}`);
    }
  }

  async getMonthlyBreakdown(year: number, month: number) {
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const nextMonth = new Date(Date.UTC(year, month, 1));

    const rows = await (this.prisma as any).operationalCost.findMany({
      where: {
        date: {
          gte: firstDay,
          lt: nextMonth,
        },
      },
      orderBy: { date: 'asc' },
    });

    const totalFeeCharged = rows.reduce((sum: bigint, row: any) => sum + BigInt(row.totalFeeCharged), 0n);
    const totalEvents = rows.reduce((sum: number, row: any) => sum + row.eventCount, 0);

    return {
      year,
      month,
      totalFeeCharged: totalFeeCharged.toString(),
      totalEvents,
      days: rows.map((row: any) => ({
        date: row.date.toISOString(),
        totalFeeCharged: row.totalFeeCharged.toString(),
        eventCount: row.eventCount,
      })),
    };
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
