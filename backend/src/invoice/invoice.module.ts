/**
 * @file   invoice.module.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Wires the EPIC-002 components via dependency injection.
 *
 * @since 3.1.0
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  InvoiceBatchEntity,
  InvoiceRecordEntity,
  FileUploadEntity,
} from '../entities/Entities';

import { InvoiceController } from './controller/invoice.controller';
import { InvoiceService } from './service/invoice.service';
import { InvoiceValidator } from './invoice.validator';
import { InvoiceTransformer } from './invoice.transformer';
import { InvoiceBatchRepository } from './repositories/invoice-batch.repository';
import { InvoiceRecordRepository } from './repositories/invoice-record.repository';
import { FileUploadRepository } from './repositories/file-upload.repository';
import { AppLogger } from '../common/logger/AppLogger';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity,
    ]),
  ],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    InvoiceValidator,
    InvoiceTransformer,
    InvoiceBatchRepository,
    InvoiceRecordRepository,
    FileUploadRepository,
    AppLogger,
  ],
  exports: [InvoiceService],
})
export class InvoiceModule {}
