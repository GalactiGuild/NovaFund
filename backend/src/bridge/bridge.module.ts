import { Module } from '@nestjs/common';
import { BridgeController } from './bridge.controller';
import { BridgeService } from './bridge.service';
import { BridgePollTask } from './tasks/bridge-poll.task';
import { DatabaseModule } from '../database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BridgeController],
  providers: [BridgeService, BridgePollTask],
  exports: [BridgeService],
})
export class BridgeModule {}
