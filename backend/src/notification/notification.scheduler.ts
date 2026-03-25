import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from './services/notification.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Processes PENDING emails in the EmailOutbox every minute.
   * Retries up to 3 times before marking as FAILED.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processEmailOutbox(): Promise<void> {
    this.logger.debug('Flushing email outbox...');
    await this.notificationService.flushEmailOutbox();
  }
}
