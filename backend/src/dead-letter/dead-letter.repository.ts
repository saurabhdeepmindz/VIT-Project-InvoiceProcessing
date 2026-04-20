/**
 * @file   dead-letter.repository.ts
 * @module DeadLetter (cross-cutting, v3.1)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeadLetterRecordEntity, FailureStage } from '../entities/Entities';

export interface EnqueueDlqInput {
  batch_id: string;
  record_id: string | null;
  failure_stage: FailureStage;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
}

@Injectable()
export class DeadLetterRepository {
  constructor(
    @InjectRepository(DeadLetterRecordEntity)
    private readonly repo: Repository<DeadLetterRecordEntity>,
  ) {}

  enqueue(input: EnqueueDlqInput): Promise<DeadLetterRecordEntity> {
    return this.repo.save(this.repo.create({
      ...input,
      last_attempt_at: new Date(),
      retry_eligible: true,
    }));
  }

  async listByBatch(batchId: string): Promise<DeadLetterRecordEntity[]> {
    return this.repo.find({ where: { batch_id: batchId }, order: { created_at: 'DESC' } });
  }

  async listEligible(limit = 50): Promise<DeadLetterRecordEntity[]> {
    return this.repo
      .createQueryBuilder('d')
      .where('d.retry_eligible = TRUE AND d.resolved_at IS NULL')
      .orderBy('d.last_attempt_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  async findById(id: string): Promise<DeadLetterRecordEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async markResolved(id: string): Promise<void> {
    await this.repo.update(id, { resolved_at: new Date(), retry_eligible: false });
  }

  async markIneligible(id: string): Promise<void> {
    await this.repo.update(id, { retry_eligible: false });
  }

  countByBatch(batchId: string): Promise<number> {
    return this.repo.count({ where: { batch_id: batchId } });
  }
}
