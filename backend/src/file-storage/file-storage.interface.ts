/**
 * @file   file-storage.interface.ts
 * @module FileStorage
 *
 * @description
 * Interface contract for storage adapters. Implement once per backend
 * (local, S3, MinIO). FileStorageService picks the adapter at runtime
 * based on STORAGE_PROVIDER env.
 *
 * @since 3.1.0
 */

export interface IStorageAdapter {
  writeBuffer(storagePath: string, buffer: Buffer): Promise<void>;
  readBuffer(storagePath: string): Promise<Buffer>;
  exists(storagePath: string): Promise<boolean>;
  delete(storagePath: string): Promise<void>;
  moveDirectory(sourcePrefix: string, destPrefix: string): Promise<void>;
  resolveAbsolute(storagePath: string): string;
}
