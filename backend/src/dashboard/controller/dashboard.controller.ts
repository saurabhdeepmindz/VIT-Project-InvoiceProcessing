/**
 * @file   dashboard.controller.ts
 * @module Dashboard (EPIC-006)
 *
 * GET /dashboard/metrics     — aggregated metrics in the date range
 * GET /dashboard/trend       — daily/weekly time series
 * GET /dashboard/top-errors  — top N batches by error count
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/JwtAuthGuard';
import { RolesGuard } from '../../common/guards/RolesGuard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

import { DashboardService } from '../service/dashboard.service';
import {
  DashboardFilterDto, TrendFilterDto, TopErrorsFilterDto,
} from '../dto/dashboard-filter.dto';
import {
  DashboardMetricsDto, TrendSeriesDto, TopErrorBatchDto,
} from '../dto/dashboard-metrics.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('INVOICE_OPERATOR', 'ADMIN')           // operators see their own data; admins see all
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Aggregated batch metrics in the given date range' })
  metrics(
    @Query() filter: DashboardFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DashboardMetricsDto> {
    return this.dashboard.metrics(filter, this.scopeFor(user));
  }

  @Get('trend')
  @ApiOperation({ summary: 'Time-series trend (day | week) for batches, records, errors' })
  trend(
    @Query() filter: TrendFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TrendSeriesDto> {
    return this.dashboard.trend(filter, this.scopeFor(user));
  }

  @Get('top-errors')
  @ApiOperation({ summary: 'Top-N batches by error / DLQ count' })
  topErrors(
    @Query() filter: TopErrorsFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TopErrorBatchDto[]> {
    return this.dashboard.topErrors(filter, this.scopeFor(user));
  }

  private scopeFor(user: AuthenticatedUser): string | null {
    return user.role === 'ADMIN' ? null : user.id;
  }
}
