/**
 * @file   file-storage.module.ts
 * @module FileStorage
 *
 * @description
 * Global file-storage module. Exports FileStorageService for injection
 * into every EPIC module that needs storage access.
 *
 * @since 3.1.0
 */

import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './FileStorageService';
import { AppLogger } from '../common/logger/AppLogger';

@Global()
@Module({
  providers: [FileStorageService, AppLogger],
  exports: [FileStorageService],
})
export class FileStorageModule {}
