import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class DeadlineAlertTask {
    private readonly logger = new Logger(DeadlineAlertTask.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    // Run every hour
    @Cron(CronExpression.EVERY_HOUR)
    async handleCron() {
        this.logger.debug('Checking for projects nearing their deadline...');

        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find active projects ending between now and 24 hours from now
        const projects = await this.prisma.project.findMany({
            where: {
                status: 'ACTIVE',
                deadline: {
                    gt: now,
                    lte: twentyFourHoursFromNow,
                },
            },
            include: {
                contributions: {
                    select: { investorId: true },
                    distinct: ['investorId'],
                },
            },
        });

        for (const project of projects) {
            // Check if we've already sent a 24h warning for this project today to avoid spamming
            // We assume one notification per project for this specific alert
            const existingAlert = await this.prisma.notification.findFirst({
                where: {
                    type: 'DEADLINE',
                    title: `24 Hours Left: ${project.title}`,
                }
            });

            if (existingAlert) {
                continue;
            }

            this.logger.log(`Project ${project.id} is ending in < 24 hours. Notifying contributors.`);

            for (const contribution of project.contributions) {
                try {
                    await this.notificationService.notify(
                        contribution.investorId,
                        'DEADLINE',
                        `24 Hours Left: ${project.title}`,
                        `Only 24 hours left for project ${project.title} to reach its goal.`,
                        { projectId: project.id }
                    );
                } catch (e) {
                    this.logger.error(`Failed to notify user ${contribution.investorId} of deadline: ${e.message}`);
                }
            }
        }
    }
}
