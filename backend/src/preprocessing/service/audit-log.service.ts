/**
 * @file   audit-log.service.ts
 * @module Preprocessing (cross-cutting wrapper, v3.1)
 *
 * Thin helper around AuditLogRepository. Keeps call sites short and
 * swallows persistence errors so the main pipeline never fails because
 * of an audit write.
 */

import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/AppLogger';
import { AuditLogRepository } from '../repositories/audit-log.repository';

@Injectable()
export class AuditLogService {
  constructor(
    private readonly repo: AuditLogRepository,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('AuditLogService');
  }

  async log(
    action: string,
    opts: {
      batchId?: string | null;
      recordId?: string | null;
      actor?: string;
      payload?: Record<string, unknown> | null;
    } = {},
  ): Promise<void> {
    try {
      await this.repo.save({
        batch_id: opts.batchId ?? null,
        record_id: opts.recordId ?? null,
        action,
        actor: opts.actor ?? 'SYSTEM',
        payload: opts.payload ?? null,
      });
    } catch (err: unknown) {
      this.logger.warn('AuditLog persist failed — continuing', {
        action, error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
