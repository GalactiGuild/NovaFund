import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KycStatus } from '../entities/kyc-status.enum';

export class KycOverrideDto {
  @IsString()
  userId: string;

  @IsEnum(KycStatus)
  status: KycStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}