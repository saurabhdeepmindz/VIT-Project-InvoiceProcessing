/**
 * @file   eda.controller.ts
 * @module EDA (EPIC-004, v3.1)
 *
 * Endpoints:
 *  GET    /eda/batches/:id/summary       — extraction counts + avg confidence
 *  GET    /eda/batches/:id/records       — extraction_results rows for the batch
 *  GET    /eda/batches/:id/output.csv    — download generated CSV
 *  POST   /eda/batches/:id/run           — admin: re-run EDA for a batch
 */

import {
  Controller, Get, Post, Param, ParseUUIDPipe, UseGuards, Res, HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileStorageService } from '../../file-storage/FileStorageService';
import { ExtractionResultRepository } from '../repositories/extraction-result.repository';
import { OutputFileRepository } from '../repositories/output-file.repository';
import { EdaService } from '../service/eda.service';
import { ExtractionResultDto, EdaBatchSummaryDto } from '../dto/extraction-result.dto';
import { ExtractionResultEntity, ProcessingStatusEntity, InvoiceRecordEntity } from '../../entities/Entities';

@ApiTags('eda')
@ApiBearerAuth()
@Controller('eda/batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EdaController {
  constructor(
    private readonly extractionRepo: ExtractionResultRepository,
    private readonly outputRepo: OutputFileRepository,
    private readonly fileStorage: FileStorageService,
    private readonly eda: EdaService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get(':batchId/summary')
  @Roles('INVOICE_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'EDA summary for a batch' })
  async summary(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<EdaBatchSummaryDto> {
    const status = await this.dataSource.getRepository(ProcessingStatusEntity).findOne({ where: { batch_id: batchId } });
    const results = await this.extractionRepo.findByBatch(batchId);
    const extracted = results.filter(r => r.extraction_status === 'EXTRACTED').length;
    const partial   = results.filter(r => r.extraction_status === 'PARTIAL').length;
    const failed    = results.filter(r => r.extraction_status === 'FAILED').length;
    const output    = await this.outputRepo.findByBatch(batchId);
    return {
      batchId,
      edaStatus: status?.eda_status ?? 'PENDING',
      totalRecords: results.length,
      extractedRecords: extracted,
      partialRecords: partial,
      failedRecords: failed,
      avgConfidence: status?.avg_confidence != null ? Number(status.avg_confidence) : null,
      outputCsvPath: output?.file_path ?? null,
    };
  }

  @Get(':batchId/records')
  @Roles('INVOICE_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'All extraction_results rows for a batch' })
  async records(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<ExtractionResultDto[]> {
    const rows = await this.extractionRepo.findByBatch(batchId);
    return rows.map(r => this.toDto(r));
  }

  @Get(':batchId/output.csv')
  @Roles('INVOICE_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Download generated CSV output for a batch' })
  async downloadCsv(@Param('batchId', ParseUUIDPipe) batchId: string, @Res() res: Response): Promise<void> {
    const out = await this.outputRepo.findByBatch(batchId);
    if (!out) throw new NotFoundException(`No output CSV for batch ${batchId}`);
    const bytes = await this.fileStorage.download(out.file_path);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-batch-${batchId}.csv"`);
    res.send(bytes);
  }

  @Post(':batchId/run')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-run EDA for a batch (admin)' })
  async run(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<{ batchId: string }> {
    // Reset eda_status on records so they get picked up again
    await this.dataSource.getRepository(InvoiceRecordEntity).update(
      { batch_id: batchId },
      { eda_status: 'PENDING', error_message: null },
    );
    setImmediate(() => this.eda.runForBatch(batchId).catch(() => undefined));
    return { batchId };
  }

  private toDto(r: ExtractionResultEntity): ExtractionResultDto {
    return {
      recordId: r.invoice_record_id,
      batchId: '',  // filled via join — left blank in this view
      extractionStatus: r.extraction_status,
      confidenceScore: r.confidence_score != null ? Number(r.confidence_score) : 0,
      llmProviderUsed: r.llm_provider_used,
      dealerName: r.dealer_name,
      customerName: r.customer_name,
      customerMobile: r.customer_mobile,
      vehicleRegistrationNumber: r.vehicle_registration_number,
      tyreSize: r.tyre_size,
      tyrePattern: r.tyre_pattern,
      invoiceAmountExclGst: r.invoice_amount_excl_gst != null ? String(r.invoice_amount_excl_gst) : null,
      gstAmount: r.gst_amount != null ? String(r.gst_amount) : null,
      quantity: r.quantity,
      invoiceDate: r.invoice_date,
      invoiceNumber: r.invoice_number,
      comments: r.comments,
      extractedAt: r.extracted_at ? r.extracted_at.toISOString() : '',
    };
  }
}
