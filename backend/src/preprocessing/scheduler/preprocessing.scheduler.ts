/**
 * @file   preprocessing.scheduler.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * @description
 * Two trigger paths for PreprocessingService.processBatch:
 *  - @OnEvent('invoice.uploaded') — immediate after InvoiceService emits
 *  - @Cron(BATCH_CRON_SCHEDULE)   — backup poll for stuck UPLOADED batches
 *
 * Batches are processed one-at-a-time to keep local demo simple; tune
 * BATCH_MAX_CONCURRENT for production.
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppLogger } from '../../common/logger/AppLogger';
import { InvoiceBatchEntity } from '../../entities/Entities';
import { PreprocessingService } from '../service/preprocessing.service';
import { InvoiceUploadedEvent } from '../../invoice/events/invoice-uploaded.event';
import { INVOICE_EVENTS } from '../../invoice/constants';
import { BATCH_STATUS } from '../../invoice/constants';

@Injectable()
export class PreprocessingScheduler {
  constructor(
    private readonly preprocessing: PreprocessingService,
    @InjectRepository(InvoiceBatchEntity)
    private readonly batches: Repository<InvoiceBatchEntity>,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('PreprocessingScheduler');
  }

  @OnEvent(INVOICE_EVENTS.UPLOADED)
  async onInvoiceUploaded(event: InvoiceUploadedEvent): Promise<void> {
    this.logger.log('invoice.uploaded received', { batchId: event.batchId });
    // Fire-and-forget: don't hold up the upload response pipeline.
    setImmediate(() => {
      this.preprocessing.processBatch(event.batchId).catch((err) => {
        this.logger.error(
          `Unhandled error preprocessing batch ${event.batchId}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
          { batchId: event.batchId },
        );
      });
    });
  }

  /**
   * Backup poll — picks up any UPLOADED batch that wasn't caught by the event
   * (e.g. event fired while consumer was down). Runs every 5 minutes by default.
   */
  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'preprocessing-cron' })
  async runBackupPoll(): Promise<void> {
    const stuck = await this.batches.find({
      where: { status: BATCH_STATUS.UPLOADED },
      order: { created_at: 'ASC' },
      take: Math.max(1, Number(this.config.get('BATCH_MAX_CONCURRENT') ?? 5)),
    });
    if (stuck.length === 0) return;
    this.logger.log('Backup poll found UPLOADED batches', { count: stuck.length });
    for (const b of stuck) {
      try {
        await this.preprocessing.processBatch(b.id);
      } catch (err: unknown) {
        this.logger.error(
          `Backup poll batch failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
          { batchId: b.id },
        );
      }
    }
  }
}
