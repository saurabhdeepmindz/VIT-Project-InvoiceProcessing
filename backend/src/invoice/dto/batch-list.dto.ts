/**
 * @file   batch-list.dto.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Query + response DTOs for GET /invoice/batches (paginated list).
 *
 * @since 3.1.0
 */

import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchListQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ enum: ['UPLOADED', 'PREPROCESSING', 'PREPROCESSED', 'EDA_PROCESSING', 'DONE', 'FAILED', 'PARTIAL'] })
  @IsOptional() @IsString()
  status?: string;
}

export class BatchListItemDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() batchSize!: number;
  @ApiProperty() createdAt!: string;
}

export class BatchListResponseDto {
  @ApiProperty({ type: [BatchListItemDto] }) data!: BatchListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}
