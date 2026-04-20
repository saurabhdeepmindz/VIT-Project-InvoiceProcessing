import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutputFileEntity } from '../../entities/Entities';

@Injectable()
export class OutputFileRepository {
  constructor(
    @InjectRepository(OutputFileEntity)
    private readonly repo: Repository<OutputFileEntity>,
  ) {}

  async upsert(batchId: string, filePath: string, recordCount: number): Promise<OutputFileEntity> {
    const existing = await this.repo.findOne({ where: { batch_id: batchId } });
    if (existing) {
      await this.repo.update({ batch_id: batchId }, { file_path: filePath, record_count: recordCount });
      return (await this.repo.findOne({ where: { batch_id: batchId } }))!;
    }
    return this.repo.save(this.repo.create({ batch_id: batchId, file_path: filePath, record_count: recordCount }));
  }

  findByBatch(batchId: string): Promise<OutputFileEntity | null> {
    return this.repo.findOne({ where: { batch_id: batchId } });
  }
}
