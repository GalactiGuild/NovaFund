import { IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';

export class InitiateDepositDto {
  @IsString()
  walletAddress: string;

  @IsString()
  @IsOptional()
  assetCode?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  anchorProvider?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  projectId?: string;
}

export class DepositStatusDto {
  id: string;
  status: string;
  amount?: number;
  assetCode: string;
  stellarTransactionId?: string;
  message?: string;
}

export class AnchorCallbackDto {
  transaction: {
    id: string;
    status: string;
    stellar_transaction_id?: string;
    amount_in?: string;
    amount_out?: string;
    [key: string]: any;
  };
}
