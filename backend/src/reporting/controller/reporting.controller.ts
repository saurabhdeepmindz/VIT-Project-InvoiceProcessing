/**
 * @file   reporting.controller.ts
 * @module Reporting (EPIC-007)
 *
 * POST /reports/generate  — generate a report file, returns ReportFileDto
 * GET  /reports           — list generated reports (paginated)
 * GET  /reports/:id/download  — stream the file
 */

import {
  Controller, Post, Get, Body, Param, Query, ParseUUIDPipe, UseGuards, Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { ReportingService } from '../service/reporting.service';
import { GenerateReportDto, ReportListQueryDto } from '../dto/generate-report.dto';
import { ReportFileDto, ReportListDto } from '../dto/report-file.dto';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INVOICE_OPERATOR', 'ADMIN')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a report (single-file / weekly / error) in CSV or Excel' })
  generate(
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportFileDto> {
    return this.reporting.generate(dto, user.id, user.role === 'ADMIN');
  }

  @Get()
  @ApiOperation({ summary: 'Paginated list of generated reports' })
  list(
    @Query() query: ReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportListDto> {
    return this.reporting.list(query, user.id, user.role === 'ADMIN');
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a previously-generated report file' })
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { bytes, entity } = await this.reporting.getDownloadable(id, user.id, user.role === 'ADMIN');
    const filename = `${entity.report_type.toLowerCase()}-${entity.id}.${entity.file_format.toLowerCase()}`;
    const mime = entity.file_format === 'XLSX'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bytes);
  }
}
