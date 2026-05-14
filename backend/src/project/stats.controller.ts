import { Controller, Get, Param, Query } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

interface DailyBucket {
  date: string;
  investments: number;
  milestones: number;
  refunds: number;
}

@Controller('projects')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /projects/:id/stats
   * Returns pre-aggregated daily counts of Investments, Milestones, and Refunds
   * for the given project, enabling snappier frontend charts.
   */
  @Get(':id/stats')
  async getProjectStats(
    @Param('id') id: string,
    @Query('days') days = '30',
  ): Promise<{ projectId: string; days: number; data: DailyBucket[] }> {
    const numDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
    const since = new Date();
    since.setDate(since.getDate() - numDays);

    const [investments, milestones, refunds] = await Promise.all([
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
        FROM "Investment"
        WHERE "projectId" = ${id} AND "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("completedAt")::text AS date, COUNT(*)::bigint AS count
        FROM "Milestone"
        WHERE "projectId" = ${id} AND "completedAt" >= ${since}
        GROUP BY DATE("completedAt")
        ORDER BY date ASC
      `,
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
        SELECT DATE("createdAt")::text AS date, COUNT(*)::bigint AS count
        FROM "Refund"
        WHERE "projectId" = ${id} AND "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Build a unified date map
    const buckets = new Map<string, DailyBucket>();
    const toMap = (rows: { date: string; count: bigint }[], field: keyof DailyBucket) => {
      for (const row of rows) {
        if (!buckets.has(row.date)) {
          buckets.set(row.date, { date: row.date, investments: 0, milestones: 0, refunds: 0 });
        }
        (buckets.get(row.date) as any)[field] = Number(row.count);
      }
    };

    toMap(investments, 'investments');
    toMap(milestones, 'milestones');
    toMap(refunds, 'refunds');

    const data = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));

    return { projectId: id, days: numDays, data };
  }
}
