import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis/redis.service';

export interface LeaderboardEntry {
  userId: string;
  walletAddress: string;
  totalInvested: number;
  rank: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly CACHE_KEY = 'leaderboard:top_investors';
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MASSIVE_INVESTMENT_THRESHOLD = 10000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get the current leaderboard from cache
   */
  async getTopInvestors(limit: number = 100): Promise<LeaderboardEntry[]> {
    const cached = await this.redis.get<LeaderboardEntry[]>(this.CACHE_KEY);
    if (cached) {
      this.logger.debug('Leaderboard cache hit');
      return cached.slice(0, limit);
    }

    this.logger.log('Leaderboard cache miss, refreshing...');
    const leaderboard = await this.refreshTopInvestorsCache();
    return leaderboard.slice(0, limit);
  }

  /**
   * Refresh the leaderboard cache by querying the database
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshTopInvestorsCache(): Promise<LeaderboardEntry[]> {
    this.logger.log('Refreshing top investors leaderboard cache...');

    try {
      const topInvestors = await this.prisma.investmentIntent.groupBy({
        by: ['investorId'],
        where: {
          status: 'APPROVED', // Assuming APPROVED/EXECUTED means a successful investment
        },
        _sum: {
          investmentAmount: true,
        },
        orderBy: {
          _sum: {
            investmentAmount: 'desc',
          },
        },
        take: 1000, // Cache top 1000 investors for scalability
      });

      // Fetch user details for the top investors
      const userIds = topInvestors.map((ti) => ti.investorId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, walletAddress: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u.walletAddress]));

      const leaderboard: LeaderboardEntry[] = topInvestors.map((ti, index) => ({
        userId: ti.investorId,
        walletAddress: userMap.get(ti.investorId) || 'Unknown',
        totalInvested: Number(ti._sum.investmentAmount || 0),
        rank: index + 1,
      }));

      await this.redis.set(this.CACHE_KEY, leaderboard, this.CACHE_TTL);
      this.logger.log(`Leaderboard cache updated with ${leaderboard.length} entries`);
      
      return leaderboard;
    } catch (error) {
      this.logger.error('Failed to refresh leaderboard cache:', error);
      return [];
    }
  }

  /**
   * Handle on-demand refresh for massive investments
   */
  async handleMassiveInvestment(amount: number): Promise<void> {
    if (amount >= this.MASSIVE_INVESTMENT_THRESHOLD) {
      this.logger.log(`Massive investment of ${amount} detected. Triggering immediate leaderboard refresh.`);
      // Run in background to not block the current transaction
      this.refreshTopInvestorsCache().catch(err => {
        this.logger.error('Background leaderboard refresh failed:', err);
      });
    }
  }
}
