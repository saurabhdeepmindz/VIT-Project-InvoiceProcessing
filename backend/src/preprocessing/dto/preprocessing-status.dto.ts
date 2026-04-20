/**
 * @file   preprocessing-status.dto.ts
 * @module Preprocessing
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreprocessingStatusDto {
  @ApiProperty() batchId!: string;
  @ApiProperty({ enum: ['PENDING', 'RUNNING', 'DONE', 'FAILED', 'PARTIAL'] })
  status!: string;
  @ApiPropertyOptional({ nullable: true }) startedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) endedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) durationSec!: number | null;
  @ApiProperty() totalRecords!: number;
  @ApiProperty() processedRecords!: number;
  @ApiProperty() errorRecords!: number;
  @ApiProperty() deadLetteredRecords!: number;
}
