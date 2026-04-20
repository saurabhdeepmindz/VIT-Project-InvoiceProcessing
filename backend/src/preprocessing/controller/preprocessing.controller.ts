/**
 * @file   preprocessing.controller.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * Endpoints:
 *  GET /preprocessing/batches/:id          — processing_status view
 *  GET /preprocessing/batches/:id/audit    — audit log
 *  GET /preprocessing/batches/:id/dlq      — dead-letter entries
 *  POST /preprocessing/batches/:id/retry   — admin: re-queue a batch (wipes error records to PENDING)
 */

import {
  Controller, Get, Post, Param, ParseUUIDPipe, UseGuards, NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { In } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProcessingStatusRepository } from '../repositories/processing-status.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { DeadLetterService } from '../../dead-letter/dead-letter.service';
import { PreprocessingService } from '../service/preprocessing.service';
import { PreprocessingStatusDto } from '../dto/preprocessing-status.dto';
import { AuditLogDto } from '../dto/audit-log.dto';
import { DeadLetterRecordDto } from '../../dead-letter/dto/dead-letter-record.dto';
import { InvoiceRecordEntity, InvoiceBatchEntity } from '../../entities/Entities';
import { RECORD_PP_STATUS } from '../constants';
import { BATCH_STATUS } from '../../invoice/constants';

@ApiTags('preprocessing')
@ApiBearerAuth()
@Controller('preprocessing/batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PreprocessingController {
  constructor(
    private readonly statusRepo: ProcessingStatusRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly dlq: DeadLetterService,
    private readonly preprocessing: PreprocessingService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Get(':batchId')
  @Roles('INVOICE_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Processing_status row for the batch' })
  async getStatus(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<PreprocessingStatusDto> {
    const row = await this.statusRepo.findByBatch(batchId);
    if (!row) throw new NotFoundException(`processing_status for batch ${batchId} not found`);
    const dlqCount = await this.dlq.countByBatch(batchId);
    return {
      batchId: row.batch_id,
      status: row.preprocessing_status,
      startedAt: row.preprocessing_start ? row.preprocessing_start.toISOString() : null,
      endedAt:   row.preprocessing_end   ? row.preprocessing_end.toISOString()   : null,
      durationSec: row.preprocessing_duration_s ?? null,
      totalRecords: row.total_records,
      processedRecords: row.processed_records,
      errorRecords: row.error_records,
      deadLetteredRecords: dlqCount,
    };
  }

  @Get(':batchId/audit')
  @Roles('INVOICE_OPERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Audit log for a batch' })
  async getAudit(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<AuditLogDto[]> {
    const rows = await this.auditRepo.listByBatch(batchId);
    return rows.map(r => ({
      id: r.id, batchId: r.batch_id, recordId: r.record_id,
      action: r.action, actor: r.actor, payload: r.payload,
      createdAt: r.created_at.toISOString(),
    }));
  }

  @Get(':batchId/dlq')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Dead-letter entries for a batch (admin)' })
  getDlq(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<DeadLetterRecordDto[]> {
    return this.dlq.listByBatch(batchId);
  }

  @Post(':batchId/retry')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Re-queue a batch (resets DEAD_LETTERED / ERROR records to PENDING)' })
  async retryBatch(@Param('batchId', ParseUUIDPipe) batchId: string): Promise<{ batchId: string; queued: number }> {
    const batchRepo = this.dataSource.getRepository(InvoiceBatchEntity);
    const batch = await batchRepo.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException(`Batch ${batchId} not found`);

    const recordRepo = this.dataSource.getRepository(InvoiceRecordEntity);
    const result = await recordRepo.update(
      { batch_id: batchId, preprocessing_status: In([RECORD_PP_STATUS.DEAD_LETTERED, RECORD_PP_STATUS.ERROR]) },
      { preprocessing_status: RECORD_PP_STATUS.PENDING, error_message: null, image_path: null, image_hash: null },
    );

    await batchRepo.update({ id: batchId }, { status: BATCH_STATUS.UPLOADED });

    // Fire asynchronously
    setImmediate(() => this.preprocessing.processBatch(batchId).catch(() => undefined));
    return { batchId, queued: result.affected ?? 0 };
  }

  @Get()
  @Roles('ADMIN')
  ping(): { ok: boolean } {
    return { ok: true };
  }
}
