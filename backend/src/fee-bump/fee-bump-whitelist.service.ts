import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { Transaction, Operation, xdr, StrKey } from '@stellar/stellar-sdk';

/**
 * Defines which Stellar operation types are eligible for fee-bump sponsorship.
 *
 * Only operations on this list will be signed by the fee-payer.
 * This is the primary security boundary: even if rate-limiting is bypassed,
 * the attacker can only drain fees on pre-approved operation patterns.
 */
const WHITELISTED_OPERATION_TYPES: ReadonlySet<string> = new Set([
  'invokeHostFunction', // Soroban contract calls (invest, create_project, etc.)
  'payment', // Direct payments (refund flows)
  'createAccount', // New account onboarding (optional — remove if not needed)
]);

/**
 * Maps the client-supplied operationType label to allowed Stellar op types.
 * This adds a second layer: "invest" may only contain invokeHostFunction ops.
 */
const OPERATION_TYPE_MAP: Record<string, ReadonlySet<string>> = {
  invest: new Set(['invokeHostFunction']),
  refund: new Set(['payment', 'invokeHostFunction']),
  create_project: new Set(['invokeHostFunction']),
  release_milestone: new Set(['invokeHostFunction']),
};

export interface WhitelistValidationResult {
  valid: boolean;
  reason?: string;
}

@Injectable()
export class FeeBumpWhitelistService {
  private readonly logger = new Logger(FeeBumpWhitelistService.name);

  /**
   * Validates that every operation inside the inner transaction matches
   * the declared operationType and is on the global whitelist.
   *
   * @param transaction  Parsed inner Transaction object
   * @param operationType  Client-declared operation type label
   * @param walletAddress  Signer's public key — used to verify source account
   * @param contractId     Optional contract the ops target
   */
  validate(
    transaction: Transaction,
    operationType: string,
    walletAddress: string,
    contractId?: string,
  ): WhitelistValidationResult {
    const allowedStellarOps = OPERATION_TYPE_MAP[operationType];
    if (!allowedStellarOps) {
      return { valid: false, reason: `Unknown operationType: ${operationType}` };
    }

    const ops = transaction.operations;

    if (ops.length === 0) {
      return { valid: false, reason: 'Transaction contains no operations' };
    }

    // Guard: cap operation count to prevent complex transaction abuse
    if (ops.length > 10) {
      return {
        valid: false,
        reason: `Transaction contains too many operations (${ops.length} > 10)`,
      };
    }

    for (const op of ops) {
      const stellarOpType = op.type;

      // 1. Global whitelist check
      if (!WHITELISTED_OPERATION_TYPES.has(stellarOpType)) {
        return {
          valid: false,
          reason: `Operation type '${stellarOpType}' is not eligible for fee-bump sponsorship`,
        };
      }

      // 2. Per-operationType check
      if (!allowedStellarOps.has(stellarOpType)) {
        return {
          valid: false,
          reason: `Operation type '${stellarOpType}' is not allowed for '${operationType}'`,
        };
      }

      // 3. Source account guard: each op's source (if set) must match the wallet
      if (op.source && op.source !== walletAddress) {
        this.logger.warn(`Op source mismatch: op.source=${op.source}, wallet=${walletAddress}`);
        return {
          valid: false,
          reason: 'Operation source account does not match the declared wallet address',
        };
      }
    }

    // 4. Transaction-level source must be the user's wallet
    if (transaction.source !== walletAddress) {
      return {
        valid: false,
        reason: 'Transaction source account does not match the declared wallet address',
      };
    }

    // 5. Optional: if contractId is provided, verify the inner tx targets it
    if (contractId) {
      const targets = this.extractContractTargets(transaction);
      if (targets.size > 0 && !targets.has(contractId)) {
        this.logger.warn(
          `Contract ID mismatch: declared=${contractId}, found=${[...targets].join(', ')}`,
        );
        return {
          valid: false,
          reason: `Transaction does not target the declared contract: ${contractId}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Attempts to extract contract addresses invoked by invokeHostFunction ops.
   * Returns an empty set if parsing fails (non-fatal; validation still passes).
   */
  private extractContractTargets(transaction: Transaction): Set<string> {
    const targets = new Set<string>();
    for (const op of transaction.operations) {
      if (op.type !== 'invokeHostFunction') continue;
      try {
        // The func field holds the host function XDR
        const invokeOp = op as Operation.InvokeHostFunction;
        const hostFn = invokeOp.func;
        if (hostFn.switch() === xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
          const contractAddress = hostFn.invokeContract().contractAddress().contractId();
          if (contractAddress) {
            // Convert raw bytes to strkey
            const strkey = StrKey.encodeContract(contractAddress);
            targets.add(strkey);
          }
        }
      } catch {
        // Non-fatal: contract address extraction is best-effort
        this.logger.debug('Could not extract contract address from op');
      }
    }
    return targets;
  }
}
