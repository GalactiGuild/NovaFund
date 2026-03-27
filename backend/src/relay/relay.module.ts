import { Module } from '@nestjs/common';
import { RelayService } from './relay.service';
import { RelayController } from './relay.controller';

@Module({
  providers: [RelayService],
  controllers: [RelayController],
  exports: [RelayService],
})
export class RelayModule {}
