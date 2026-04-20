/**
 * @file   reporting.service.ts
 * @module Reporting (EPIC-007, v3.1)
 *
 * Orchestrates report generation:
 *   1. Select builder by reportType
 *   2. Run builder to get rows
 *   3. Pass rows to CsvExporter or ExcelExporter
 *   4. Persist buffer via FileStorageService under REPORT_DIR_PATH
 *   5. Insert row in report_files
 */

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { AppLogger } from '../../common/logger/AppLogger';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { ReportFileRepository } from '../repositories/report-file.repository';
import { SingleFileReportBuilder } from '../builders/single-file.builder';
import { WeeklyReportBuilder } from '../builders/weekly.builder';
import { ErrorReportBuilder } from '../builders/error.builder';
import { CsvExporter } from './csv-exporter.service';
import { ExcelExporter } from './excel-exporter.service';
import {
  REPORT_TYPE, REPORT_FORMAT, SINGLE_FILE_COLUMNS, WEEKLY_COLUMNS, ERROR_COLUMNS,
  DEFAULT_LOW_CONFIDENCE_THRESHOLD,
} from '../constants';
import { ReportFileEntity } from '../../entities/Entities';
import type { GenerateReportDto, ReportListQueryDto } from '../dto/generate-report.dto';
import type { ReportFileDto, ReportListDto } from '../dto/report-file.dto';

@Injectable()
export class ReportingService {
  constructor(
    private readonly single: SingleFileReportBuilder,
    private readonly weekly: WeeklyReportBuilder,
    private readonly errorBuilder: ErrorReportBuilder,
    private readonly csv: CsvExporter,
    private readonly xlsx: ExcelExporter,
    private readonly storage: FileStorageService,
    private readonly repo: ReportFileRepository,
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('ReportingService');
  }

  async generate(dto: GenerateReportDto, userId: string, isAdmin: boolean): Promise<ReportFileDto> {
    const ownerScope = isAdmin ? null : userId;
    let rows: Record<string, unknown>[];
    let columns: readonly string[];
    let params: Record<string, string>;
    let confidenceColumnKey: string | undefined;

    switch (dto.reportType) {
      case REPORT_TYPE.SINGLE_FILE: {
        if (!dto.batchId) throw new BadRequestException('batchId is required for SINGLE_FILE');
        rows = (await this.single.build(dto.batchId, ownerScope)) as unknown as Record<string, unknown>[];
        columns = SINGLE_FILE_COLUMNS;
        params = { batchId: dto.batchId };
        confidenceColumnKey = 'confidence_score';
        break;
      }
      case REPORT_TYPE.WEEKLY: {
        const [from, to] = this.requireRange(dto);
        rows = await this.weekly.build(from, to, ownerScope) as unknown as Record<string, unknown>[];
        columns = WEEKLY_COLUMNS;
        params = { from: from.toISOString(), to: to.toISOString() };
        confidenceColumnKey = 'avg_confidence';
        break;
      }
      case REPORT_TYPE.ERROR: {
        const [from, to] = this.requireRange(dto);
        const threshold = dto.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE_THRESHOLD;
        rows = await this.errorBuilder.build(from, to, ownerScope, threshold) as unknown as Record<string, unknown>[];
        columns = ERROR_COLUMNS;
        params = { from: from.toISOString(), to: to.toISOString(), threshold: String(threshold) };
        confidenceColumnKey = 'confidence_score';
        break;
      }
      default:
        throw new BadRequestException(`Unknown reportType: ${dto.reportType}`);
    }

    const { buffer, ext } = dto.format === REPORT_FORMAT.XLSX
      ? { buffer: await this.xlsx.export(rows, columns, { sheetName: dto.reportType, confidenceColumnKey }), ext: 'xlsx' }
      : { buffer: this.csv.export(rows, columns), ext: 'csv' };

    const prefix = this.config.get<string>('REPORT_DIR_PATH') ?? 'reports/';
    const id = randomUUID();
    const filePath = `${prefix}${dto.reportType.toLowerCase()}/${id}.${ext}`;
    await this.storage.uploadBuffer(buffer, filePath);

    const saved = await this.repo.save({
      report_type: dto.reportType,
      file_format: dto.format,
      parameters: params,
      file_path: filePath,
      record_count: rows.length,
      generated_by_user_id: userId,
    });

    this.logger.log('Report generated', {
      id: saved.id, type: dto.reportType, format: dto.format, rows: rows.length, filePath,
    });

    return this.toDto(saved);
  }

  async list(query: ReportListQueryDto, userId: string, isAdmin: boolean): Promise<ReportListDto> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await this.repo.list({
      skip, take: query.limit, type: query.type, userId: isAdmin ? null : userId,
    });
    return {
      data: rows.map(r => this.toDto(r)),
      total, page: query.page, limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async getDownloadable(id: string, userId: string, isAdmin: boolean): Promise<{ bytes: Buffer; entity: ReportFileEntity }> {
    const entity = await this.repo.findById(id, isAdmin ? null : userId);
    if (!entity) throw new NotFoundException(`report ${id} not found`);
    const bytes = await this.storage.download(entity.file_path);
    return { bytes, entity };
  }

  private requireRange(dto: GenerateReportDto): [Date, Date] {
    if (!dto.from || !dto.to) {
      throw new BadRequestException(`from and to are required for ${dto.reportType}`);
    }
    return [new Date(dto.from), new Date(dto.to)];
  }

  private toDto(e: ReportFileEntity): ReportFileDto {
    return {
      id: e.id,
      reportType: e.report_type,
      fileFormat: e.file_format,
      filePath: e.file_path,
      recordCount: e.record_count,
      parameters: e.parameters,
      generatedByUserId: e.generated_by_user_id,
      generatedAt: e.generated_at.toISOString(),
    };
  }
}
