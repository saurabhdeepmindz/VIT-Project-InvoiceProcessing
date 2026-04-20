/**
 * @file   tracker.service.ts
 * @module Tracker (EPIC-005, v3.1)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { AppLogger } from '../../common/logger/AppLogger';
import { TrackerRepository, TrackerListRow, TrackerRecordRow } from '../repositories/tracker.repository';
import { AuditLogRepository } from '../../preprocessing/repositories/audit-log.repository';
import { DeadLetterService } from '../../dead-letter/dead-letter.service';
import type { FileStatusQueryDto, FileStatusListDto, FileStatusRowDto } from '../dto/file-status-list.dto';
import type { FileStatusDetailDto, TrackerAuditEntryDto, TrackerDlqEntryDto, TrackerRecordDto } from '../dto/file-status-detail.dto';

@Injectable()
export class TrackerService {
  constructor(
    private readonly tracker: TrackerRepository,
    private readonly audit: AuditLogRepository,
    private readonly dlq: DeadLetterService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('TrackerService');
  }

  async list(query: FileStatusQueryDto, userId: string | null): Promise<FileStatusListDto> {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.tracker.list({
      userId, skip, take: query.limit,
      status: query.status, from: query.from, to: query.to,
    });
    return {
      data: rows.map(TrackerService.toSummary),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async detail(batchId: string, userId: string | null): Promise<FileStatusDetailDto> {
    const row = await this.tracker.findOne(batchId, userId);
    if (!row) throw new NotFoundException(`batch ${batchId} not found`);

    const [records, auditRows, dlqRows] = await Promise.all([
      this.tracker.listRecords(batchId),
      this.audit.listByBatch(batchId, 50),
      this.dlq.listByBatch(batchId),
    ]);

    return {
      summary: TrackerService.toSummary(row),
      records: records.map(TrackerService.toRecordDto),
      auditTail: auditRows.slice(-50).map(a => ({
        action: a.action,
        actor: a.actor,
        recordId: a.record_id,
        payload: a.payload,
        createdAt: a.created_at.toISOString(),
      } satisfies TrackerAuditEntryDto)),
      dlq: dlqRows.map(d => ({
        id: d.id,
        recordId: d.recordId,
        failureStage: d.failureStage,
        errorCode: d.errorCode,
        errorMessage: d.errorMessage,
        attempts: d.attempts,
        createdAt: d.createdAt,
      } satisfies TrackerDlqEntryDto)),
    };
  }

  static toSummary(r: TrackerListRow): FileStatusRowDto {
    return {
      batchId: r.batch_id,
      fileName: r.file_name,
      uploadedAt: r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
      batchStatus: r.batch_status,
      batchSize: r.batch_size,
      preprocessingStatus: r.preprocessing_status,
      preprocessingDurationSec: r.preprocessing_duration_s,
      edaStatus: r.eda_status,
      edaDurationSec: r.eda_duration_s,
      totalRecords: r.total_records,
      processedRecords: r.processed_records,
      errorRecords: r.error_records,
      deadLetteredRecords: r.dead_lettered_records,
      avgConfidence: r.avg_confidence != null ? Number(r.avg_confidence) : null,
      turnaroundTimeSec: r.turnaround_time_s,
      outputCsvPath: r.output_csv_path,
    };
  }

  static toRecordDto(r: TrackerRecordRow): TrackerRecordDto {
    return {
      recordId: r.record_id,
      csvRowNumber: r.csv_row_number,
      sourceUrl: r.source_url,
      preprocessingStatus: r.preprocessing_status,
      edaStatus: r.eda_status,
      pageCount: r.page_count,
      confidenceScore: r.confidence_score != null ? Number(r.confidence_score) : null,
      extractionStatus: r.extraction_status,
      errorMessage: r.error_message,
      dealerName: r.dealer_name,
      customerName: r.customer_name,
      customerMobile: r.customer_mobile,
      vehicleRegistrationNumber: r.vehicle_registration_number,
      tyreSize: r.tyre_size,
      tyrePattern: r.tyre_pattern,
      invoiceAmountExclGst: r.invoice_amount_excl_gst,
      gstAmount: r.gst_amount,
      quantity: r.quantity,
      invoiceDate: r.invoice_date,
      invoiceNumber: r.invoice_number,
      comments: r.comments,
      llmProviderUsed: r.llm_provider_used,
    };
  }
}
