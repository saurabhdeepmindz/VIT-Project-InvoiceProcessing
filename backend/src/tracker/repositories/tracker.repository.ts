/**
 * @file   tracker.repository.ts
 * @module Tracker (EPIC-005, v3.1)
 *
 * Aggregation queries for the Processing Status Tracker view.
 * Joins invoice_batches + processing_status + output_files + file_uploads
 * + dead_letter_records (count) to serve a richer, per-batch row.
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ListFilters {
  userId: string | null;     // null = admin view, no user filter
  status?: string;
  from?: string;
  to?: string;
  skip: number;
  take: number;
}

export interface TrackerListRow {
  batch_id: string;
  file_name: string;
  uploaded_at: Date;
  batch_status: string;
  batch_size: number;
  preprocessing_status: string | null;
  preprocessing_duration_s: number | null;
  eda_status: string | null;
  eda_duration_s: number | null;
  total_records: number;
  processed_records: number;
  error_records: number;
  dead_lettered_records: number;
  avg_confidence: string | null;
  turnaround_time_s: number | null;
  output_csv_path: string | null;
}

export interface TrackerRecordRow {
  record_id: string;
  csv_row_number: number;
  source_url: string;
  preprocessing_status: string;
  eda_status: string;
  page_count: number | null;
  confidence_score: string | null;
  extraction_status: string | null;
  error_message: string | null;
  dealer_name: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  vehicle_registration_number: string | null;
  tyre_size: string | null;
  tyre_pattern: string | null;
  invoice_amount_excl_gst: string | null;
  gst_amount: string | null;
  quantity: number | null;
  invoice_date: string | null;
  invoice_number: string | null;
  comments: string | null;
  llm_provider_used: string | null;
}

@Injectable()
export class TrackerRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(filters: ListFilters): Promise<{ rows: TrackerListRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    const next = (v: unknown): string => { params.push(v); return `$${params.length}`; };

    if (filters.userId) where.push(`ib.user_id = ${next(filters.userId)}`);
    if (filters.status) where.push(`ib.status = ${next(filters.status)}`);
    if (filters.from)   where.push(`ib.created_at >= ${next(filters.from)}`);
    if (filters.to)     where.push(`ib.created_at <= ${next(filters.to)}`);
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const takeP = next(filters.take);
    const skipP = next(filters.skip);

    const rowsSql = `
      SELECT
        ib.id                          AS batch_id,
        COALESCE(fu.file_name, ib.csv_path) AS file_name,
        ib.created_at                  AS uploaded_at,
        ib.status                      AS batch_status,
        ib.batch_size                  AS batch_size,
        ps.preprocessing_status,
        ps.preprocessing_duration_s,
        ps.eda_status,
        ps.eda_duration_s,
        ps.total_records,
        ps.processed_records,
        ps.error_records,
        COALESCE(dlq.cnt, 0)           AS dead_lettered_records,
        ps.avg_confidence,
        ps.turnaround_time_s,
        of.file_path                   AS output_csv_path
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      LEFT JOIN output_files     of ON of.batch_id = ib.id
      LEFT JOIN LATERAL (
        SELECT file_name FROM file_uploads
         WHERE batch_id = ib.id AND source = 'UPLOAD'
         ORDER BY uploaded_at LIMIT 1
      ) fu ON TRUE
      LEFT JOIN (
        SELECT batch_id, COUNT(*)::int AS cnt
        FROM dead_letter_records
        GROUP BY batch_id
      ) dlq ON dlq.batch_id = ib.id
      ${whereSql}
      ORDER BY ib.created_at DESC
      LIMIT ${takeP} OFFSET ${skipP}
    `;

    const countParams: unknown[] = [];
    const nextC = (v: unknown): string => { countParams.push(v); return `$${countParams.length}`; };
    const countWhere: string[] = [];
    if (filters.userId) countWhere.push(`ib.user_id = ${nextC(filters.userId)}`);
    if (filters.status) countWhere.push(`ib.status = ${nextC(filters.status)}`);
    if (filters.from)   countWhere.push(`ib.created_at >= ${nextC(filters.from)}`);
    if (filters.to)     countWhere.push(`ib.created_at <= ${nextC(filters.to)}`);
    const countWhereSql = countWhere.length ? `WHERE ${countWhere.join(' AND ')}` : '';
    const countSql = `SELECT COUNT(*)::int AS total FROM invoice_batches ib ${countWhereSql}`;

    const rawRows = await this.dataSource.query(rowsSql, params);
    const countRes = await this.dataSource.query(countSql, countParams);

    return {
      rows: (rawRows as TrackerListRow[]).map(this.normaliseRow),
      total: Number(countRes[0]?.total ?? 0),
    };
  }

  async listRecords(batchId: string): Promise<TrackerRecordRow[]> {
    const sql = `
      SELECT
        ir.id                          AS record_id,
        ir.csv_row_number,
        ir.source_url,
        ir.preprocessing_status,
        ir.eda_status,
        ir.page_count,
        er.confidence_score,
        er.extraction_status,
        ir.error_message,
        er.dealer_name,
        er.customer_name,
        er.customer_mobile,
        er.vehicle_registration_number,
        er.tyre_size,
        er.tyre_pattern,
        er.invoice_amount_excl_gst::text AS invoice_amount_excl_gst,
        er.gst_amount::text              AS gst_amount,
        er.quantity,
        er.invoice_date::text            AS invoice_date,
        er.invoice_number,
        er.comments,
        er.llm_provider_used
      FROM invoice_records ir
      LEFT JOIN extraction_results er ON er.invoice_record_id = ir.id
      WHERE ir.batch_id = $1
      ORDER BY ir.csv_row_number ASC
    `;
    const rows = await this.dataSource.query(sql, [batchId]);
    return (rows as TrackerRecordRow[]).map(r => ({
      ...r,
      csv_row_number: Number(r.csv_row_number),
      page_count: r.page_count != null ? Number(r.page_count) : null,
      quantity: r.quantity != null ? Number(r.quantity) : null,
    }));
  }

  async findOne(batchId: string, userId: string | null): Promise<TrackerListRow | null> {
    const res = await this.list({ userId, skip: 0, take: 1, status: undefined, from: undefined, to: undefined });
    return res.rows.find(r => r.batch_id === batchId) ??
      (await this.listDirect(batchId, userId));
  }

  private async listDirect(batchId: string, userId: string | null): Promise<TrackerListRow | null> {
    const params: unknown[] = [batchId];
    let userClause = '';
    if (userId) { params.push(userId); userClause = ` AND ib.user_id = $2`; }
    const sql = `
      SELECT
        ib.id AS batch_id, COALESCE(fu.file_name, ib.csv_path) AS file_name,
        ib.created_at AS uploaded_at, ib.status AS batch_status, ib.batch_size,
        ps.preprocessing_status, ps.preprocessing_duration_s,
        ps.eda_status, ps.eda_duration_s,
        ps.total_records, ps.processed_records, ps.error_records,
        COALESCE(dlq.cnt, 0) AS dead_lettered_records,
        ps.avg_confidence, ps.turnaround_time_s,
        of.file_path AS output_csv_path
      FROM invoice_batches ib
      LEFT JOIN processing_status ps ON ps.batch_id = ib.id
      LEFT JOIN output_files of ON of.batch_id = ib.id
      LEFT JOIN LATERAL (
        SELECT file_name FROM file_uploads
         WHERE batch_id = ib.id AND source = 'UPLOAD'
         ORDER BY uploaded_at LIMIT 1
      ) fu ON TRUE
      LEFT JOIN (
        SELECT batch_id, COUNT(*)::int AS cnt FROM dead_letter_records GROUP BY batch_id
      ) dlq ON dlq.batch_id = ib.id
      WHERE ib.id = $1 ${userClause}
    `;
    const rows = await this.dataSource.query(sql, params);
    return rows.length ? this.normaliseRow(rows[0] as TrackerListRow) : null;
  }

  private normaliseRow = (r: TrackerListRow): TrackerListRow => ({
    ...r,
    batch_size: Number(r.batch_size ?? 0),
    total_records: Number(r.total_records ?? 0),
    processed_records: Number(r.processed_records ?? 0),
    error_records: Number(r.error_records ?? 0),
    dead_lettered_records: Number(r.dead_lettered_records ?? 0),
    preprocessing_duration_s: r.preprocessing_duration_s != null ? Number(r.preprocessing_duration_s) : null,
    eda_duration_s: r.eda_duration_s != null ? Number(r.eda_duration_s) : null,
    turnaround_time_s: r.turnaround_time_s != null ? Number(r.turnaround_time_s) : null,
  });
}
