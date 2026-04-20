/**
 * @file   eda.scheduler.ts
 * @module EDA (EPIC-004, v3.1)
 *
 * Listens for preprocessing.completed / preprocessing.partial and kicks off
 * the EDA pipeline for the batch. Backup cron polls for any batches that
 * slipped through.
 */

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AppLogger } from '../../common/logger/AppLogger';
import { InvoiceBatchEntity } from '../../entities/Entities';
import { EdaService } from '../service/eda.service';
import { PREPROCESSING_EVENTS } from '../../preprocessing/constants';
import { BATCH_STATUS } from '../../invoice/constants';
import type { PreprocessingCompletedEvent } from '../../preprocessing/events/preprocessing-completed.event';

@Injectable()
export class EdaScheduler {
  constructor(
    private readonly eda: EdaService,
    @InjectRepository(InvoiceBatchEntity)
    private readonly batches: Repository<InvoiceBatchEntity>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('EdaScheduler');
  }

  @OnEvent(PREPROCESSING_EVENTS.COMPLETED)
  @OnEvent(PREPROCESSING_EVENTS.PARTIAL)
  onPreprocessingCompleted(event: PreprocessingCompletedEvent): void {
    this.logger.log('preprocessing.completed received', { batchId: event.batchId, outcome: event.outcome });
    setImmediate(() => {
      this.eda.runForBatch(event.batchId).catch((err) => {
        this.logger.error(
          `EDA run failed for ${event.batchId}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
          { batchId: event.batchId },
        );
      });
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'eda-cron' })
  async runBackupPoll(): Promise<void> {
    const stuck = await this.batches.find({
      where: { status: In([BATCH_STATUS.PREPROCESSED, BATCH_STATUS.PARTIAL]) },
      order: { created_at: 'ASC' },
      take: 3,
    });
    if (stuck.length === 0) return;
    this.logger.log('Backup poll found PREPROCESSED batches awaiting EDA', { count: stuck.length });
    for (const b of stuck) {
      try {
        await this.eda.runForBatch(b.id);
      } catch (err: unknown) {
        this.logger.error(
          `Backup poll EDA failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
          { batchId: b.id },
        );
      }
    }
  }
}
