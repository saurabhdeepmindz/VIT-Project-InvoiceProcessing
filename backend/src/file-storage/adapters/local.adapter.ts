/**
 * @file   local.adapter.ts
 * @module FileStorage / Adapters
 *
 * @description
 * Local filesystem adapter (Windows / POSIX). All storagePath values
 * are treated as relative to LOCAL_STORAGE_PATH.
 *
 * @since 3.1.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IStorageAdapter } from '../file-storage.interface';
import type { AppLogger } from '../../common/logger/AppLogger';

export class LocalStorageAdapter implements IStorageAdapter {
  constructor(
    private readonly basePath: string,
    private readonly logger: AppLogger,
  ) {
    this.ensureBaseDirSync();
  }

  private ensureBaseDirSync(): void {
    // Fire-and-forget; any errors surface at first write.
    fs.mkdir(this.basePath, { recursive: true }).catch(err =>
      this.logger.warn('Could not pre-create storage base dir', { basePath: this.basePath, err: String(err) }),
    );
  }

  resolveAbsolute(storagePath: string): string {
    return path.join(this.basePath, this.normalize(storagePath));
  }

  async writeBuffer(storagePath: string, buffer: Buffer): Promise<void> {
    const abs = this.resolveAbsolute(storagePath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer);
  }

  async readBuffer(storagePath: string): Promise<Buffer> {
    const abs = this.resolveAbsolute(storagePath);
    return fs.readFile(abs);
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolveAbsolute(storagePath));
      return true;
    } catch {
      return false;
    }
  }

  async delete(storagePath: string): Promise<void> {
    const abs = this.resolveAbsolute(storagePath);
    await fs.rm(abs, { force: true });
  }

  async moveDirectory(sourcePrefix: string, destPrefix: string): Promise<void> {
    const src  = this.resolveAbsolute(sourcePrefix);
    const dest = this.resolveAbsolute(destPrefix);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest);
  }

  private normalize(p: string): string {
    // Convert POSIX-style prefixes (e.g. "batches/xyz/") to platform paths
    return p.replace(/\\/g, '/').replace(/^\/+/, '');
  }
}
