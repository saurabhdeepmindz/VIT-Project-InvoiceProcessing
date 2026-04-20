/**
 * @file   generate-report.dto.ts
 * @module Reporting (EPIC-007)
 */

import { IsIn, IsOptional, IsDateString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ enum: ['SINGLE_FILE', 'WEEKLY', 'ERROR'] })
  @IsIn(['SINGLE_FILE', 'WEEKLY', 'ERROR'])
  reportType!: 'SINGLE_FILE' | 'WEEKLY' | 'ERROR';

  @ApiProperty({ enum: ['CSV', 'XLSX'] })
  @IsIn(['CSV', 'XLSX'])
  format!: 'CSV' | 'XLSX';

  @ApiPropertyOptional({ description: 'Required for SINGLE_FILE' })
  @IsOptional() @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Required for WEEKLY / ERROR' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Required for WEEKLY / ERROR' })
  @IsOptional() @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'ERROR report: include records with confidence below this (default 70)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100)
  lowConfidenceThreshold?: number;
}

export class ReportListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ['SINGLE_FILE', 'WEEKLY', 'ERROR'] })
  @IsOptional() @IsIn(['SINGLE_FILE', 'WEEKLY', 'ERROR'])
  type?: 'SINGLE_FILE' | 'WEEKLY' | 'ERROR';
}
