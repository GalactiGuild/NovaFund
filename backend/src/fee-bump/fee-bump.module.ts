import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { FeeBumpService } from './fee-bump.service';
import { FeeBumpWhitelistService } from './fee-bump-whitelist.service';
import { FeeBumpController } from './fee-bump.controller';
import { FeeBumpAuditService } from './fee-bump-audit.Service';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        // Per-IP: 20 requests per minute
        name: 'ip',
        ttl: 60_000,
        limit: 20,
      },
      {
        // Per-wallet: 10 requests per minute
        name: 'wallet',
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],
  controllers: [FeeBumpController],
  providers: [FeeBumpService, FeeBumpWhitelistService, FeeBumpAuditService],
  exports: [FeeBumpService],
})
export class FeeBumpModule {}
