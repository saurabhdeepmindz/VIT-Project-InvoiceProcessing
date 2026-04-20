/**
 * @file   invoice.service.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * CSV ingestion orchestrator (v3.1).
 *
 * Flow per upload:
 *  1. Validate file (size / MIME).
 *  2. Compute csv_content_hash (SHA-256 of raw bytes).
 *  3. If hash already in invoice_batches → throw DuplicateCsvException.
 *  4. Parse CSV + extract URLs + enforce host allowlist.
 *  5. Persist CSV to FileStorageService (upload/batches/{batchId}/filename.csv).
 *  6. Insert invoice_batch + bulk-insert invoice_records + file_uploads row.
 *  7. Emit invoice.uploaded event for EPIC-003 PreprocessingService.
 *
 * @since 3.1.0
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';

import { AppLogger } from '../../common/logger/AppLogger';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { DuplicateCsvException, FileValidationException } from '../../common/exceptions';
import { InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity, ProcessingStatusEntity } from '../../entities/Entities';

import { InvoiceBatchRepository } from '../repositories/invoice-batch.repository';
import { InvoiceValidator } from '../invoice.validator';
import { InvoiceTransformer } from '../invoice.transformer';
import { InvoiceUploadedEvent } from '../events/invoice-uploaded.event';
import {
  BATCH_STATUS,
  DEFAULT_MAX_CSV_SIZE_MB,
  INVOICE_EVENTS,
} from '../constants';

import type { IInvoiceService, UploadedCsvFile } from '../interfaces/invoice-service.interface';
import type { BatchResponseDto } from '../dto/batch-response.dto';
import type { BatchStatusDto } from '../dto/batch-status.dto';
import type { BatchListQueryDto, BatchListResponseDto } from '../dto/batch-list.dto';

@Injectable()
export class InvoiceService implements IInvoiceService {
  constructor(
    private readonly batchRepo: InvoiceBatchRepository,
    private readonly validator: InvoiceValidator,
    private readonly transformer: InvoiceTransformer,
    private readonly fileStorage: FileStorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.logger.setContext('InvoiceService');
  }

  async createBatchFromCsv(file: UploadedCsvFile, userId: string): Promise<BatchResponseDto> {
    const maxSizeMb = Number(this.config.get<string>('MAX_UPLOAD_SIZE_MB') ?? DEFAULT_MAX_CSV_SIZE_MB);
    this.validator.validateFile(file, maxSizeMb);

    // 2. content hash
    const csvContentHash = createHash('sha256').update(file.buffer).digest('hex');

    // 3. idempotency
    const existing = await this.batchRepo.findByCsvHash(csvContentHash);
    if (existing) {
      this.logger.warn('Duplicate CSV upload rejected', {
        csvContentHash, existingBatchId: existing.id, userId,
      });
      throw new DuplicateCsvException(csvContentHash, existing.id);
    }

    // 4. parse + validate URLs
    const allowlist = this.parseHostAllowlist();
    const parsed = this.validator.parseAndExtractUrls(file.buffer, allowlist);
    this.logger.log('CSV parsed', {
      rows: parsed.rows.length, detectedHeader: parsed.detectedHeader,
    });

    // 5. generate batchId up front so storage path is deterministic
    const batchId = randomUUID();
    const storagePath = this.buildCsvStoragePath(batchId, file.originalname);
    await this.fileStorage.uploadBuffer(file.buffer, storagePath);

    // 6. transactional insert — batch + records + file_uploads
    const batch = await this.dataSource.transaction(async (tx) => {
      const batchRepo = tx.getRepository(InvoiceBatchEntity);
      const recordRepo = tx.getRepository(InvoiceRecordEntity);
      const fileRepo = tx.getRepository(FileUploadEntity);

      const created = await batchRepo.save(batchRepo.create({
        id: batchId,
        user_id: userId,
        csv_path: storagePath,
        csv_content_hash: csvContentHash,
        status: BATCH_STATUS.UPLOADED,
        batch_size: parsed.rows.length,
      }));

      await recordRepo.insert(parsed.rows.map((r) => ({
        batch_id: created.id,
        source_url: r.url,
        csv_row_number: r.rowNumber,
        raw_csv_data: r.rawData,
      })));

      await fileRepo.save(fileRepo.create({
        batch_id: created.id,
        file_name: file.originalname,
        file_type: file.mimetype,
        file_size_bytes: file.size,
        storage_path: storagePath,
        source: 'UPLOAD',
      }));

      return created;
    });

    // 7. emit event (outside the TX)
    const event = new InvoiceUploadedEvent(batch.id, userId, parsed.rows.length, storagePath);
    this.eventEmitter.emit(INVOICE_EVENTS.UPLOADED, event);

    this.logger.audit({
      actor: userId,
      action: 'invoice.batch.uploaded',
      target: { type: 'invoice_batch', id: batch.id },
      metadata: { recordCount: parsed.rows.length, csvContentHash },
    });

    return this.transformer.toBatchResponse(batch);
  }

  async getBatchStatus(batchId: string, userId: string): Promise<BatchStatusDto> {
    const batch = await this.batchRepo.findById(batchId, userId);
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`);

    const status = await this.dataSource
      .getRepository(ProcessingStatusEntity)
      .findOne({ where: { batch_id: batchId } });

    return this.transformer.toBatchStatus(batch, status);
  }

  async listBatches(userId: string, query: BatchListQueryDto): Promise<BatchListResponseDto> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await this.batchRepo.listByUser(userId, {
      skip, take: query.limit, status: query.status,
    });
    return this.transformer.toBatchListResponse(rows, total, query.page, query.limit);
  }

  private parseHostAllowlist(): string[] {
    const raw = this.config.get<string>('IMG_URL_HOST_ALLOWLIST') ?? '*';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  private buildCsvStoragePath(batchId: string, originalName: string): string {
    const prefix = this.config.get<string>('UPLOAD_DIR_PATH') ?? 'upload/';
    const safeName = originalName.replace(/[^\w.-]+/g, '_');
    return `${prefix}batches/${batchId}/${safeName}`;
  }
}
