/**
 * @file   eda.service.ts
 * @module EDA (EPIC-004, v3.1)
 *
 * Orchestrator for invoice field extraction.
 *
 * Per batch:
 *   1. Fetch all records with preprocessing_status=PROCESSED, eda_status=PENDING.
 *   2. For each record:
 *      a. Read bytes from storage via FileStorageService.
 *      b. POST to Python /eda/extract with base64-encoded bytes.
 *      c. Persist ExtractionResult to extraction_results table.
 *      d. Update invoice_records.eda_status.
 *   3. Generate per-batch CSV via CsvOutputService.
 *   4. Upsert processing_status.eda_* (status, timings, avg confidence, counts).
 *   5. Flip invoice_batches.status to DONE / PARTIAL / FAILED.
 *   6. Emit eda.completed / eda.partial / eda.failed.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { InjectDataSource } from '@nestjs/typeorm';
import { firstValueFrom, timeout, catchError, throwError } from 'rxjs';
import { AxiosError } from 'axios';

import { AppLogger } from '../../common/logger/AppLogger';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { DeadLetterService } from '../../dead-letter/dead-letter.service';
import {
  InvoiceBatchEntity, InvoiceRecordEntity, ExtractionResultEntity, ProcessingStatusEntity,
} from '../../entities/Entities';
import { BATCH_STATUS } from '../../invoice/constants';
import { RECORD_PP_STATUS } from '../../preprocessing/constants';

import { ExtractionResultRepository } from '../repositories/extraction-result.repository';
import { CsvOutputService } from './csv-output.service';
import { EdaCompletedEvent, EdaOutcome } from '../events/eda-completed.event';
import { BATCH_EDA_STATUS, EDA_EVENTS, RECORD_EDA_STATUS } from '../constants';
import type { LlmExtractResponse, LlmInvoiceFields } from '../interfaces/llm-extract-response.interface';

interface EdaOutcomePerRecord {
  recordId: string;
  success: boolean;
  confidence: number | null;
}

@Injectable()
export class EdaService {
  constructor(
    private readonly http: HttpService,
    private readonly fileStorage: FileStorageService,
    private readonly extractionRepo: ExtractionResultRepository,
    private readonly csvOutput: CsvOutputService,
    private readonly dlq: DeadLetterService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.logger.setContext('EdaService');
  }

  async runForBatch(batchId: string): Promise<void> {
    const batchRepo = this.dataSource.getRepository(InvoiceBatchEntity);
    const recordRepo = this.dataSource.getRepository(InvoiceRecordEntity);
    const statusRepo = this.dataSource.getRepository(ProcessingStatusEntity);

    const batch = await batchRepo.findOne({ where: { id: batchId } });
    if (!batch) {
      this.logger.warn('runForBatch: batch not found', { batchId });
      return;
    }

    const eligible = await recordRepo.find({
      where: {
        batch_id: batchId,
        preprocessing_status: RECORD_PP_STATUS.PROCESSED,
        eda_status: In([RECORD_EDA_STATUS.PENDING, RECORD_EDA_STATUS.FAILED]),
      },
      order: { csv_row_number: 'ASC' },
    });

    if (eligible.length === 0) {
      this.logger.log('runForBatch: nothing to extract', { batchId });
      return;
    }

    const startedAt = new Date();
    await this.patchStatus(statusRepo, batchId, {
      eda_status: BATCH_EDA_STATUS.RUNNING,
      eda_start: startedAt,
    });
    await batchRepo.update({ id: batchId }, { status: BATCH_STATUS.EDA_PROCESSING });
    this.logger.log('EDA started', { batchId, records: eligible.length });

    const concurrency = Math.max(1, Number(this.config.get('BATCH_MAX_CONCURRENT') ?? 3));
    const outcomes = await this.runWithConcurrency(eligible, concurrency, (r) => this.processRecord(r));

    const extracted = outcomes.filter(o => o.success).length;
    const failed = outcomes.length - extracted;
    const avgConfidence = this.computeAvg(outcomes.filter(o => o.success).map(o => o.confidence ?? 0));

    // Collect results for CSV generation
    const allRecords = await recordRepo.find({ where: { batch_id: batchId }, order: { csv_row_number: 'ASC' } });
    const allResults = await this.extractionRepo.findByBatch(batchId);
    const byRecordId = new Map(allResults.map(r => [r.invoice_record_id, r]));
    const rows = allRecords.map(r => ({ record: r, result: byRecordId.get(r.id) ?? null }));
    const csvPath = await this.csvOutput.generate(batchId, rows);

    const endedAt = new Date();
    const durationS = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    const outcome: EdaOutcome = failed === 0 ? 'DONE' : extracted === 0 ? 'FAILED' : 'PARTIAL';
    const edaBatchStatus =
      outcome === 'DONE' ? BATCH_EDA_STATUS.DONE :
      outcome === 'FAILED' ? BATCH_EDA_STATUS.FAILED : BATCH_EDA_STATUS.PARTIAL;
    const newBatchStatus =
      outcome === 'DONE' ? BATCH_STATUS.DONE :
      outcome === 'FAILED' ? BATCH_STATUS.FAILED : BATCH_STATUS.PARTIAL;

    await this.patchStatus(statusRepo, batchId, {
      eda_status: edaBatchStatus,
      eda_end: endedAt,
      eda_duration_s: durationS,
      avg_confidence: avgConfidence != null ? avgConfidence.toFixed(2) : null,
      turnaround_time_s: Math.max(0, Math.round((endedAt.getTime() - batch.created_at.getTime()) / 1000)),
    });
    await batchRepo.update({ id: batchId }, { status: newBatchStatus });

    const ev = new EdaCompletedEvent(batchId, outcome, eligible.length, extracted, failed, avgConfidence, csvPath);
    const eventName =
      outcome === 'DONE' ? EDA_EVENTS.COMPLETED :
      outcome === 'FAILED' ? EDA_EVENTS.FAILED : EDA_EVENTS.PARTIAL;
    this.eventEmitter.emit(eventName, ev);

    this.logger.log('EDA ended', { batchId, outcome, extracted, failed, avgConfidence, csvPath });
  }

  private async processRecord(record: InvoiceRecordEntity): Promise<EdaOutcomePerRecord> {
    const recordRepo = this.dataSource.getRepository(InvoiceRecordEntity);
    await recordRepo.update({ id: record.id }, { eda_status: RECORD_EDA_STATUS.PROCESSING, error_message: null });

    try {
      if (!record.image_path) throw new Error(`image_path is null for record ${record.id}`);
      const bytes = await this.fileStorage.download(record.image_path);
      const mime = this.mimeFromPath(record.image_path);

      const resp = await this.callPython(record.id, bytes, mime);

      const newStatus =
        resp.status === 'EXTRACTED' ? RECORD_EDA_STATUS.EXTRACTED :
        resp.status === 'PARTIAL'   ? RECORD_EDA_STATUS.PARTIAL :
                                      RECORD_EDA_STATUS.FAILED;

      await this.extractionRepo.upsert({
        invoice_record_id: record.id,
        ...this.fieldsToEntity(resp.fields),
        confidence_score: this.clampConfidence(resp.confidence_score),
        llm_provider_used: resp.llm_provider_used,
        extraction_status: newStatus,
        raw_llm_response: resp.raw_llm_response,
        ocr_text: resp.ocr_text,
      });

      await recordRepo.update({ id: record.id }, {
        eda_status: newStatus,
        error_message: resp.status === 'FAILED' ? resp.error_message ?? 'extraction failed' : null,
      });

      return { recordId: record.id, success: resp.status !== 'FAILED', confidence: resp.confidence_score };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await recordRepo.update({ id: record.id }, { eda_status: RECORD_EDA_STATUS.DEAD_LETTERED, error_message: message });
      await this.dlq.enqueue({
        batch_id: record.batch_id, record_id: record.id,
        failure_stage: err instanceof AxiosError ? 'LLM' : 'OCR',
        error_code: 'EDA_PIPELINE_ERROR', error_message: message,
        attempts: 1,
      });
      this.logger.warn('EDA record failed', { recordId: record.id, message });
      return { recordId: record.id, success: false, confidence: null };
    }
  }

  private async callPython(recordId: string, bytes: Buffer, mimeType: string): Promise<LlmExtractResponse> {
    const url = `${this.config.get<string>('PYTHON_AI_SERVICE_URL') ?? 'http://localhost:8001'}/eda/extract`;
    const timeoutMs = Number(this.config.get('PYTHON_AI_SERVICE_TIMEOUT_MS') ?? 60_000);
    const body = {
      record_id: recordId,
      image_b64: bytes.toString('base64'),
      mime_type: mimeType,
    };
    const obs = this.http.post<LlmExtractResponse>(url, body).pipe(
      timeout(timeoutMs),
      catchError((err: AxiosError) => {
        const msg = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message;
        return throwError(() => new Error(`Python /eda/extract failed: ${msg}`));
      }),
    );
    const res = await firstValueFrom(obs);
    return res.data;
  }

  private fieldsToEntity(fields: LlmInvoiceFields | null): Partial<ExtractionResultEntity> {
    if (!fields) return {};
    return {
      dealer_name: fields.dealer_name,
      customer_name: fields.customer_name,
      customer_mobile: fields.customer_mobile,
      vehicle_registration_number: fields.vehicle_registration_number,
      tyre_size: fields.tyre_size,
      tyre_pattern: fields.tyre_pattern,
      invoice_amount_excl_gst: fields.invoice_amount_excl_gst,
      gst_amount: fields.gst_amount,
      gst_components: fields.gst_components,
      quantity: fields.quantity,
      invoice_date: fields.invoice_date,
      invoice_number: fields.invoice_number,
      comments: fields.comments,
    };
  }

  private mimeFromPath(path: string): string {
    const lower = path.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.png')) return 'image/png';
    return 'image/jpeg';
  }

  private clampConfidence(v: number): string {
    const n = Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
    return n.toFixed(2);
  }

  private computeAvg(scores: number[]): number | null {
    if (scores.length === 0) return null;
    const sum = scores.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    return Number((sum / scores.length).toFixed(2));
  }

  private async patchStatus(
    statusRepo: Repository<ProcessingStatusEntity>,
    batchId: string,
    patch: QueryDeepPartialEntity<ProcessingStatusEntity>,
  ): Promise<void> {
    const existing = await statusRepo.findOne({ where: { batch_id: batchId } });
    if (existing) {
      await statusRepo.update({ batch_id: batchId }, patch);
    } else {
      await statusRepo.save(statusRepo.create({ batch_id: batchId, ...(patch as Partial<ProcessingStatusEntity>) }));
    }
  }

  private async runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await worker(items[i]);
      }
    });
    await Promise.all(runners);
    return results;
  }
}
