/**
 * @file   single-file.builder.ts
 * @module Reporting (EPIC-007) — builds rows for one batch.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InvoiceBatchEntity } from '../../entities/Entities';

export interface SingleFileRow {
  record_id: string; batch_id: string; source_url: string; csv_row_number: number;
  dealer_name: string; customer_name: string; customer_mobile: string;
  vehicle_registration_number: string; tyre_size: string; tyre_pattern: string;
  invoice_amount_excl_gst: string; gst_amount: string; quantity: string;
  invoice_date: string; invoice_number: string; comments: string;
  preprocessing_status: string; eda_status: string; extraction_status: string;
  confidence_score: string; llm_provider_used: string; extracted_at: string;
}

@Injectable()
export class SingleFileReportBuilder {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async build(batchId: string, userId: string | null): Promise<SingleFileRow[]> {
    // ownership check
    const batch = await this.ds.getRepository(InvoiceBatchEntity).findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`);
    if (userId && batch.user_id !== userId) throw new NotFoundException(`Batch ${batchId} not found`);

    const sql = `
      SELECT
        ir.id AS record_id, ir.batch_id, ir.source_url, ir.csv_row_number,
        COALESCE(er.dealer_name, '')                 AS dealer_name,
        COALESCE(er.customer_name, '')               AS customer_name,
        COALESCE(er.customer_mobile, '')             AS customer_mobile,
        COALESCE(er.vehicle_registration_number, '') AS vehicle_registration_number,
        COALESCE(er.tyre_size, '')                   AS tyre_size,
        COALESCE(er.tyre_pattern, '')                AS tyre_pattern,
        COALESCE(er.invoice_amount_excl_gst::text, '') AS invoice_amount_excl_gst,
        COALESCE(er.gst_amount::text, '')            AS gst_amount,
        COALESCE(er.quantity::text, '')              AS quantity,
        COALESCE(er.invoice_date::text, '')          AS invoice_date,
        COALESCE(er.invoice_number, '')              AS invoice_number,
        COALESCE(er.comments, '')                    AS comments,
        ir.preprocessing_status, ir.eda_status,
        COALESCE(er.extraction_status, 'PENDING')    AS extraction_status,
        COALESCE(er.confidence_score::text, '')      AS confidence_score,
        COALESCE(er.llm_provider_used, '')           AS llm_provider_used,
        COALESCE(er.extracted_at::text, '')          AS extracted_at
      FROM invoice_records ir
      LEFT JOIN extraction_results er ON er.invoice_record_id = ir.id
      WHERE ir.batch_id = $1
      ORDER BY ir.csv_row_number ASC
    `;
    return this.ds.query(sql, [batchId]) as Promise<SingleFileRow[]>;
  }
}
