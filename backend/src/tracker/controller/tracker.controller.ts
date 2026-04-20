/**
 * @file   tracker.controller.ts
 * @module Tracker (EPIC-005)
 *
 * GET /tracker/files            — paginated list (operator scope; admin sees all)
 * GET /tracker/files/:batchId   — full detail (summary + records + audit + dlq)
 */

import {
  Controller, Get, Param, Query, ParseUUIDPipe, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { TrackerService } from '../service/tracker.service';
import { FileStatusQueryDto, FileStatusListDto } from '../dto/file-status-list.dto';
import { FileStatusDetailDto } from '../dto/file-status-detail.dto';

@ApiTags('tracker')
@ApiBearerAuth()
@Controller('tracker/files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INVOICE_OPERATOR', 'ADMIN')
export class TrackerController {
  constructor(private readonly tracker: TrackerService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated list of batches with processing + EDA aggregates' })
  list(
    @Query() query: FileStatusQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FileStatusListDto> {
    const userId = user.role === 'ADMIN' ? null : user.id;
    return this.tracker.list(query, userId);
  }

  @Get(':batchId')
  @ApiOperation({ summary: 'Detail view: summary + records + audit + DLQ' })
  detail(
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FileStatusDetailDto> {
    const userId = user.role === 'ADMIN' ? null : user.id;
    return this.tracker.detail(batchId, userId);
  }
}
