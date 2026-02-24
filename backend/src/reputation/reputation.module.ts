import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { ReputationService } from './reputation.service';

@Module({
  imports: [DatabaseModule],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}