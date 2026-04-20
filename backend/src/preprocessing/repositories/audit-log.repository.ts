/**
 * @file   audit-log.repository.ts
 * @module Preprocessing
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../entities/Entities';

export interface AuditLogInput {
  batch_id: string | null;
  record_id: string | null;
  action: string;
  actor: string;
  payload: Record<string, unknown> | null;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  save(input: AuditLogInput): Promise<AuditLogEntity> {
    return this.repo.save(this.repo.create(input));
  }

  listByBatch(batchId: string, limit = 500): Promise<AuditLogEntity[]> {
    return this.repo.find({
      where: { batch_id: batchId },
      order: { created_at: 'ASC' },
      take: limit,
    });
  }
}
