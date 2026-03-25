import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

export type AuditOutcome = 'SIGNED' | 'REJECTED' | 'ERROR';

export interface AuditEntry {
  outcome: AuditOutcome;
  walletAddress: string;
  operationType: string;
  contractId?: string;
  innerTxHash?: string;
  feeBumpTxHash?: string;
  ipAddress: string;
  reason?: string;
  maxFee?: string;
}

/**
 * Writes fee-bump signing audit records into the existing `IndexerLog` table.
 *
 * This deliberately reuses the project's existing logging model so that
 * the microservice requires no additional DB migrations.
 *
 * Level mapping:
 *   SIGNED  → 'info'
 *   REJECTED → 'warn'
 *   ERROR   → 'error'
 */
@Injectable()
export class FeeBumpAuditService {
  private readonly logger = new Logger(FeeBumpAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const levelMap: Record<AuditOutcome, string> = {
      SIGNED: 'info',
      REJECTED: 'warn',
      ERROR: 'error',
    };

    const message = `[FeeBump:${entry.outcome}] op=${entry.operationType} wallet=${entry.walletAddress} ip=${entry.ipAddress}`;

    try {
      await this.prisma.indexerLog.create({
        data: {
          level: levelMap[entry.outcome],
          message,
          metadata: {
            service: 'fee-bump-signer',
            outcome: entry.outcome,
            walletAddress: entry.walletAddress,
            operationType: entry.operationType,
            contractId: entry.contractId ?? null,
            innerTxHash: entry.innerTxHash ?? null,
            feeBumpTxHash: entry.feeBumpTxHash ?? null,
            ipAddress: entry.ipAddress,
            maxFee: entry.maxFee ?? null,
            reason: entry.reason ?? null,
          },
        },
      });
    } catch (err) {
      // Audit failure must not surface to the caller — log locally only
      this.logger.error('Failed to write audit log', err);
    }
  }
}
