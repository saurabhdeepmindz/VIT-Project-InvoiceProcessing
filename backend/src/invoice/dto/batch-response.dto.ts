/**
 * @file   batch-response.dto.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Response shape for POST /invoice/batches.
 *
 * @since 3.1.0
 */

import { ApiProperty } from '@nestjs/swagger';

export class BatchResponseDto {
  @ApiProperty({ description: 'UUID of the newly-created batch' })
  batchId!: string;

  @ApiProperty({ description: 'Number of invoice records (CSV rows) in the batch' })
  totalRecords!: number;

  @ApiProperty({ enum: ['UPLOADED'], description: 'Initial batch status' })
  status!: 'UPLOADED';

  @ApiProperty({ description: 'SHA-256 of the uploaded CSV bytes' })
  csvContentHash!: string;

  @ApiProperty({ description: 'Storage path of the persisted CSV' })
  csvPath!: string;

  @ApiProperty({ description: 'ISO 8601 timestamp of creation' })
  createdAt!: string;
}
