/**
 * @file   dashboard-filter.dto.ts
 * @module Dashboard (EPIC-006)
 */

import { IsOptional, IsDateString, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardFilterDto {
  @ApiPropertyOptional({ description: 'ISO 8601; default = 30 days ago' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601; default = now' })
  @IsOptional() @IsDateString()
  to?: string;
}

export class TrendFilterDto extends DashboardFilterDto {
  @ApiPropertyOptional({ enum: ['day', 'week'], default: 'day' })
  @IsOptional() @IsIn(['day', 'week'])
  interval: 'day' | 'week' = 'day';
}

export class TopErrorsFilterDto extends DashboardFilterDto {
  @ApiPropertyOptional({ default: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit: number = 5;
}
