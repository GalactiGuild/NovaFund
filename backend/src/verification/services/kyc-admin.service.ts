import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycAuditEntity } from '../entities/kyc-audit.entity';
import { KycOverrideDto } from '../dto/kyc-override.dto';
import { KycStatus } from '../entities/kyc-status.enum';

@Injectable()
export class KycAdminService {
  constructor(
    @InjectRepository(KycAuditEntity)
    private readonly auditRepo: Repository<KycAuditEntity>,
  ) {}

  async overrideKyc(dto: KycOverrideDto, adminId: string) {
    // TODO: fetch real user KYC status from DB
    const previousStatus = KycStatus.PENDING;

    const newStatus = dto.status;

    // TODO: update actual user record here
    // await this.userRepo.update(dto.userId, { kycStatus: newStatus });

    await this.auditRepo.save({
      userId: dto.userId,
      previousStatus,
      newStatus,
      action: 'OVERRIDE',
      adminId,
      reason: dto.reason,
    });

    return {
      userId: dto.userId,
      previousStatus,
      newStatus,
      overriddenBy: adminId,
      timestamp: new Date(),
    };
  }

  async approveKyc(userId: string, adminId: string) {
    return this.overrideKyc(
      { userId, status: KycStatus.VERIFIED },
      adminId,
    );
  }

  async rejectKyc(userId: string, adminId: string, reason?: string) {
    return this.overrideKyc(
      { userId, status: KycStatus.REJECTED, reason },
      adminId,
    );
  }
}