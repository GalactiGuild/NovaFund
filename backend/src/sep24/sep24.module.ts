import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { Sep24Controller } from './sep24.controller';
import { Sep24Service } from './sep24.service';
import { AnchorService } from './anchor.service';
import { DepositPollTask } from './tasks/deposit-poll.task';
import { DatabaseModule } from '../database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule, ScheduleModule.forRoot()],
  controllers: [Sep24Controller],
  providers: [Sep24Service, AnchorService, DepositPollTask],
  exports: [Sep24Service],
})
export class Sep24Module {}
