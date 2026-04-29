import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database.module';
import { YieldService } from './yield.service';
import { YieldResolver } from './yield.resolver';
import { WaterfallEngineService } from './waterfall-engine.service';
import { YieldSnapshotService } from './yield-snapshot.service';
import { PredictionService } from './prediction.service';
import { AprPredictionController } from './apr-prediction.controller';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot()],
  controllers: [AprPredictionController],
  providers: [YieldService, YieldResolver, WaterfallEngineService, YieldSnapshotService, PredictionService],
  exports: [YieldService, PredictionService],
})
export class YieldModule {}
