/**
 * @file   dashboard.repository.ts
 * @module Dashboard (EPIC-006, v3.1)
 *
 * Aggregation queries only — no writes.
 * All queries honour optional userId for operator-scoped views.
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface DateRange {
  from: Date;
  to: Date;
  userId: string | null;
}

export interface AggregatedRow {
  total_batches: string;
  total_records: string;
  done_batches: string;
  failed_batches: string;
  partial_batches: string;
  total_error_records: string | null;
  avg_preprocessing_s: string | null;
  avg_eda_s: string | null;
  avg_turnaround_s: string | null;
  avg_confidence: string | null;
}

export interface StatusBreakdownRow { status: string; count: string }
export interface TrendRow { bucket: Date; batches: string; records: string; errors: string; avg_confidence: string | null }
export interface TopErrorRow {
  batch_id: string;
  file_name: string;
  uploaded_at: Date;
  error_records: number;
  dlq_count: number;
  batch_status: string;
}

@Injectable()
export class DashboardRepository {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async aggregate(range: DateRange): Promise<AggregatedRow> {
    const [params, userClause] = this.userClause(range, 1);
    params.push(range.from, range.to);
    const fromP = `$${params.length - 1}`;
    const toP = `$${params.length}`;

    const sql = `
      SELECT
        COUNT(ib.id)::text                                  AS total_batches,
        COALESCE(SUM(ib.batch_size), 0)::text               AS total_records,
        SUM(CASE WHEN ib.status = 'DONE'    THEN 1 ELSE 0 END)::text AS done_batches,
        SUM(CASE WHEN ib.status = 'FAILED'  THEN 1 ELSE 0 END)::text AS failed_batches,
        SUM(CASE WHEN ib.status = 'PARTIAL' THEN 1 ELSE 0 END)::text AS partial_batches,
        COALESCE(SUM(ps.error_records), 0)::text            AS total_error_records,
        AVG(ps.preprocessing_duration_s)::text              AS avg_preprocessing_s,
        AVG(ps.eda_duration_s)::text                        AS avg_eda_s,
        AVG(ps.turnaround_time_s)::text                     AS avg_turnaround_s,
        AVG(ps.avg_confidence)::text                        AS avg_confidence
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      WHERE ib.created_at BETWEEN ${fromP} AND ${toP}
      ${userClause}
    `;
    const rows = await this.ds.query(sql, params);
    return rows[0] as AggregatedRow;
  }

  async dlqTotal(range: DateRange): Promise<number> {
    const [params, userClause] = this.userClause(range, 1);
    params.push(range.from, range.to);
    const sql = `
      SELECT COUNT(*)::int AS cnt
      FROM dead_letter_records dlq
      JOIN invoice_batches ib ON ib.id = dlq.batch_id
      WHERE dlq.created_at BETWEEN $${params.length - 1} AND $${params.length}
      ${userClause.replace('ib.user_id', 'ib.user_id')}
    `;
    const rows = await this.ds.query(sql, params);
    return Number(rows[0]?.cnt ?? 0);
  }

  async statusBreakdown(range: DateRange): Promise<StatusBreakdownRow[]> {
    const [params, userClause] = this.userClause(range, 1);
    params.push(range.from, range.to);
    const sql = `
      SELECT ib.status AS status, COUNT(*)::text AS count
      FROM invoice_batches ib
      WHERE ib.created_at BETWEEN $${params.length - 1} AND $${params.length}
      ${userClause}
      GROUP BY ib.status
      ORDER BY ib.status
    `;
    return this.ds.query(sql, params) as Promise<StatusBreakdownRow[]>;
  }

  async trend(range: DateRange, interval: 'day' | 'week'): Promise<TrendRow[]> {
    const trunc = interval === 'week' ? 'week' : 'day';
    const [params, userClause] = this.userClause(range, 1);
    params.push(range.from, range.to);
    const sql = `
      SELECT
        date_trunc('${trunc}', ib.created_at)        AS bucket,
        COUNT(ib.id)::text                           AS batches,
        COALESCE(SUM(ib.batch_size), 0)::text        AS records,
        COALESCE(SUM(ps.error_records), 0)::text     AS errors,
        AVG(ps.avg_confidence)::text                 AS avg_confidence
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      WHERE ib.created_at BETWEEN $${params.length - 1} AND $${params.length}
      ${userClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    return this.ds.query(sql, params) as Promise<TrendRow[]>;
  }

  async topErrorBatches(range: DateRange, limit: number): Promise<TopErrorRow[]> {
    const [params, userClause] = this.userClause(range, 1);
    params.push(range.from, range.to, limit);
    const fromP = `$${params.length - 2}`;
    const toP   = `$${params.length - 1}`;
    const limP  = `$${params.length}`;

    const sql = `
      SELECT
        ib.id                                 AS batch_id,
        COALESCE(fu.file_name, ib.csv_path)   AS file_name,
        ib.created_at                         AS uploaded_at,
        COALESCE(ps.error_records, 0)::int    AS error_records,
        COALESCE(dlq.cnt, 0)::int             AS dlq_count,
        ib.status                             AS batch_status
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      LEFT JOIN LATERAL (
        SELECT file_name FROM file_uploads
         WHERE batch_id = ib.id AND source = 'UPLOAD'
         ORDER BY uploaded_at LIMIT 1
      ) fu ON TRUE
      LEFT JOIN (SELECT batch_id, COUNT(*) AS cnt FROM dead_letter_records GROUP BY batch_id) dlq
        ON dlq.batch_id = ib.id
      WHERE ib.created_at BETWEEN ${fromP} AND ${toP}
      ${userClause}
      ORDER BY (COALESCE(ps.error_records, 0) + COALESCE(dlq.cnt, 0)) DESC,
               ib.created_at DESC
      LIMIT ${limP}
    `;
    return this.ds.query(sql, params) as Promise<TopErrorRow[]>;
  }

  /** Produces the optional `AND ib.user_id = $N` clause; returns [params, clause]. */
  private userClause(range: DateRange, startIndex: number): [unknown[], string] {
    if (!range.userId) return [[], ''];
    return [[range.userId], `AND ib.user_id = $${startIndex}`];
  }
}
