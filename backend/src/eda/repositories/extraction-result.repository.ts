/**
 * @file   extraction-result.repository.ts
 * @module EDA
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ExtractionResultEntity } from '../../entities/Entities';

export type PartialExtractionInput = Partial<ExtractionResultEntity> & { invoice_record_id: string };

@Injectable()
export class ExtractionResultRepository {
  constructor(
    @InjectRepository(ExtractionResultEntity)
    private readonly repo: Repository<ExtractionResultEntity>,
  ) {}

  async upsert(input: PartialExtractionInput): Promise<ExtractionResultEntity> {
    const existing = await this.repo.findOne({ where: { invoice_record_id: input.invoice_record_id } });
    if (existing) {
      await this.repo.update(
        { invoice_record_id: input.invoice_record_id },
        input as QueryDeepPartialEntity<ExtractionResultEntity>,
      );
      return (await this.repo.findOne({ where: { invoice_record_id: input.invoice_record_id } }))!;
    }
    return this.repo.save(this.repo.create(input));
  }

  findByBatch(batchId: string): Promise<ExtractionResultEntity[]> {
    return this.repo
      .createQueryBuilder('r')
      .innerJoin('invoice_records', 'ir', 'ir.id = r.invoice_record_id')
      .where('ir.batch_id = :batchId', { batchId })
      .orderBy('ir.csv_row_number', 'ASC')
      .getMany();
  }

  async averageConfidenceByBatch(batchId: string): Promise<number | null> {
    const row = await this.repo
      .createQueryBuilder('r')
      .select('AVG(r.confidence_score)', 'avg')
      .innerJoin('invoice_records', 'ir', 'ir.id = r.invoice_record_id')
      .where('ir.batch_id = :batchId', { batchId })
      .andWhere('r.confidence_score IS NOT NULL')
      .getRawOne<{ avg: string | null }>();
    return row?.avg ? Number(row.avg) : null;
  }
}
