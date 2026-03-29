import { ConfigService } from '@nestjs/config';

// Stellar natively uses 7 decimal places (1 Stroop = 0.0000001 XLM).
export const STELLAR_NATIVE_DECIMALS = 7;

/**
 * Interface mapping known token addresses to their respective on-chain decimal places.
 */
export interface TokenDecimalsMapping {
  [tokenContractId: string]: number;
}

/**
 * Create a registry of stablecoins from config values
 */
export function getAssetDecimalsConfig(configService: ConfigService): TokenDecimalsMapping {
  const usdcAddr = configService.get<string>('STELLAR_USDC_CONTRACT_ID', '');
  const eurcAddr = configService.get<string>('STELLAR_EURC_CONTRACT_ID', '');
  
  const mapping: TokenDecimalsMapping = {};
  
  if (usdcAddr) {
    // USDC on Stellar native is 7 decimals
    mapping[usdcAddr] = 7;
  }
  
  if (eurcAddr) {
    // EURC might be configured with different precision, here we assume it could be 6 or whatever. 
    // Usually wrapped tokens or EURC emit 6 decimals on some chains. 
    // We'll set 6 as per standard circle tokens on some EVM chains, or map it properly in production.
    // For Stellar, typically 7. We'll set it to 7 here for consistency if not specified otherwise.
    mapping[eurcAddr] = 7; 
  }
  
  return mapping;
}

/**
 * Normalizes an amount from its native decimal scale to Stellar's 7 decimal Stroop standard.
 * 
 * @param amount Raw amount string or bigint
 * @param tokenContractId The asset's contract ID
 * @param configService NestJS configuration service
 * @returns BigInt representing the converted amount in Stroops
 */
export function normalizeToStroops(
  amount: string | bigint | number, 
  tokenContractId: string, 
  configService: ConfigService
): bigint {
  const amountBigInt = typeof amount === 'bigint' ? amount : BigInt(amount.toString());
  
  if (!tokenContractId) {
    return amountBigInt;
  }
  
  const mapping = getAssetDecimalsConfig(configService);
  const nativeDecimals = mapping[tokenContractId];
  
  // If the asset decimal places are not explicitly mapped, we safely assume it's already using 7.
  if (nativeDecimals === undefined) {
    return amountBigInt;
  }
  
  if (nativeDecimals === STELLAR_NATIVE_DECIMALS) {
    return amountBigInt;
  }
  
  if (nativeDecimals < STELLAR_NATIVE_DECIMALS) {
    // Missing decimals: need to upscale
    const diff = STELLAR_NATIVE_DECIMALS - nativeDecimals;
    return amountBigInt * (10n ** BigInt(diff));
  } else {
    // Too many decimals: need to downscale
    const diff = nativeDecimals - STELLAR_NATIVE_DECIMALS;
    return amountBigInt / (10n ** BigInt(diff));
  }
}
