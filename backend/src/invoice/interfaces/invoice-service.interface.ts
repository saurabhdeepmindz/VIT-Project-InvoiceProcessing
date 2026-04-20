/**
 * @file   invoice-service.interface.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Contract for the invoice ingestion service. Allows consumers and tests
 * to depend on the interface rather than the concrete class.
 *
 * @since 3.1.0
 */

import type { BatchResponseDto } from '../dto/batch-response.dto';
import type { BatchStatusDto } from '../dto/batch-status.dto';
import type { BatchListQueryDto, BatchListResponseDto } from '../dto/batch-list.dto';

export interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface IInvoiceService {
  /**
   * Creates a batch from an uploaded CSV (URL manifest, v3.1 model).
   * @throws DuplicateCsvException on content-hash collision
   * @throws FileValidationException on size / MIME / structural errors
   * @throws BadRequestException on invalid URLs or unknown hosts
   */
  createBatchFromCsv(file: UploadedCsvFile, userId: string): Promise<BatchResponseDto>;

  getBatchStatus(batchId: string, userId: string): Promise<BatchStatusDto>;

  listBatches(userId: string, query: BatchListQueryDto): Promise<BatchListResponseDto>;
}
