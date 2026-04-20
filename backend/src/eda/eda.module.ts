/**
 * @file   eda.module.ts
 * @module EDA (EPIC-004, v3.1)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import {
  InvoiceBatchEntity, InvoiceRecordEntity, ExtractionResultEntity,
  OutputFileEntity, ProcessingStatusEntity,
} from '../entities/Entities';

import { EdaController } from './controller/eda.controller';
import { EdaService } from './service/eda.service';
import { EdaScheduler } from './scheduler/eda.scheduler';
import { CsvOutputService } from './service/csv-output.service';
import { ExtractionResultRepository } from './repositories/extraction-result.repository';
import { OutputFileRepository } from './repositories/output-file.repository';
import { AppLogger } from '../common/logger/AppLogger';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceBatchEntity, InvoiceRecordEntity, ExtractionResultEntity,
      OutputFileEntity, ProcessingStatusEntity,
    ]),
    HttpModule.register({ timeout: 60_000, maxRedirects: 2 }),
  ],
  controllers: [EdaController],
  providers: [
    EdaService, EdaScheduler, CsvOutputService,
    ExtractionResultRepository, OutputFileRepository,
    AppLogger,
  ],
  exports: [EdaService],
})
export class EdaModule {}
