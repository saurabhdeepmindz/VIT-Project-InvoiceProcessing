/**
 * @file   processing-status.repository.ts
 * @module Preprocessing
 *
 * @description
 * Upsert-oriented access to the processing_status table.
 * One row per batch — upserted by preprocessing (EPIC-003) and
 * extraction (EPIC-004).
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessingStatusEntity } from '../../entities/Entities';

export interface PreprocessingUpdate {
  preprocessing_status: string;
  preprocessing_start?: Date | null;
  preprocessing_end?: Date | null;
  preprocessing_duration_s?: number | null;
  total_records?: number;
  processed_records?: number;
  error_records?: number;
}

@Injectable()
export class ProcessingStatusRepository {
  constructor(
    @InjectRepository(ProcessingStatusEntity)
    private readonly repo: Repository<ProcessingStatusEntity>,
  ) {}

  findByBatch(batchId: string): Promise<ProcessingStatusEntity | null> {
    return this.repo.findOne({ where: { batch_id: batchId } });
  }

  async upsertPreprocessing(batchId: string, patch: PreprocessingUpdate): Promise<void> {
    const existing = await this.repo.findOne({ where: { batch_id: batchId } });
    if (existing) {
      await this.repo.update({ batch_id: batchId }, patch);
    } else {
      await this.repo.save(this.repo.create({
        batch_id: batchId,
        preprocessing_status: patch.preprocessing_status,
        preprocessing_start: patch.preprocessing_start ?? null,
        preprocessing_end: patch.preprocessing_end ?? null,
        preprocessing_duration_s: patch.preprocessing_duration_s ?? null,
        total_records: patch.total_records ?? 0,
        processed_records: patch.processed_records ?? 0,
        error_records: patch.error_records ?? 0,
      }));
    }
  }
}
