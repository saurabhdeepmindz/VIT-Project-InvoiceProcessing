/**
 * @file   FileStorageService.ts
 * @module FileStorage
 *
 * @description
 * Pluggable file storage service. Picks local / S3 / MinIO adapter at
 * construction time based on STORAGE_PROVIDER env. For the demo we
 * default to local (Windows filesystem).
 *
 * EPIC: Cross-cutting — EPIC-002, EPIC-003, EPIC-004, EPIC-007
 *
 * @since 3.1.0
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppLogger } from '../common/logger/AppLogger';
import { StorageException } from '../common/exceptions';
import { LocalStorageAdapter } from './adapters/local.adapter';
import type { IStorageAdapter } from './file-storage.interface';

/**
 * Minimal structural type matching the subset of Multer.File we consume.
 * Kept local to avoid a hard @types/multer dependency in Phase 0.
 * Matches the Express.Multer.File shape used by @nestjs/platform-express.
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class FileStorageService implements OnModuleInit {
  private adapter!: IStorageAdapter;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('FileStorageService');
  }

  onModuleInit(): void {
    const provider = this.config.get<string>('STORAGE_PROVIDER') ?? 'local';
    switch (provider) {
      case 'local':
        this.adapter = new LocalStorageAdapter(
          this.config.get<string>('LOCAL_STORAGE_PATH') ?? 'D:/invoice-processing-data/storage',
          this.logger,
        );
        break;
      case 's3':
      case 'minio':
        throw new Error(`Storage provider '${provider}' not yet implemented — use STORAGE_PROVIDER=local for demo`);
      default:
        throw new Error(`Unknown STORAGE_PROVIDER '${provider}'`);
    }
    this.logger.log(`FileStorageService initialised`, { provider });
  }

  /** Uploads a Multer-shaped file under the given prefix. */
  async upload(file: UploadedFile, prefix: string): Promise<string> {
    const key = this.joinKey(prefix, file.originalname);
    try {
      await this.adapter.writeBuffer(key, file.buffer);
      this.logger.log('File uploaded', { key, size: file.size });
      return key;
    } catch (err: unknown) {
      throw new StorageException('upload', key, err instanceof Error ? err.message : String(err));
    }
  }

  /** Uploads a raw Buffer at the exact storagePath. */
  async uploadBuffer(buffer: Buffer, storagePath: string): Promise<string> {
    try {
      await this.adapter.writeBuffer(storagePath, buffer);
      this.logger.log('Buffer uploaded', { storagePath, size: buffer.length });
      return storagePath;
    } catch (err: unknown) {
      throw new StorageException('uploadBuffer', storagePath, err instanceof Error ? err.message : String(err));
    }
  }

  async download(storagePath: string): Promise<Buffer> {
    try {
      return await this.adapter.readBuffer(storagePath);
    } catch (err: unknown) {
      throw new StorageException('download', storagePath, err instanceof Error ? err.message : String(err));
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    return this.adapter.exists(storagePath);
  }

  async moveDirectory(sourcePrefix: string, destPrefix: string): Promise<void> {
    try {
      await this.adapter.moveDirectory(sourcePrefix, destPrefix);
      this.logger.log('Directory moved', { from: sourcePrefix, to: destPrefix });
    } catch (err: unknown) {
      throw new StorageException('moveDirectory', `${sourcePrefix}→${destPrefix}`, err instanceof Error ? err.message : String(err));
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await this.adapter.delete(storagePath);
    } catch (err: unknown) {
      throw new StorageException('delete', storagePath, err instanceof Error ? err.message : String(err));
    }
  }

  /** Returns the absolute path on disk (only meaningful for local adapter). */
  resolveAbsolute(storagePath: string): string {
    return this.adapter.resolveAbsolute(storagePath);
  }

  private joinKey(prefix: string, name: string): string {
    const cleanPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    return `${cleanPrefix}${name}`;
  }
}
