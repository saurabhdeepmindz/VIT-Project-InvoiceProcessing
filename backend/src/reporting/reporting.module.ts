/**
 * @file   reporting.module.ts
 * @module Reporting (EPIC-007)
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportFileEntity } from '../entities/Entities';

import { ReportingController } from './controller/reporting.controller';
import { ReportingService } from './service/reporting.service';
import { CsvExporter } from './service/csv-exporter.service';
import { ExcelExporter } from './service/excel-exporter.service';
import { ReportFileRepository } from './repositories/report-file.repository';
import { SingleFileReportBuilder } from './builders/single-file.builder';
import { WeeklyReportBuilder } from './builders/weekly.builder';
import { ErrorReportBuilder } from './builders/error.builder';
import { AppLogger } from '../common/logger/AppLogger';

@Module({
  imports: [TypeOrmModule.forFeature([ReportFileEntity])],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    CsvExporter,
    ExcelExporter,
    ReportFileRepository,
    SingleFileReportBuilder,
    WeeklyReportBuilder,
    ErrorReportBuilder,
    AppLogger,
  ],
  exports: [ReportingService],
})
export class ReportingModule {}
