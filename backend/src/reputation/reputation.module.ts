import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReputationActivity } from './reputation-activity.entity';
import { ReputationScore } from './reputation-score.entity';
import { ReputationService } from './reputation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReputationActivity, ReputationScore])],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}