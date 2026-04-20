/**
 * @file   batch-status.dto.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Response shape for GET /invoice/batches/:id.
 *
 * @since 3.1.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchStatusDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() batchSize!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  @ApiPropertyOptional({ description: 'Preprocessing status (from processing_status, null until EPIC-003 runs)' })
  preprocessingStatus?: string | null;

  @ApiPropertyOptional()
  edaStatus?: string | null;

  @ApiPropertyOptional()
  totalRecords?: number | null;

  @ApiPropertyOptional()
  processedRecords?: number | null;

  @ApiPropertyOptional()
  errorRecords?: number | null;

  @ApiPropertyOptional()
  avgConfidence?: number | null;
}
