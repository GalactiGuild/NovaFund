import { Injectable, Logger } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(private readonly prisma: PrismaService) {
        // Note: Provide SENDGRID_API_KEY in .env
        sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    }

    async sendEmail(to: string, subject: string, html: string): Promise<void> {
        try {
            if (!process.env.SENDGRID_API_KEY) {
                this.logger.warn('SENDGRID_API_KEY not set. Email not sent.');
                return;
            }

            const msg = {
                to,
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@novafund.xyz',
                subject,
                html,
            };

            await sgMail.send(msg);
            this.logger.log(`Email sent to ${to}: ${subject}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}: ${error.message}`);

            // Store in outbox for retry
            await this.prisma.emailOutbox.create({
                data: {
                    to,
                    subject,
                    html,
                    status: 'FAILED',
                    lastError: error.message,
                },
            });
            throw error;
        }
    }
}
