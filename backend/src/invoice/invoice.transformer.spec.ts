/**
 * @file   invoice.transformer.spec.ts
 */

import { InvoiceTransformer } from './invoice.transformer';
import { InvoiceBatchEntity, ProcessingStatusEntity } from '../entities/Entities';

describe('InvoiceTransformer', () => {
  const t = new InvoiceTransformer();

  const fixedDate = new Date('2026-04-20T10:00:00.000Z');

  const batch = {
    id: 'batch-uuid',
    user_id: 'user-uuid',
    csv_path: 'upload/batches/batch-uuid/test.csv',
    csv_content_hash: 'deadbeef',
    status: 'UPLOADED',
    batch_size: 3,
    created_at: fixedDate,
    updated_at: fixedDate,
  } as InvoiceBatchEntity;

  describe('toBatchResponse', () => {
    it('maps all fields', () => {
      const dto = t.toBatchResponse(batch);
      expect(dto).toEqual({
        batchId: 'batch-uuid',
        totalRecords: 3,
        status: 'UPLOADED',
        csvContentHash: 'deadbeef',
        csvPath: 'upload/batches/batch-uuid/test.csv',
        createdAt: fixedDate.toISOString(),
      });
    });
  });

  describe('toBatchStatus', () => {
    it('maps nullable processing_status as null when missing', () => {
      const dto = t.toBatchStatus(batch, null);
      expect(dto.preprocessingStatus).toBeNull();
      expect(dto.totalRecords).toBeNull();
      expect(dto.avgConfidence).toBeNull();
    });

    it('includes processing_status fields when present', () => {
      const status = {
        preprocessing_status: 'RUNNING',
        eda_status: 'PENDING',
        total_records: 3,
        processed_records: 1,
        error_records: 0,
        avg_confidence: '87.55',
      } as unknown as ProcessingStatusEntity;
      const dto = t.toBatchStatus(batch, status);
      expect(dto.preprocessingStatus).toBe('RUNNING');
      expect(dto.processedRecords).toBe(1);
      expect(dto.avgConfidence).toBe(87.55);  // converted from string to number
    });
  });

  describe('toBatchListResponse', () => {
    it('computes totalPages and maps rows', () => {
      const res = t.toBatchListResponse([batch, batch], 5, 1, 2);
      expect(res.total).toBe(5);
      expect(res.totalPages).toBe(3);
      expect(res.data).toHaveLength(2);
      expect(res.data[0]).toEqual({
        batchId: 'batch-uuid', status: 'UPLOADED', batchSize: 3, createdAt: fixedDate.toISOString(),
      });
    });
  });
});
