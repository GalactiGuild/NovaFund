import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { YieldService } from './yield.service';
import { YieldResolver } from './yield.resolver';
import { WaterfallEngineService } from './waterfall-engine.service';

@Module({
  imports: [DatabaseModule],
  providers: [YieldService, YieldResolver, WaterfallEngineService],
})
export class YieldModule {}
