import { IsString, IsNumber, IsBoolean, IsOptional, IsObject, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for contract event data
 */
export class ContractEventDto {
  @IsString()
  eventId: string;

  @IsNumber()
  ledgerSeq: number;

  @IsDate()
  @Type(() => Date)
  ledgerClosedAt: Date;

  @IsString()
  contractId: string;

  @IsString()
  eventType: string;

  @IsString()
  transactionHash: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsBoolean()
  inSuccessfulContractCall: boolean;
}

/**
 * DTO for event query parameters
 */
export class EventQueryDto {
  @IsNumber()
  @IsOptional()
  startLedger?: number;

  @IsNumber()
  @IsOptional()
  endLedger?: number;

  @IsString()
  @IsOptional()
  contractId?: string;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsNumber()
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  cursor?: string;
}

/**
 * DTO for ledger cursor update
 */
export class UpdateLedgerCursorDto {
  @IsString()
  network: string;

  @IsNumber()
  lastLedgerSeq: number;

  @IsString()
  @IsOptional()
  lastLedgerHash?: string;
}

/**
 * DTO for processed event tracking
 */
export class ProcessedEventDto {
  @IsString()
  eventId: string;

  @IsString()
  network: string;

  @IsNumber()
  ledgerSeq: number;

  @IsString()
  contractId: string;

  @IsString()
  eventType: string;

  @IsString()
  transactionHash: string;
}
