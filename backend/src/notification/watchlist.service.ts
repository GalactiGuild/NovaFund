import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { NotificationService } from './services/notification.service';

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async addToWatchlist(userId: string, projectId: string): Promise<void> {
    await this.prisma.watchlist.create({
      data: { userId, projectId },
    });
    this.logger.log(`User ${userId} added project ${projectId} to watchlist`);
  }

  async removeFromWatchlist(userId: string, projectId: string): Promise<void> {
    await this.prisma.watchlist.deleteMany({
      where: { userId, projectId },
    });
    this.logger.log(`User ${userId} removed project ${projectId} from watchlist`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkWatchedProjects(): Promise<void> {
    this.logger.debug('Checking watched projects for 80% funding threshold...');

    const projects = await this.prisma.project.findMany({
      where: { status: 'ACTIVE' },
      include: { watchlists: true },
    });

    for (const project of projects) {
      const fundingPercentage = Number((project.currentFunds * 100n) / project.goal);

      if (fundingPercentage >= 80 && project.watchlists.length > 0) {
        for (const watchlist of project.watchlists) {
          const alreadyNotified = await this.prisma.notification.findFirst({
            where: {
              userId: watchlist.userId,
              type: 'SYSTEM',
              title: `${project.title} is 80% funded!`,
            },
          });

          if (!alreadyNotified) {
            await this.notificationService.notify(
              watchlist.userId,
              'SYSTEM',
              `${project.title} is 80% funded!`,
              `The project "${project.title}" you're watching has reached 80% of its funding goal. Don't miss out!`,
              { projectId: project.id },
            );
          }
        }
      }
    }
  }
}
