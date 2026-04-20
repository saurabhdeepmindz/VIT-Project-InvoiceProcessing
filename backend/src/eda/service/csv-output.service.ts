/**
 * @file   csv-output.service.ts
 * @module EDA (v3.1)
 *
 * Generates per-batch extraction CSV and persists it via FileStorageService
 * under OUTPUT_DIR_PATH prefix (default: output/batches/<id>/extraction.csv).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { stringify } from 'csv-stringify/sync';

import { AppLogger } from '../../common/logger/AppLogger';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { OutputFileRepository } from '../repositories/output-file.repository';
import { ExtractionResultEntity, InvoiceRecordEntity } from '../../entities/Entities';
import { CSV_COLUMNS } from '../constants';

interface RowInput {
  record: InvoiceRecordEntity;
  result: ExtractionResultEntity | null;
}

@Injectable()
export class CsvOutputService {
  constructor(
    private readonly fileStorage: FileStorageService,
    private readonly outputRepo: OutputFileRepository,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('CsvOutputService');
  }

  async generate(batchId: string, rows: RowInput[]): Promise<string> {
    const records = rows.map(({ record, result }) => ({
      record_id: record.id,
      batch_id: record.batch_id,
      source_url: record.source_url,
      dealer_name: result?.dealer_name ?? '',
      customer_name: result?.customer_name ?? '',
      customer_mobile: result?.customer_mobile ?? '',
      vehicle_registration_number: result?.vehicle_registration_number ?? '',
      tyre_size: result?.tyre_size ?? '',
      tyre_pattern: result?.tyre_pattern ?? '',
      invoice_amount_excl_gst: result?.invoice_amount_excl_gst ?? '',
      gst_amount: result?.gst_amount ?? '',
      quantity: result?.quantity ?? '',
      invoice_date: result?.invoice_date ?? '',
      invoice_number: result?.invoice_number ?? '',
      comments: result?.comments ?? '',
      confidence_score: result?.confidence_score ?? '',
      extraction_status: result?.extraction_status ?? 'PENDING',
      llm_provider_used: result?.llm_provider_used ?? '',
      extracted_at: result?.extracted_at ? result.extracted_at.toISOString() : '',
    }));

    const csv = stringify(records, {
      header: true,
      columns: Array.from(CSV_COLUMNS),
      quoted: true,
      eof: true,
    });

    const prefix = this.config.get<string>('OUTPUT_DIR_PATH') ?? 'output/';
    const path = `${prefix}batches/${batchId}/extraction.csv`;
    await this.fileStorage.uploadBuffer(Buffer.from(csv, 'utf-8'), path);
    await this.outputRepo.upsert(batchId, path, records.length);
    this.logger.log('Output CSV generated', { batchId, path, rowCount: records.length });
    return path;
  }
}
