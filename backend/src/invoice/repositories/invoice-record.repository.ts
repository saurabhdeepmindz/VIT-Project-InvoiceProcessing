/**
 * @file   invoice-record.repository.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Data-access for invoice_records. Phase 1 uses bulk insert during batch
 * creation; subsequent phases update preprocessing_status and image_hash.
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceRecordEntity } from '../../entities/Entities';

export interface NewRecordInput {
  batch_id: string;
  source_url: string;
  csv_row_number: number;
  raw_csv_data: Record<string, string>;
}

@Injectable()
export class InvoiceRecordRepository {
  constructor(
    @InjectRepository(InvoiceRecordEntity)
    private readonly repo: Repository<InvoiceRecordEntity>,
  ) {}

  /** Bulk insert — preferred for batch ingestion performance. */
  async bulkInsert(records: NewRecordInput[]): Promise<void> {
    if (records.length === 0) return;
    await this.repo.insert(records);
  }

  countByBatch(batchId: string): Promise<number> {
    return this.repo.count({ where: { batch_id: batchId } });
  }

  findByBatch(batchId: string): Promise<InvoiceRecordEntity[]> {
    return this.repo.find({ where: { batch_id: batchId }, order: { csv_row_number: 'ASC' } });
  }
}
