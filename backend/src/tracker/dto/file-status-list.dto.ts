/**
 * @file   file-status-list.dto.ts
 * @module Tracker (EPIC-005)
 */

import { IsOptional, IsInt, Min, Max, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileStatusQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Filter by batch status (UPLOADED | PREPROCESSING | … | DONE | FAILED)' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Created >= from (ISO 8601)' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Created <= to (ISO 8601)' })
  @IsOptional() @IsDateString()
  to?: string;
}

export class FileStatusRowDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() uploadedAt!: string;
  @ApiProperty() batchStatus!: string;
  @ApiProperty() batchSize!: number;

  @ApiPropertyOptional({ nullable: true }) preprocessingStatus!: string | null;
  @ApiPropertyOptional({ nullable: true }) preprocessingDurationSec!: number | null;

  @ApiPropertyOptional({ nullable: true }) edaStatus!: string | null;
  @ApiPropertyOptional({ nullable: true }) edaDurationSec!: number | null;

  @ApiProperty() totalRecords!: number;
  @ApiProperty() processedRecords!: number;
  @ApiProperty() errorRecords!: number;
  @ApiProperty() deadLetteredRecords!: number;

  @ApiPropertyOptional({ nullable: true }) avgConfidence!: number | null;
  @ApiPropertyOptional({ nullable: true }) turnaroundTimeSec!: number | null;
  @ApiPropertyOptional({ nullable: true }) outputCsvPath!: string | null;
}

export class FileStatusListDto {
  @ApiProperty({ type: [FileStatusRowDto] }) data!: FileStatusRowDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
