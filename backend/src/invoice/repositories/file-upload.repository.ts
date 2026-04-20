/**
 * @file   file-upload.repository.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Data-access for file_uploads — tracks every physical file persisted
 * (CSV on upload, images when EPIC-003 fetches them).
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileUploadEntity } from '../../entities/Entities';

export type FileUploadSource = 'UPLOAD' | 'FETCHED' | 'GENERATED';

export interface NewFileUploadInput {
  batch_id: string;
  record_id?: string | null;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  source: FileUploadSource;
}

@Injectable()
export class FileUploadRepository {
  constructor(
    @InjectRepository(FileUploadEntity)
    private readonly repo: Repository<FileUploadEntity>,
  ) {}

  save(input: NewFileUploadInput): Promise<FileUploadEntity> {
    return this.repo.save(this.repo.create(input));
  }
}
