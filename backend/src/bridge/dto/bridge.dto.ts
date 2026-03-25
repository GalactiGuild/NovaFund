import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BridgeStatus } from '../enums/bridge-status.enum';

export class RegisterBridgeTxDto {
  @IsString()
  sourceTxHash: string;

  @IsString()
  sourceChain: string;

  @IsString()
  destChain: string;

  @IsString()
  @IsOptional()
  senderAddress?: string;

  @IsString()
  @IsOptional()
  receiverAddress?: string;

  @IsString()
  @IsOptional()
  amount?: string;

  @IsString()
  @IsOptional()
  asset?: string;
}

export class BridgeTxStatusDto {
  id: string;
  sourceTxHash: string;
  destTxHash: string | null;
  sourceChain: string;
  destChain: string;
  status: BridgeStatus;
  statusMessage: string | null;
  amount: string | null;
  asset: string | null;
  senderAddress: string | null;
  receiverAddress: string | null;
  lastCheckedAt: Date | null;
  arrivedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class BridgeTxQueryDto {
  @IsString()
  @IsOptional()
  sourceChain?: string;

  @IsEnum(BridgeStatus)
  @IsOptional()
  status?: BridgeStatus;
}
