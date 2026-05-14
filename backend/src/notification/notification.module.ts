import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './services/notification.service';
import { EmailService } from './services/email.service';
import { WebPushService } from './services/web-push.service';
import { PreferencesService } from './services/preferences.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationGatewayController } from './notification-gateway.controller';
import { DeadlineAlertTask } from './tasks/deadline-alert.task';
import { EmailRetryTask } from './tasks/email-retry.task';
import { WeeklyDigestJob } from './tasks/weekly-digest.job';
import { WatchlistService } from './watchlist.service';
import { DiscordBotService } from './discord-bot.service';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [NotificationController, NotificationGatewayController],
  providers: [
    NotificationService,
    NotificationGateway,
    EmailService,
    WebPushService,
    PreferencesService,
    DeadlineAlertTask,
    EmailRetryTask,
    WeeklyDigestJob,
    WatchlistService,
    DiscordBotService,
  ],
  exports: [NotificationService, NotificationGateway, PreferencesService, WatchlistService, DiscordBotService],
})
export class NotificationModule { }
