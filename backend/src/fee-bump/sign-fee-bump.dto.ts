import { IsString, IsNotEmpty, IsOptional, IsIn, Matches } from 'class-validator';

/**
 * Sent by the client when they want the fee-payer to sign a FeeBump wrapper.
 *
 * The client builds the *inner* transaction (signed by the user's keypair),
 * XDR-encodes it, and sends it here. This service wraps it in a FeeBump
 * envelope, signs only the fee-bump layer, and returns the final XDR for
 * the client to submit to Horizon.
 */
export class SignFeeBumpDto {
  /**
   * Base-64 XDR of the inner transaction (already signed by the user).
   * Must be a TransactionEnvelope XDR.
   */
  @IsString()
  @IsNotEmpty()
  innerTransactionXdr: string;

  /**
   * The public key (G…) of the user's wallet.
   * Used for per-wallet rate limiting and whitelist checks.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'walletAddress must be a valid Stellar public key (G…)',
  })
  walletAddress: string;

  /**
   * The operation type the user is performing (e.g. "invest", "refund").
   * Only whitelisted operation types are accepted.
   */
  @IsString()
  @IsNotEmpty()
  @IsIn(['invest', 'refund', 'create_project', 'release_milestone'], {
    message: 'operationType must be one of: invest, refund, create_project, release_milestone',
  })
  operationType: string;

  /**
   * Optional: the contract ID the operation targets.
   * Used for additional whitelist validation.
   */
  @IsString()
  @IsOptional()
  contractId?: string;
}

export class SignFeeBumpResponseDto {
  /** Base-64 XDR of the FeeBump envelope, ready to submit to Horizon. */
  feeBumpXdr: string;

  /** The fee-payer's public key (for transparency / client verification). */
  feePayerPublicKey: string;

  /** Estimated maximum fee the fee-payer will cover (in stroops). */
  maxFee: string;

  /** ISO-8601 timestamp of when the signing occurred. */
  signedAt: string;
}

export class FeeBumpErrorResponseDto {
  statusCode: number;
  error: string;
  message: string;
}
