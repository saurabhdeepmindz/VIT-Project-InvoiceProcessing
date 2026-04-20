/**
 * @file   dashboard.service.ts
 * @module Dashboard (EPIC-006)
 */

import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/AppLogger';
import {
  DashboardRepository, AggregatedRow, TrendRow, TopErrorRow, StatusBreakdownRow,
} from '../repositories/dashboard.repository';
import type {
  DashboardFilterDto, TrendFilterDto, TopErrorsFilterDto,
} from '../dto/dashboard-filter.dto';
import type {
  DashboardMetricsDto, TrendSeriesDto, TrendPointDto, TopErrorBatchDto,
} from '../dto/dashboard-metrics.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('DashboardService');
  }

  async metrics(filter: DashboardFilterDto, userId: string | null): Promise<DashboardMetricsDto> {
    const { from, to } = this.resolveRange(filter);
    const [agg, breakdown, dlqTotal] = await Promise.all([
      this.repo.aggregate({ from, to, userId }),
      this.repo.statusBreakdown({ from, to, userId }),
      this.repo.dlqTotal({ from, to, userId }),
    ]);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalBatches: Number(agg.total_batches ?? 0),
      totalRecords: Number(agg.total_records ?? 0),
      doneBatches: Number(agg.done_batches ?? 0),
      failedBatches: Number(agg.failed_batches ?? 0),
      partialBatches: Number(agg.partial_batches ?? 0),
      totalErrorRecords: Number(agg.total_error_records ?? 0),
      totalDlqRecords: dlqTotal,
      avgPreprocessingSec: this.nullableRound(agg.avg_preprocessing_s),
      avgEdaSec: this.nullableRound(agg.avg_eda_s),
      avgTurnaroundSec: this.nullableRound(agg.avg_turnaround_s),
      avgConfidence: this.nullableRound(agg.avg_confidence, 2),
      statusBreakdown: (breakdown as StatusBreakdownRow[]).map(r => ({
        status: r.status,
        count: Number(r.count ?? 0),
      })),
    };
  }

  async trend(filter: TrendFilterDto, userId: string | null): Promise<TrendSeriesDto> {
    const { from, to } = this.resolveRange(filter);
    const interval = filter.interval ?? 'day';
    const rows = await this.repo.trend({ from, to, userId }, interval);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      interval,
      points: (rows as TrendRow[]).map(r => ({
        bucket: r.bucket instanceof Date ? r.bucket.toISOString() : String(r.bucket),
        batches: Number(r.batches ?? 0),
        records: Number(r.records ?? 0),
        errors: Number(r.errors ?? 0),
        avgConfidence: this.nullableRound(r.avg_confidence, 2),
      } satisfies TrendPointDto)),
    };
  }

  async topErrors(filter: TopErrorsFilterDto, userId: string | null): Promise<TopErrorBatchDto[]> {
    const { from, to } = this.resolveRange(filter);
    const rows = await this.repo.topErrorBatches({ from, to, userId }, filter.limit);
    return (rows as TopErrorRow[]).map(r => ({
      batchId: r.batch_id,
      fileName: r.file_name,
      uploadedAt: r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
      errorRecords: r.error_records,
      dlqCount: r.dlq_count,
      batchStatus: r.batch_status,
    }));
  }

  /** Defaults: to = now, from = 30 days ago. */
  private resolveRange(filter: DashboardFilterDto): { from: Date; to: Date } {
    const to = filter.to ? new Date(filter.to) : new Date();
    const defaultFrom = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const from = filter.from ? new Date(filter.from) : defaultFrom;
    return { from, to };
  }

  private nullableRound(v: string | null, decimals = 0): number | null {
    if (v == null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const p = Math.pow(10, decimals);
    return Math.round(n * p) / p;
  }
}
