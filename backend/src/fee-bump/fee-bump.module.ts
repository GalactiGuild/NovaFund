import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { FeeBumpService } from "./fee-bump.service";
import { FeeBumpWhitelistService } from "./fee-bump-whitelist.service";
import { FeeBumpController } from "./fee-bump.controller";
import { FeeBumpAuditService } from "./fee-bump-audit.Service";
import { FeeBumpResubmissionService } from "./fee-bump-resubmission.service";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: "ip", ttl: 60_000, limit: 20 },
      { name: "wallet", ttl: 60_000, limit: 10 },
    ]),
  ],
  controllers: [FeeBumpController],
  providers: [FeeBumpService, FeeBumpWhitelistService, FeeBumpAuditService, FeeBumpResubmissionService],
  exports: [FeeBumpService],
})
export class FeeBumpModule {}
