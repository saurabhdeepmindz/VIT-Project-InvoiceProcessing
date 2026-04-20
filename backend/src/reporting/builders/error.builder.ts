/**
 * @file   error.builder.ts
 * @module Reporting — invoice records that errored or have low confidence.
 */

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface ErrorRow {
  batch_id: string;
  file_name: string;
  record_id: string;
  csv_row_number: number;
  source_url: string;
  preprocessing_status: string;
  eda_status: string;
  extraction_status: string | null;
  error_message: string | null;
  confidence_score: string | null;
  uploaded_at: string;
}

@Injectable()
export class ErrorReportBuilder {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async build(
    from: Date,
    to: Date,
    userId: string | null,
    lowConfidenceThreshold: number,
  ): Promise<ErrorRow[]> {
    const params: unknown[] = [from, to, lowConfidenceThreshold];
    let userClause = '';
    if (userId) { params.push(userId); userClause = ` AND ib.user_id = $4`; }

    const sql = `
      SELECT
        ib.id                                    AS batch_id,
        COALESCE(fu.file_name, ib.csv_path)      AS file_name,
        ir.id                                    AS record_id,
        ir.csv_row_number,
        ir.source_url,
        ir.preprocessing_status,
        ir.eda_status,
        er.extraction_status,
        ir.error_message,
        er.confidence_score::text                AS confidence_score,
        ib.created_at::text                      AS uploaded_at
      FROM invoice_records ir
      JOIN invoice_batches ib ON ib.id = ir.batch_id
      LEFT JOIN extraction_results er ON er.invoice_record_id = ir.id
      LEFT JOIN LATERAL (
        SELECT file_name FROM file_uploads
         WHERE batch_id = ib.id AND source = 'UPLOAD'
         ORDER BY uploaded_at LIMIT 1
      ) fu ON TRUE
      WHERE ib.created_at BETWEEN $1 AND $2
        AND (
          ir.preprocessing_status IN ('ERROR', 'DEAD_LETTERED')
          OR ir.eda_status        IN ('FAILED', 'PARTIAL', 'DEAD_LETTERED')
          OR (er.confidence_score IS NOT NULL AND er.confidence_score < $3)
        )
        ${userClause}
      ORDER BY ib.created_at DESC, ir.csv_row_number ASC
    `;
    return this.ds.query(sql, params) as Promise<ErrorRow[]>;
  }
}
