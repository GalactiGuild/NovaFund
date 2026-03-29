import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RelayTransactionDto {
  @IsString()
  @IsNotEmpty()
  xdr: string;

  @IsString()
  @IsOptional()
  network?: string;
}
