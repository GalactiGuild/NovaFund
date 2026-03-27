import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Sep24Service } from '../sep24.service';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DepositPollTask {
  private readonly logger = new Logger(DepositPollTask.name);

  constructor(
    private readonly sep24Service: Sep24Service,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async pollPendingDeposits() {
    try {
      // Find deposits that are pending and not completed
      const pendingDeposits = await this.prisma.fiatDeposit.findMany({
        where: {
          status: {
            notIn: ['completed', 'error', 'incomplete'],
          },
          anchorTransactionId: {
            not: null,
          },
          createdAt: {
            // Only poll deposits from last 24 hours
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        take: 50, // Limit to avoid overload
      });

      if (pendingDeposits.length === 0) {
        return;
      }

      this.logger.log(`Polling ${pendingDeposits.length} pending deposits`);

      // Poll each deposit status
      await Promise.allSettled(
        pendingDeposits.map(async (deposit) => {
          try {
            await this.sep24Service.getDepositStatus(deposit.id);
          } catch (error) {
            this.logger.error(
              `Failed to poll deposit ${deposit.id}: ${error.message}`,
            );
          }
        }),
      );
    } catch (error) {
      this.logger.error(`Deposit poll task failed: ${error.message}`);
    }
  }
}
