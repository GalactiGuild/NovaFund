import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  API_PREFIX: string;

  @IsString()
  DATABASE_HOST: string;

  @IsNumber()
  DATABASE_PORT: number;

  @IsString()
  DATABASE_USER: string;

  @IsString()
  DATABASE_PASSWORD: string;

  @IsString()
  DATABASE_NAME: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  REDIS_PASSWORD: string;

  @IsNumber()
  REDIS_DB: number;

  @IsNumber()
  REDIS_DEFAULT_TTL: number;

  @IsNumber()
  REDIS_MAX_KEYS: number;

  @IsString()
  JWT_SECRET: string;

  @IsNumber()
  JWT_EXPIRATION: number;

  @IsString()
  STELLAR_NETWORK: string;

  @IsString()
  STELLAR_RPC_URL: string;

  @IsString()
  STELLAR_BACKUP_RPC_URLS: string;

  @IsNumber()
  RPC_CIRCUIT_BREAKER_FAILURE_THRESHOLD: number;

  @IsNumber()
  RPC_CIRCUIT_BREAKER_RECOVERY_TIMEOUT: number;

  @IsNumber()
  RPC_CIRCUIT_BREAKER_MONITORING_PERIOD: number;

  @IsNumber()
  RPC_HEALTH_CHECK_INTERVAL: number;

  @IsNumber()
  RPC_REQUEST_TIMEOUT: number;

  @IsString()
  STELLAR_HORIZON_URL: string;

  @IsString()
  STELLAR_NETWORK_PASSPHRASE: string;

  @IsString()
  STELLAR_SPONSOR_SECRET_KEY: string;

  @IsString()
  PROJECT_LAUNCH_CONTRACT_ID: string;

  @IsString()
  ESCROW_CONTRACT_ID: string;

  @IsNumber()
  INDEXER_POLL_INTERVAL_MS: number;

  @IsNumber()
  INDEXER_REORG_DEPTH_THRESHOLD: number;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
