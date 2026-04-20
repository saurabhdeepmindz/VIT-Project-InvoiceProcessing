/**
 * @file   dead-letter-record.dto.ts
 * @module DeadLetter
 * @since 3.1.0
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeadLetterRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty() batchId!: string;
  @ApiPropertyOptional({ nullable: true }) recordId!: string | null;
  @ApiProperty({ enum: ['FETCH', 'PDF_CONVERT', 'OCR', 'LLM', 'RULE', 'OUTPUT'] })
  failureStage!: string;
  @ApiPropertyOptional({ nullable: true }) errorCode!: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() attempts!: number;
  @ApiProperty() lastAttemptAt!: string;
  @ApiProperty() retryEligible!: boolean;
  @ApiPropertyOptional({ nullable: true }) resolvedAt!: string | null;
  @ApiProperty() createdAt!: string;
}
