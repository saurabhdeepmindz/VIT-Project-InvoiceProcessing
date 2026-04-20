/**
 * @file   weekly.builder.ts
 * @module Reporting — weekly aggregates for the date range.
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface WeeklyRow {
  week_start: string;
  week_end: string;
  total_batches: number;
  done_batches: number;
  failed_batches: number;
  partial_batches: number;
  total_records: number;
  processed_records: number;
  error_records: number;
  avg_preprocessing_s: number | null;
  avg_eda_s: number | null;
  avg_turnaround_s: number | null;
  avg_confidence: number | null;
}

@Injectable()
export class WeeklyReportBuilder {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async build(from: Date, to: Date, userId: string | null): Promise<WeeklyRow[]> {
    const params: unknown[] = [from, to];
    let userClause = '';
    if (userId) { params.push(userId); userClause = ` AND ib.user_id = $3`; }

    const sql = `
      SELECT
        date_trunc('week', ib.created_at)                          AS week_start_d,
        (date_trunc('week', ib.created_at) + interval '6 days')    AS week_end_d,
        COUNT(ib.id)::int                                          AS total_batches,
        SUM(CASE WHEN ib.status = 'DONE'    THEN 1 ELSE 0 END)::int AS done_batches,
        SUM(CASE WHEN ib.status = 'FAILED'  THEN 1 ELSE 0 END)::int AS failed_batches,
        SUM(CASE WHEN ib.status = 'PARTIAL' THEN 1 ELSE 0 END)::int AS partial_batches,
        COALESCE(SUM(ib.batch_size), 0)::int                       AS total_records,
        COALESCE(SUM(ps.processed_records), 0)::int                AS processed_records,
        COALESCE(SUM(ps.error_records), 0)::int                    AS error_records,
        AVG(ps.preprocessing_duration_s)::float                    AS avg_preprocessing_s,
        AVG(ps.eda_duration_s)::float                              AS avg_eda_s,
        AVG(ps.turnaround_time_s)::float                           AS avg_turnaround_s,
        AVG(ps.avg_confidence)::float                              AS avg_confidence
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      WHERE ib.created_at BETWEEN $1 AND $2
      ${userClause}
      GROUP BY week_start_d, week_end_d
      ORDER BY week_start_d ASC
    `;
    const rows = (await this.ds.query(sql, params)) as Array<WeeklyRow & { week_start_d: Date; week_end_d: Date }>;
    return rows.map(r => ({
      week_start: r.week_start_d instanceof Date ? r.week_start_d.toISOString().slice(0, 10) : String(r.week_start_d),
      week_end: r.week_end_d instanceof Date ? r.week_end_d.toISOString().slice(0, 10) : String(r.week_end_d),
      total_batches: Number(r.total_batches ?? 0),
      done_batches: Number(r.done_batches ?? 0),
      failed_batches: Number(r.failed_batches ?? 0),
      partial_batches: Number(r.partial_batches ?? 0),
      total_records: Number(r.total_records ?? 0),
      processed_records: Number(r.processed_records ?? 0),
      error_records: Number(r.error_records ?? 0),
      avg_preprocessing_s: r.avg_preprocessing_s != null ? Math.round(Number(r.avg_preprocessing_s)) : null,
      avg_eda_s: r.avg_eda_s != null ? Math.round(Number(r.avg_eda_s)) : null,
      avg_turnaround_s: r.avg_turnaround_s != null ? Math.round(Number(r.avg_turnaround_s)) : null,
      avg_confidence: r.avg_confidence != null ? Number(Number(r.avg_confidence).toFixed(2)) : null,
    }));
  }
}
