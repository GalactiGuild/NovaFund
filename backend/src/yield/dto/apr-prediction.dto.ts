import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AprPredictionQueryDto {
  @ApiPropertyOptional({
    description: 'Project ID for project-specific prediction',
    example: 'clx1234567890',
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}
