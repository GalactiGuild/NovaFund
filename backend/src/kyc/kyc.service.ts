import { Injectable, Logger } from '@nestjs/common';
import { KYCAuditEntity } from './kyc-audit.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class KYCService {
  private readonly logger = new Logger(KYCService.name);
  private audits: KYCAuditEntity[] = [];

  async overrideKYC(userId: string, adminId: string, action: 'APPROVE' | 'REJECT', reason?: string) {
    // Update user KYC status in DB (pseudo-code)
    // await this.userRepo.update(userId, { kycStatus: action });

    const audit: KYCAuditEntity = {
      id: uuidv4(),
      userId,
      adminId,
      action,
      reason,
      createdAt: new Date(),
    };
    this.audits.push(audit);
    this.logger.log(`KYC override: ${action} for user ${userId} by admin ${adminId}`);
    return audit;
  }

  async listAudits(): Promise<KYCAuditEntity[]> {
    return this.audits;
  }
}
