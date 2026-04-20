/**
 * @file   invoice.controller.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * REST endpoints for the CSV-manifest ingestion API (v3.1).
 *
 *  POST /invoice/batches     — upload CSV (multipart, 'file' field)
 *  GET  /invoice/batches     — paginated list (user-scoped)
 *  GET  /invoice/batches/:id — single batch status
 *
 * Auth: all endpoints require JWT + role in { INVOICE_OPERATOR, ADMIN }.
 *
 * @since 3.1.0
 */

import {
  Controller, Post, Get, Param, Query, Body, UseGuards,
  UploadedFile, UseInterceptors, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody,
} from '@nestjs/swagger';

import { InvoiceService } from '../service/invoice.service';
import { UploadCsvDto } from '../dto/upload-csv.dto';
import { BatchResponseDto } from '../dto/batch-response.dto';
import { BatchStatusDto } from '../dto/batch-status.dto';
import { BatchListQueryDto, BatchListResponseDto } from '../dto/batch-list.dto';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser, AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@ApiTags('invoice')
@ApiBearerAuth()
@Controller('invoice/batches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INVOICE_OPERATOR', 'ADMIN')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CSV manifest (list of invoice URLs) and create a batch' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file with "Invoice Links" column' },
        label: { type: 'string', description: 'Optional operator label' },
      },
    },
  })
  uploadBatch(
    @UploadedFile() file: Express.Multer.File,
    @Body() _dto: UploadCsvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchResponseDto> {
    return this.invoiceService.createBatchFromCsv(file, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List the operator\'s batches (paginated)' })
  listBatches(
    @Query() query: BatchListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchListResponseDto> {
    return this.invoiceService.listBatches(user.id, query);
  }

  @Get(':batchId')
  @ApiOperation({ summary: 'Get status of a single batch' })
  getBatchStatus(
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BatchStatusDto> {
    return this.invoiceService.getBatchStatus(batchId, user.id);
  }
}
