import { Module } from '@nestjs/common';
import { RelayService } from './relay.service';
import { RelayController } from './relay.controller';
import { StellarModule } from '../stellar/stellar.module';

@Module({
  imports: [StellarModule],
  providers: [RelayService],
  controllers: [RelayController],
  exports: [RelayService],
})
export class RelayModule {}
