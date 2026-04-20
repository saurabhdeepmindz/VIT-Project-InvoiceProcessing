/**
 * @file   report-file.repository.ts
 * @module Reporting (EPIC-007)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportFileEntity } from '../../entities/Entities';

export interface NewReportFileInput {
  report_type: string;
  file_format: string;
  parameters: Record<string, string>;
  file_path: string;
  record_count: number;
  generated_by_user_id: string;
}

@Injectable()
export class ReportFileRepository {
  constructor(
    @InjectRepository(ReportFileEntity)
    private readonly repo: Repository<ReportFileEntity>,
  ) {}

  save(input: NewReportFileInput): Promise<ReportFileEntity> {
    return this.repo.save(this.repo.create(input));
  }

  findById(id: string, userId: string | null): Promise<ReportFileEntity | null> {
    const where = userId ? { id, generated_by_user_id: userId } : { id };
    return this.repo.findOne({ where });
  }

  list(opts: {
    skip: number; take: number; type?: string; userId: string | null;
  }): Promise<[ReportFileEntity[], number]> {
    const where: Record<string, string> = {};
    if (opts.type) where.report_type = opts.type;
    if (opts.userId) where.generated_by_user_id = opts.userId;
    return this.repo.findAndCount({
      where,
      order: { generated_at: 'DESC' },
      skip: opts.skip,
      take: opts.take,
    });
  }
}
