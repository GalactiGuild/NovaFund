import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { KycAuditEntity } from './entities/kyc-audit.entity';
import { KycAdminService } from './services/kyc-admin.service';
import { KycAdminController } from './controllers/kyc-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycAuditEntity]),
  ],
  controllers: [KycAdminController],
  providers: [KycAdminService],
})
export class VerificationModule {}