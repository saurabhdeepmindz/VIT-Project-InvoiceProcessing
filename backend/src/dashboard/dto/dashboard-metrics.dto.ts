/**
 * @file   dashboard-metrics.dto.ts
 * @module Dashboard (EPIC-006)
 */

import { ApiProperty } from '@nestjs/swagger';

export class StatusBreakdownDto {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

export class DashboardMetricsDto {
  @ApiProperty() from!: string;                // ISO 8601
  @ApiProperty() to!: string;
  @ApiProperty() totalBatches!: number;
  @ApiProperty() totalRecords!: number;
  @ApiProperty() doneBatches!: number;
  @ApiProperty() failedBatches!: number;
  @ApiProperty() partialBatches!: number;
  @ApiProperty() totalErrorRecords!: number;
  @ApiProperty() totalDlqRecords!: number;
  @ApiProperty({ nullable: true }) avgPreprocessingSec!: number | null;
  @ApiProperty({ nullable: true }) avgEdaSec!: number | null;
  @ApiProperty({ nullable: true }) avgTurnaroundSec!: number | null;
  @ApiProperty({ nullable: true }) avgConfidence!: number | null;
  @ApiProperty({ type: [StatusBreakdownDto] }) statusBreakdown!: StatusBreakdownDto[];
}

export class TrendPointDto {
  @ApiProperty({ description: 'Bucket start (ISO 8601 date or week start)' })
  bucket!: string;
  @ApiProperty() batches!: number;
  @ApiProperty() records!: number;
  @ApiProperty() errors!: number;
  @ApiProperty({ nullable: true }) avgConfidence!: number | null;
}

export class TrendSeriesDto {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ enum: ['day', 'week'] }) interval!: 'day' | 'week';
  @ApiProperty({ type: [TrendPointDto] }) points!: TrendPointDto[];
}

export class TopErrorBatchDto {
  @ApiProperty() batchId!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() uploadedAt!: string;
  @ApiProperty() errorRecords!: number;
  @ApiProperty() dlqCount!: number;
  @ApiProperty() batchStatus!: string;
}
