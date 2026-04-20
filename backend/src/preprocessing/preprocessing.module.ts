/**
 * @file   preprocessing.module.ts
 * @module Preprocessing (EPIC-003, v3.1)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity,
  ProcessingStatusEntity, AuditLogEntity,
} from '../entities/Entities';

import { PreprocessingController } from './controller/preprocessing.controller';
import { PreprocessingService } from './service/preprocessing.service';
import { PreprocessingScheduler } from './scheduler/preprocessing.scheduler';
import { ImageFetchService } from './service/image-fetch.service';
import { PdfInspectService } from './service/pdf-inspect.service';
import { AuditLogService } from './service/audit-log.service';

import { ProcessingStatusRepository } from './repositories/processing-status.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';

import { AppLogger } from '../common/logger/AppLogger';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity,
      ProcessingStatusEntity, AuditLogEntity,
    ]),
  ],
  controllers: [PreprocessingController],
  providers: [
    PreprocessingService,
    PreprocessingScheduler,
    ImageFetchService,
    PdfInspectService,
    AuditLogService,
    ProcessingStatusRepository,
    AuditLogRepository,
    AppLogger,
  ],
  exports: [
    PreprocessingService,
    ProcessingStatusRepository,
    AuditLogRepository,
  ],
})
export class PreprocessingModule {}
