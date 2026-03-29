import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TransactionBuilder,
  Keypair,
  Networks,
  Horizon,
  Transaction,
} from '@stellar/stellar-sdk';

@Injectable()
export class RelayService {
  private readonly logger = new Logger(RelayService.name);
  private readonly sponsorKeypair: Keypair;
  private readonly server: Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(private readonly config: ConfigService) {
    const stellarConfig = this.config.get('stellar');
    if (!stellarConfig.sponsorSecretKey) {
      this.logger.error('STELLAR_SPONSOR_SECRET_KEY is not configured');
    } else {
      this.sponsorKeypair = Keypair.fromSecret(stellarConfig.sponsorSecretKey);
    }
    
    this.server = new Horizon.Server(stellarConfig.horizonUrl);
    this.networkPassphrase = stellarConfig.networkPassphrase || Networks.TESTNET;
  }

  async relayTransaction(xdr: string): Promise<{ hash: string; ledger: number }> {
    if (!this.sponsorKeypair) {
      throw new InternalServerErrorException('Sponsor key is not configured');
    }

    try {
      // 1. Decode the inner transaction
      const innerTx = TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
      
      if (!(innerTx instanceof Transaction)) {
        throw new BadRequestException('Invalid inner transaction type');
      }

      // 2. Build the Fee Bump transaction
      // A Fee Bump transaction fee must be at least the inner transaction's fee + base fee.
      // We fetch the current base fee for accuracy.
      const baseFee = await this.server.fetchBaseFee();
      
      // Calculate the total fee for the outer Fee Bump transaction
      // Rule: outer_fee >= inner_fee + (inner_ops + 1) * base_fee
      // For Soroban, inner_fee is already high, so we must add a buffer.
      const innerFee = parseInt(innerTx.fee, 10);
      const outerFee = innerFee + (baseFee * (innerTx.operations.length + 1));
      
      const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
        this.sponsorKeypair,
        outerFee.toString(),
        innerTx,
        this.networkPassphrase,
      );

      // 3. Sign the Fee Bump transaction
      feeBumpTx.sign(this.sponsorKeypair);

      // 4. Submit to the network
      this.logger.log(`Submitting fee-bumped transaction ${innerTx.hash().toString('hex')} for source ${innerTx.source}`);
      const response = await this.server.submitTransaction(feeBumpTx);

      return {
        hash: response.hash,
        ledger: response.ledger,
      };
    } catch (error) {
      this.logger.error(`Relay failed: ${error.message}`, error.stack);
      if (error.response?.data?.extras?.result_codes) {
        this.logger.error(`Result codes: ${JSON.stringify(error.response.data.extras.result_codes)}`);
      }
      throw new BadRequestException(`Failed to relay transaction: ${error.message}`);
    }
  }
}
