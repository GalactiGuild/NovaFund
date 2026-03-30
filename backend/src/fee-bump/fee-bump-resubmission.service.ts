import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TransactionBuilder,
  Transaction,
  Keypair,
  Networks,
  SorobanRpc,
} from '@stellar/stellar-sdk';

const MAX_RETRIES = 3;
const FEE_MULTIPLIER = 1.5;

@Injectable()
export class FeeBumpResubmissionService {
  private readonly logger = new Logger(FeeBumpResubmissionService.name);
  private readonly server: SorobanRpc.Server;
  private readonly networkPassphrase: string;

  /** In-memory sequence number cache keyed by account public key */
  private readonly sequenceCache = new Map<string, string>();

  constructor(private readonly config: ConfigService) {
    const rpcUrl = this.config.get<string>('STELLAR_RPC_URL', 'https://soroban-testnet.stellar.org');
    this.server = new SorobanRpc.Server(rpcUrl);
    const network = this.config.get<string>('STELLAR_NETWORK', 'testnet');
    this.networkPassphrase = network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
  }

  /**
   * Submits a signed FeeBump XDR with intelligent retry logic.
   * Handles tx_bad_seq by refreshing the sequence number and rebuilding.
   * Applies dynamic fee escalation on each retry.
   * Throws ServiceUnavailableException after MAX_RETRIES exhausted.
   */
  async submitWithRetry(
    feeBumpXdr: string,
    innerTx: Transaction,
    feePayerKeypair: Keypair,
    baseFee: number,
  ): Promise<SorobanRpc.Api.SendTransactionResponse> {
    let attempt = 0;
    let currentFee = baseFee;
    let currentInnerTx = innerTx;

    while (attempt < MAX_RETRIES) {
      attempt++;
      try {
        const response = await this.server.sendTransaction(
          TransactionBuilder.fromXDR(feeBumpXdr, this.networkPassphrase) as any,
        );

        if (response.status === 'ERROR') {
          const resultCode = (response as any).errorResult?.result()?.switch()?.name;
          if (resultCode === 'txBadSeq') {
            this.logger.warn(`tx_bad_seq on attempt ${attempt}, refreshing sequence...`);
            currentInnerTx = await this.rebuildWithFreshSequence(currentInnerTx, feePayerKeypair);
            currentFee = Math.ceil(currentFee * FEE_MULTIPLIER);
            feeBumpXdr = this.wrapFeeBump(currentInnerTx, feePayerKeypair, currentFee);
            continue;
          }
          throw new Error(`Transaction error: ${resultCode}`);
        }

        // Cache the sequence on success
        this.sequenceCache.set(
          feePayerKeypair.publicKey(),
          currentInnerTx.sequence,
        );
        return response;
      } catch (err: any) {
        const isTimeout = err?.message?.includes('timeout') || err?.message?.includes('504');
        if (isTimeout && attempt < MAX_RETRIES) {
          this.logger.warn(`Timeout on attempt ${attempt}, retrying with higher fee...`);
          currentFee = Math.ceil(currentFee * FEE_MULTIPLIER);
          feeBumpXdr = this.wrapFeeBump(currentInnerTx, feePayerKeypair, currentFee);
          continue;
        }
        if (attempt >= MAX_RETRIES) break;
        throw err;
      }
    }

    this.logger.error(`Transaction failed after ${MAX_RETRIES} attempts`);
    throw new ServiceUnavailableException(
      `Transaction could not be submitted after ${MAX_RETRIES} attempts. Please try again later.`,
    );
  }

  private async rebuildWithFreshSequence(
    tx: Transaction,
    keypair: Keypair,
  ): Promise<Transaction> {
    const account = await this.server.getAccount(keypair.publicKey());
    this.sequenceCache.set(keypair.publicKey(), account.sequenceNumber());

    const rebuilt = TransactionBuilder.cloneFrom(tx, {
      fee: tx.fee,
      networkPassphrase: this.networkPassphrase,
    })
      .setTimeout(30)
      .build();

    rebuilt.sign(keypair);
    return rebuilt;
  }

  private wrapFeeBump(
    innerTx: Transaction,
    feePayerKeypair: Keypair,
    totalFee: number,
  ): string {
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      feePayerKeypair,
      totalFee.toString(),
      innerTx,
      this.networkPassphrase,
    );
    feeBump.sign(feePayerKeypair);
    return feeBump.toXDR();
  }

  /** Returns cached sequence or undefined if not yet cached */
  getCachedSequence(publicKey: string): string | undefined {
    return this.sequenceCache.get(publicKey);
  }
}
