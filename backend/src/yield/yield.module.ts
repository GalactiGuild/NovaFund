import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database.module';
import { YieldService } from './yield.service';
import { YieldResolver } from './yield.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [YieldService, YieldResolver],
})
export class YieldModule {}
