/**
 * @file   preprocessing.service.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * @description
 * Orchestrates per-record download → inspect (PDF) → dedup → persist.
 *
 * Pipeline per invoice_record:
 *   1. ImageFetchService.fetch(source_url)    → bytes + sha256
 *   2. Dedup: if sha256 already seen for a PROCESSED record, copy its image_path + page_count
 *   3. PdfInspectService.inspect(bytes)       → page_count
 *   4. FileStorageService.uploadBuffer(...)   → persist to processed/ prefix
 *   5. Update invoice_records row: image_path, image_hash, page_count, preprocessing_status
 *
 * Per batch:
 *   - Upserts processing_status (RUNNING → DONE | PARTIAL | FAILED)
 *   - Emits preprocessing.completed / .partial / .failed
 *   - Audit log entries throughout
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, In } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as path from 'node:path';

import { AppLogger } from '../../common/logger/AppLogger';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { DeadLetterService } from '../../dead-letter/dead-letter.service';
import {
  InvoiceRecordEntity, InvoiceBatchEntity, FileUploadEntity,
} from '../../entities/Entities';

import { ImageFetchService, FetchResult } from './image-fetch.service';
import { PdfInspectService } from './pdf-inspect.service';
import { AuditLogService } from './audit-log.service';
import { ProcessingStatusRepository } from '../repositories/processing-status.repository';
import { PreprocessingCompletedEvent, PreprocessingOutcome } from '../events/preprocessing-completed.event';
import {
  AUDIT_ACTIONS, BATCH_PP_STATUS, PREPROCESSING_EVENTS, RECORD_PP_STATUS,
  DEFAULT_FETCH_CONCURRENCY,
} from '../constants';
import { BATCH_STATUS } from '../../invoice/constants';

interface RecordOutcome {
  recordId: string;
  success: boolean;
}

@Injectable()
export class PreprocessingService {
  constructor(
    private readonly imageFetch: ImageFetchService,
    private readonly pdfInspect: PdfInspectService,
    private readonly fileStorage: FileStorageService,
    private readonly statusRepo: ProcessingStatusRepository,
    private readonly audit: AuditLogService,
    private readonly dlq: DeadLetterService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.logger.setContext('PreprocessingService');
  }

  /**
   * Processes a whole batch. Idempotent: records already processed are skipped.
   */
  async processBatch(batchId: string): Promise<void> {
    const batchRepo  = this.dataSource.getRepository(InvoiceBatchEntity);
    const recordRepo = this.dataSource.getRepository(InvoiceRecordEntity);

    const batch = await batchRepo.findOne({ where: { id: batchId } });
    if (!batch) {
      this.logger.warn('processBatch: batch not found', { batchId });
      return;
    }
    if (batch.status === BATCH_STATUS.PREPROCESSED || batch.status === BATCH_STATUS.DONE) {
      this.logger.log('processBatch: already preprocessed, skipping', { batchId });
      return;
    }

    const pending = await recordRepo.find({
      where: { batch_id: batchId, preprocessing_status: In([RECORD_PP_STATUS.PENDING, RECORD_PP_STATUS.ERROR]) },
      order: { csv_row_number: 'ASC' },
    });

    const startedAt = new Date();
    await this.statusRepo.upsertPreprocessing(batchId, {
      preprocessing_status: BATCH_PP_STATUS.RUNNING,
      preprocessing_start: startedAt,
      total_records: pending.length,
      processed_records: 0,
      error_records: 0,
    });
    await batchRepo.update({ id: batchId }, { status: BATCH_STATUS.PREPROCESSING });
    await this.audit.log(AUDIT_ACTIONS.BATCH_PREPROCESSING_STARTED, {
      batchId, payload: { pendingRecords: pending.length },
    });
    this.logger.log('Preprocessing started', { batchId, pending: pending.length });

    const concurrency = Math.max(1, Number(this.config.get('BATCH_MAX_CONCURRENT') ?? DEFAULT_FETCH_CONCURRENCY));
    const outcomes = await this.runWithConcurrency(pending, concurrency, (r) => this.processRecord(r));

    const processed = outcomes.filter(o => o.success).length;
    const failed    = outcomes.length - processed;
    const endedAt   = new Date();
    const durationS = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));

    const outcome: PreprocessingOutcome =
      failed === 0 ? 'DONE' : processed === 0 ? 'FAILED' : 'PARTIAL';
    const ppStatus =
      outcome === 'DONE' ? BATCH_PP_STATUS.DONE :
      outcome === 'FAILED' ? BATCH_PP_STATUS.FAILED : BATCH_PP_STATUS.PARTIAL;
    const batchStatus =
      outcome === 'DONE' ? BATCH_STATUS.PREPROCESSED :
      outcome === 'FAILED' ? BATCH_STATUS.FAILED : BATCH_STATUS.PARTIAL;

    await this.statusRepo.upsertPreprocessing(batchId, {
      preprocessing_status: ppStatus,
      preprocessing_end: endedAt,
      preprocessing_duration_s: durationS,
      processed_records: processed,
      error_records: failed,
    });
    await batchRepo.update({ id: batchId }, { status: batchStatus });

    await this.audit.log(AUDIT_ACTIONS.BATCH_PREPROCESSING_COMPLETED, {
      batchId, payload: { outcome, processed, failed, durationS },
    });

    const event = new PreprocessingCompletedEvent(batchId, outcome, pending.length, processed, failed);
    const eventName =
      outcome === 'DONE' ? PREPROCESSING_EVENTS.COMPLETED :
      outcome === 'FAILED' ? PREPROCESSING_EVENTS.FAILED : PREPROCESSING_EVENTS.PARTIAL;
    this.eventEmitter.emit(eventName, event);

    this.logger.log('Preprocessing ended', { batchId, outcome, processed, failed, durationS });
  }

  /** Per-record orchestration. Returns success flag; never throws. */
  private async processRecord(record: InvoiceRecordEntity): Promise<RecordOutcome> {
    const recordRepo = this.dataSource.getRepository(InvoiceRecordEntity);
    const fileRepo   = this.dataSource.getRepository(FileUploadEntity);

    await recordRepo.update({ id: record.id }, {
      preprocessing_status: RECORD_PP_STATUS.PROCESSING, error_message: null,
    });

    try {
      const fetch: FetchResult = await this.imageFetch.fetch(record.source_url);

      // Dedup — same image hash already processed on another record?
      const duplicate = await recordRepo.findOne({
        where: { image_hash: fetch.sha256, preprocessing_status: RECORD_PP_STATUS.PROCESSED },
      });
      if (duplicate) {
        await recordRepo.update({ id: record.id }, {
          image_path: duplicate.image_path,
          image_hash: fetch.sha256,
          page_count: duplicate.page_count,
          preprocessing_status: RECORD_PP_STATUS.PROCESSED,
        });
        await this.audit.log(AUDIT_ACTIONS.RECORD_DEDUPED, {
          batchId: record.batch_id, recordId: record.id,
          payload: { sha256: fetch.sha256, reusedRecordId: duplicate.id },
        });
        return { recordId: record.id, success: true };
      }

      // Inspect PDF (page count)
      const inspect = await this.pdfInspect.inspect(fetch.bytes);

      // Persist under processed/ prefix
      const prefix = this.config.get<string>('PROCESSED_DIR_PATH') ?? 'processed/';
      const ext = this.pickExtension(record.source_url, fetch.contentType, inspect.isPdf);
      const storagePath = `${prefix}batches/${record.batch_id}/${record.id}${ext}`;
      await this.fileStorage.uploadBuffer(fetch.bytes, storagePath);

      await recordRepo.update({ id: record.id }, {
        image_path: storagePath,
        image_hash: fetch.sha256,
        page_count: inspect.pageCount,
        preprocessing_status: RECORD_PP_STATUS.PROCESSED,
      });

      await fileRepo.save(fileRepo.create({
        batch_id: record.batch_id,
        record_id: record.id,
        file_name: path.basename(storagePath),
        file_type: fetch.contentType ?? 'application/octet-stream',
        file_size_bytes: fetch.sizeBytes,
        storage_path: storagePath,
        source: 'FETCHED',
      }));

      await this.audit.log(AUDIT_ACTIONS.RECORD_FETCHED, {
        batchId: record.batch_id, recordId: record.id,
        payload: {
          url: record.source_url, sizeBytes: fetch.sizeBytes,
          contentType: fetch.contentType, pageCount: inspect.pageCount, attempts: fetch.attempts,
        },
      });
      return { recordId: record.id, success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const code = this.extractErrorCode(err);

      await recordRepo.update({ id: record.id }, {
        preprocessing_status: RECORD_PP_STATUS.DEAD_LETTERED,
        error_message: message,
      });
      await this.dlq.enqueue({
        batch_id: record.batch_id, record_id: record.id,
        failure_stage: code === 'PDF_CONVERSION_ERROR' ? 'PDF_CONVERT' : 'FETCH',
        error_code: code, error_message: message,
        attempts: this.maxAttempts(),
      });
      await this.audit.log(AUDIT_ACTIONS.RECORD_DEAD_LETTERED, {
        batchId: record.batch_id, recordId: record.id,
        payload: { error: message, code, url: record.source_url },
      });
      this.logger.warn('Record dead-lettered', { recordId: record.id, code, message });
      return { recordId: record.id, success: false };
    }
  }

  private pickExtension(url: string, contentType: string | null, isPdf: boolean): string {
    if (isPdf) return '.pdf';
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.png')) return '.png';
    if (lowerUrl.includes('.jpeg') || lowerUrl.includes('.jpg')) return '.jpg';
    if (contentType?.includes('png')) return '.png';
    if (contentType?.includes('jpeg')) return '.jpg';
    return '.bin';
  }

  private extractErrorCode(err: unknown): string {
    const e = err as { response?: { error?: string }; constructor?: { name?: string } };
    return e?.response?.error ?? e?.constructor?.name ?? 'UNKNOWN_ERROR';
  }

  private maxAttempts(): number {
    return Math.max(1, Number(this.config.get('IMG_DOWNLOAD_RETRY') ?? 3) + 1);
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
