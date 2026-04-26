import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationService } from './reputation.service';
import { LeaderboardService } from './leaderboard.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  providers: [ReputationService, LeaderboardService],
  exports: [ReputationService, LeaderboardService],
})
export class ReputationModule {}
