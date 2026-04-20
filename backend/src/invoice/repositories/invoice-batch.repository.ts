/**
 * @file   invoice-batch.repository.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Data-access layer for invoice_batches. Wraps TypeORM Repository and
 * hides query details from the service layer. Enables clean unit tests
 * via mocked repository instances.
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceBatchEntity } from '../../entities/Entities';

@Injectable()
export class InvoiceBatchRepository {
  constructor(
    @InjectRepository(InvoiceBatchEntity)
    private readonly repo: Repository<InvoiceBatchEntity>,
  ) {}

  findByCsvHash(csvContentHash: string): Promise<InvoiceBatchEntity | null> {
    return this.repo.findOne({ where: { csv_content_hash: csvContentHash } });
  }

  findById(id: string, userId?: string): Promise<InvoiceBatchEntity | null> {
    const where = userId ? { id, user_id: userId } : { id };
    return this.repo.findOne({ where });
  }

  async save(batch: Partial<InvoiceBatchEntity>): Promise<InvoiceBatchEntity> {
    return this.repo.save(this.repo.create(batch));
  }

  async listByUser(
    userId: string,
    opts: { skip: number; take: number; status?: string },
  ): Promise<[InvoiceBatchEntity[], number]> {
    const where = opts.status ? { user_id: userId, status: opts.status } : { user_id: userId };
    return this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: opts.skip,
      take: opts.take,
    });
  }
}
