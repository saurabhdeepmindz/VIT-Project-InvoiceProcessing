/**
 * @file   invoice.transformer.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Entity → DTO mappers. Keeps response shaping isolated from service logic.
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { InvoiceBatchEntity, ProcessingStatusEntity } from '../entities/Entities';
import { BatchResponseDto } from './dto/batch-response.dto';
import { BatchStatusDto } from './dto/batch-status.dto';
import {
  BatchListItemDto,
  BatchListResponseDto,
} from './dto/batch-list.dto';

@Injectable()
export class InvoiceTransformer {
  toBatchResponse(batch: InvoiceBatchEntity): BatchResponseDto {
    return {
      batchId: batch.id,
      totalRecords: batch.batch_size,
      status: 'UPLOADED',
      csvContentHash: batch.csv_content_hash,
      csvPath: batch.csv_path,
      createdAt: batch.created_at.toISOString(),
    };
  }

  toBatchStatus(batch: InvoiceBatchEntity, status?: ProcessingStatusEntity | null): BatchStatusDto {
    return {
      batchId: batch.id,
      status: batch.status,
      batchSize: batch.batch_size,
      createdAt: batch.created_at.toISOString(),
      updatedAt: batch.updated_at.toISOString(),
      preprocessingStatus: status?.preprocessing_status ?? null,
      edaStatus: status?.eda_status ?? null,
      totalRecords: status?.total_records ?? null,
      processedRecords: status?.processed_records ?? null,
      errorRecords: status?.error_records ?? null,
      avgConfidence: status?.avg_confidence ? Number(status.avg_confidence) : null,
    };
  }

  toBatchListResponse(
    rows: InvoiceBatchEntity[],
    total: number,
    page: number,
    limit: number,
  ): BatchListResponseDto {
    const data: BatchListItemDto[] = rows.map(b => ({
      batchId: b.id,
      status: b.status,
      batchSize: b.batch_size,
      createdAt: b.created_at.toISOString(),
    }));
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
