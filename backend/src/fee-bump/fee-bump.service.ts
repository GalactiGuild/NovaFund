import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TransactionBuilder,
  Transaction,
  Keypair,
  Networks,
  BASE_FEE,
  FeeBumpTransaction,
} from '@stellar/stellar-sdk';
import { FeeBumpWhitelistService } from './fee-bump-whitelist.service';
import { FeeBumpAuditService } from './fee-bump-audit.Service';
import { SignFeeBumpDto, SignFeeBumpResponseDto } from './sign-fee-bump.dto';

@Injectable()
export class FeeBumpService {
  private readonly logger = new Logger(FeeBumpService.name);

  /** The fee-payer keypair — ONLY key this service ever holds. */
  private readonly feePayerKeypair: Keypair;

  /** Stellar network passphrase. */
  private readonly networkPassphrase: string;

  /**
   * Maximum fee (in stroops) the fee-payer is willing to cover per operation.
   * Default: 10× base fee = 1 000 stroops = 0.0001 XLM per op.
   * Configurable via FEE_BUMP_MAX_FEE_STROOPS env var.
   */
  private readonly maxFeePerOp: number;

  constructor(
    private readonly config: ConfigService,
    private readonly whitelist: FeeBumpWhitelistService,
    private readonly audit: FeeBumpAuditService,
  ) {
    // ------------------------------------------------------------------ //
    //  KEY ISOLATION — this is the only place a secret key is ever loaded //
    // ------------------------------------------------------------------ //
    const secretKey = this.config.getOrThrow<string>('FEE_PAYER_SECRET_KEY');

    try {
      this.feePayerKeypair = Keypair.fromSecret(secretKey);
    } catch {
      throw new Error(
        'FEE_PAYER_SECRET_KEY is not a valid Stellar secret key. ' + 'Refusing to start.',
      );
    }

    // Network
    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

    // Max fee
    this.maxFeePerOp = this.config.get<number>(
      'FEE_BUMP_MAX_FEE_STROOPS',
      parseInt(BASE_FEE) * 10, // 1 000 stroops default
    );

    this.logger.log(
      `FeeBumpService ready | feePayer=${this.feePayerKeypair.publicKey()} | ` +
        `network=${network} | maxFeePerOp=${this.maxFeePerOp} stroops`,
    );
  }

  /** Public key of the fee-payer (safe to expose). */
  get feePayerPublicKey(): string {
    return this.feePayerKeypair.publicKey();
  }

  /**
   * Validates, wraps, and signs a FeeBump transaction.
   *
   * Flow:
   *   1. Decode inner XDR → Transaction
   *   2. Whitelist validation
   *   3. Build FeeBump envelope
   *   4. Sign with fee-payer keypair
   *   5. Return XDR + audit
   */
  async sign(dto: SignFeeBumpDto, ipAddress: string): Promise<SignFeeBumpResponseDto> {
    // ── 1. Decode inner transaction ──────────────────────────────────────
    let innerTx: Transaction;
    try {
      innerTx = TransactionBuilder.fromXDR(
        dto.innerTransactionXdr,
        this.networkPassphrase,
      ) as Transaction;
    } catch (err) {
      await this.audit.log({
        outcome: 'REJECTED',
        walletAddress: dto.walletAddress,
        operationType: dto.operationType,
        contractId: dto.contractId,
        ipAddress,
        reason: 'Invalid inner transaction XDR',
      });
      throw new BadRequestException(
        'Could not decode innerTransactionXdr. Ensure it is a valid base-64 TransactionEnvelope XDR.',
      );
    }

    // Guard: FeeBump-of-FeeBump is not allowed
    if (innerTx instanceof FeeBumpTransaction) {
      await this.audit.log({
        outcome: 'REJECTED',
        walletAddress: dto.walletAddress,
        operationType: dto.operationType,
        ipAddress,
        reason: 'Inner transaction is already a FeeBump transaction',
      });
      throw new BadRequestException(
        'The inner transaction must be a regular Transaction, not a FeeBump.',
      );
    }

    // ── 2. Whitelist validation ──────────────────────────────────────────
    const validation = this.whitelist.validate(
      innerTx,
      dto.operationType,
      dto.walletAddress,
      dto.contractId,
    );

    if (!validation.valid) {
      await this.audit.log({
        outcome: 'REJECTED',
        walletAddress: dto.walletAddress,
        operationType: dto.operationType,
        contractId: dto.contractId,
        innerTxHash: innerTx.hash().toString('hex'),
        ipAddress,
        reason: validation.reason,
      });
      throw new UnprocessableEntityException(
        `Transaction rejected by whitelist: ${validation.reason}`,
      );
    }

    // ── 3. Build FeeBump envelope ────────────────────────────────────────
    // Total max fee = maxFeePerOp × (number of ops + 1 for the bump itself)
    const totalMaxFee = this.maxFeePerOp * (innerTx.operations.length + 1);

    let feeBumpTx: FeeBumpTransaction;
    try {
      feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        this.feePayerKeypair, // fee source — signs later
        totalMaxFee.toString(),
        innerTx,
        this.networkPassphrase,
      );
    } catch (err) {
      this.logger.error('Failed to build FeeBump transaction', err);
      await this.audit.log({
        outcome: 'ERROR',
        walletAddress: dto.walletAddress,
        operationType: dto.operationType,
        contractId: dto.contractId,
        innerTxHash: innerTx.hash().toString('hex'),
        ipAddress,
        reason: `FeeBump build error: ${(err as Error).message}`,
      });
      throw new InternalServerErrorException(
        'Failed to construct the FeeBump transaction. Please try again.',
      );
    }

    // ── 4. Sign with fee-payer keypair ───────────────────────────────────
    feeBumpTx.sign(this.feePayerKeypair);

    const feeBumpXdr = feeBumpTx.toXDR();
    const feeBumpHash = feeBumpTx.hash().toString('hex');

    // ── 5. Audit + respond ───────────────────────────────────────────────
    await this.audit.log({
      outcome: 'SIGNED',
      walletAddress: dto.walletAddress,
      operationType: dto.operationType,
      contractId: dto.contractId,
      innerTxHash: innerTx.hash().toString('hex'),
      feeBumpTxHash: feeBumpHash,
      ipAddress,
      maxFee: totalMaxFee.toString(),
    });

    this.logger.log(
      `Signed FeeBump | hash=${feeBumpHash} | op=${dto.operationType} | ` +
        `wallet=${dto.walletAddress} | fee=${totalMaxFee}`,
    );

    return {
      feeBumpXdr,
      feePayerPublicKey: this.feePayerKeypair.publicKey(),
      maxFee: totalMaxFee.toString(),
      signedAt: new Date().toISOString(),
    };
  }
}
