/**
 * @file   dead-letter.service.ts
 * @module DeadLetter (cross-cutting, v3.1)
 *
 * @description
 * Captures permanently-failed invoice records for offline review.
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { AppLogger } from '../common/logger/AppLogger';
import { DeadLetterRepository, EnqueueDlqInput } from './dead-letter.repository';
import { DeadLetterRecordDto } from './dto/dead-letter-record.dto';
import { DeadLetterRecordEntity } from '../entities/Entities';

@Injectable()
export class DeadLetterService {
  constructor(
    private readonly repo: DeadLetterRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('DeadLetterService');
  }

  async enqueue(input: EnqueueDlqInput): Promise<DeadLetterRecordEntity> {
    const row = await this.repo.enqueue(input);
    this.logger.warn('Record dead-lettered', {
      dlqId: row.id, batchId: input.batch_id, recordId: input.record_id ?? undefined,
      stage: input.failure_stage, attempts: input.attempts, errorCode: input.error_code ?? undefined,
    });
    return row;
  }

  async listByBatch(batchId: string): Promise<DeadLetterRecordDto[]> {
    const rows = await this.repo.listByBatch(batchId);
    return rows.map(r => this.toDto(r));
  }

  async countByBatch(batchId: string): Promise<number> {
    return this.repo.countByBatch(batchId);
  }

  private toDto(r: DeadLetterRecordEntity): DeadLetterRecordDto {
    return {
      id: r.id,
      batchId: r.batch_id,
      recordId: r.record_id,
      failureStage: r.failure_stage,
      errorCode: r.error_code,
      errorMessage: r.error_message,
      attempts: r.attempts,
      lastAttemptAt: r.last_attempt_at.toISOString(),
      retryEligible: r.retry_eligible,
      resolvedAt: r.resolved_at ? r.resolved_at.toISOString() : null,
      createdAt: r.created_at.toISOString(),
    };
  }
}
