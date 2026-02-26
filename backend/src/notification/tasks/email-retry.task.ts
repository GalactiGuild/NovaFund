import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailRetryTask {
    private readonly logger = new Logger(EmailRetryTask.name);
    private readonly MAX_ATTEMPTS = 3;

    constructor(private readonly prisma: PrismaService) { }

    // Run every 5 minutes
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleCron() {
        this.logger.debug('Checking email outbox for failed messages...');

        const failedEmails = await this.prisma.emailOutbox.findMany({
            where: {
                status: 'FAILED',
                attempts: {
                    lt: this.MAX_ATTEMPTS,
                }
            },
            take: 50, // Process in batches
        });

        for (const email of failedEmails) {
            try {
                if (!process.env.SENDGRID_API_KEY) {
                    this.logger.warn('SENDGRID_API_KEY not set during retry. Skipping.');
                    return;
                }
                this.logger.log(`Retrying email to ${email.to} (attempt ${email.attempts + 1}/${this.MAX_ATTEMPTS})`);

                const msg = {
                    to: email.to,
                    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@novafund.xyz',
                    subject: email.subject,
                    html: email.html,
                };

                await sgMail.send(msg);

                // Mark as sent
                await this.prisma.emailOutbox.update({
                    where: { id: email.id },
                    data: {
                        status: 'SENT',
                        attempts: email.attempts + 1,
                    },
                });

                this.logger.log(`Successfully sent retried email to ${email.to}`);
            } catch (error) {
                this.logger.error(`Retry failed for email ${email.id}: ${error.message}`);

                // Update attempts
                await this.prisma.emailOutbox.update({
                    where: { id: email.id },
                    data: {
                        attempts: email.attempts + 1,
                        lastError: error.message,
                    },
                });
            }
        }
    }
}
