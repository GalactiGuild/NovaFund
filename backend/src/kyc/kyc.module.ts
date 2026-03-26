import { Module } from '@nestjs/common';
import { KYCService } from './kyc.service';
import { KYCController } from './kyc.controller';

@Module({
  providers: [KYCService],
  controllers: [KYCController],
  exports: [KYCService],
})
export class KYCModule {}
