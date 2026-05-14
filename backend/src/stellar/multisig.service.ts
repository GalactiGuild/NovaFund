import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Transaction,
  xdr,
} from '@stellar/stellar-sdk';
import { PrismaService } from '../prisma.service';

export interface MultiSigRequest {
  id: string;
  txEnvelopeXdr: string;
  description: string;
  requiredSignatures: number;
  signatures: { signer: string; signedAt: Date }[];
  status: 'pending' | 'ready' | 'submitted' | 'failed';
  createdAt: Date;
  submittedAt?: Date;
}

/**
 * MultisigService — manages 2-of-3 multi-signature operations for admin treasury wallets.
 *
 * Flow:
 *  1. Admin A calls createRequest() with a built transaction XDR.
 *  2. Admin B (and optionally C) call addSignature() with their keypair secret.
 *  3. Once threshold is met the request status becomes 'ready'.
 *  4. Any admin calls submit() to broadcast the fully-signed transaction.
 *  5. All steps are persisted in the audit log table.
 */
@Injectable()
export class MultisigService {
  private readonly logger = new Logger(MultisigService.name);
  private readonly horizonServer: Horizon.Server;
  private readonly networkPassphrase: string;
  /** Required signatures threshold (2-of-3) */
  private readonly threshold = 2;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const horizonUrl = this.config.get<string>(
      'stellar.horizonUrl',
      'https://horizon-testnet.stellar.org',
    );
    this.networkPassphrase = this.config.get<string>(
      'stellar.networkPassphrase',
      Networks.TESTNET,
    );
    this.horizonServer = new Horizon.Server(horizonUrl);
  }

  /**
   * Create a new multi-sig request from a pre-built transaction XDR.
   */
  async createRequest(
    txEnvelopeXdr: string,
    description: string,
    initiatorPublicKey: string,
  ): Promise<MultiSigRequest> {
    // Validate the XDR is parseable
    try {
      new Transaction(txEnvelopeXdr, this.networkPassphrase);
    } catch {
      throw new BadRequestException('Invalid transaction XDR');
    }

    const record = await this.prisma.multiSigRequest.create({
      data: {
        txEnvelopeXdr,
        description,
        requiredSignatures: this.threshold,
        status: 'pending',
        signatures: {
          create: [],
        },
      },
      include: { signatures: true },
    });

    await this.audit(record.id, initiatorPublicKey, 'created');
    this.logger.log(`MultiSig request ${record.id} created by ${initiatorPublicKey}`);
    return this.toDto(record);
  }

  /**
   * Add a signature from an authorised signer.
   * Automatically advances status to 'ready' when threshold is met.
   */
  async addSignature(requestId: string, signerSecret: string): Promise<MultiSigRequest> {
    const record = await this.prisma.multiSigRequest.findUnique({
      where: { id: requestId },
      include: { signatures: true },
    });
    if (!record) throw new NotFoundException(`MultiSig request ${requestId} not found`);
    if (record.status !== 'pending') {
      throw new BadRequestException(`Request is already ${record.status}`);
    }

    const keypair = Keypair.fromSecret(signerSecret);
    const publicKey = keypair.publicKey();

    if (record.signatures.some((s) => s.signer === publicKey)) {
      throw new BadRequestException(`${publicKey} has already signed this request`);
    }

    // Sign the transaction
    const tx = new Transaction(record.txEnvelopeXdr, this.networkPassphrase);
    tx.sign(keypair);
    const updatedXdr = tx.toEnvelope().toXDR('base64');

    const newSigCount = record.signatures.length + 1;
    const newStatus = newSigCount >= this.threshold ? 'ready' : 'pending';

    const updated = await this.prisma.multiSigRequest.update({
      where: { id: requestId },
      data: {
        txEnvelopeXdr: updatedXdr,
        status: newStatus,
        signatures: {
          create: { signer: publicKey, signedAt: new Date() },
        },
      },
      include: { signatures: true },
    });

    await this.audit(requestId, publicKey, 'signed');
    this.logger.log(`Signature added to request ${requestId} by ${publicKey} (${newSigCount}/${this.threshold})`);
    return this.toDto(updated);
  }

  /**
   * Submit a 'ready' request to the Stellar network.
   */
  async submit(requestId: string, submitterPublicKey: string): Promise<{ hash: string }> {
    const record = await this.prisma.multiSigRequest.findUnique({
      where: { id: requestId },
      include: { signatures: true },
    });
    if (!record) throw new NotFoundException(`MultiSig request ${requestId} not found`);
    if (record.status !== 'ready') {
      throw new BadRequestException(
        `Request is not ready for submission (status: ${record.status})`,
      );
    }

    try {
      const tx = new Transaction(record.txEnvelopeXdr, this.networkPassphrase);
      const result = await this.horizonServer.submitTransaction(tx);
      const hash = (result as any).hash as string;

      await this.prisma.multiSigRequest.update({
        where: { id: requestId },
        data: { status: 'submitted', submittedAt: new Date() },
      });

      await this.audit(requestId, submitterPublicKey, 'submitted', hash);
      this.logger.log(`MultiSig request ${requestId} submitted. tx hash: ${hash}`);
      return { hash };
    } catch (err) {
      await this.prisma.multiSigRequest.update({
        where: { id: requestId },
        data: { status: 'failed' },
      });
      await this.audit(requestId, submitterPublicKey, 'failed', err.message);
      throw err;
    }
  }

  /** List all multi-sig requests (most recent first). */
  async listRequests(): Promise<MultiSigRequest[]> {
    const records = await this.prisma.multiSigRequest.findMany({
      include: { signatures: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(this.toDto);
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private async audit(
    requestId: string,
    actor: string,
    action: string,
    detail?: string,
  ): Promise<void> {
    await this.prisma.multiSigAuditLog.create({
      data: { requestId, actor, action, detail: detail ?? null },
    });
  }

  private toDto(record: any): MultiSigRequest {
    return {
      id: record.id,
      txEnvelopeXdr: record.txEnvelopeXdr,
      description: record.description,
      requiredSignatures: record.requiredSignatures,
      signatures: record.signatures.map((s: any) => ({
        signer: s.signer,
        signedAt: s.signedAt,
      })),
      status: record.status,
      createdAt: record.createdAt,
      submittedAt: record.submittedAt ?? undefined,
    };
  }
}
