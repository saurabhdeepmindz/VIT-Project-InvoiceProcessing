/**
 * @file   CommonDto.ts
 * @module Common
 *
 * @description
 * Shared Data Transfer Objects used across all modules.
 * Includes PaginationDto, DateRangeDto, and response wrappers.
 *
 * EPIC: Cross-cutting — All Epics
 *
 * @author  Invoice Processing Platform Engineering
 * @version 1.0.0
 * @since   2025-01-01
 */

import { IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Standard pagination query parameters used across all list endpoints.
 * EPIC: Cross-cutting | All paginated endpoints
 * @since 1.0.0
 */
export class PaginationDto {
  /** Page number, 1-indexed */
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Items per page */
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * Date range filter used by EPIC-006 dashboard and EPIC-007 reports.
 * EPIC: EPIC-006, EPIC-007
 * @since 1.0.0
 */
export class DateRangeDto {
  /** Start date in ISO 8601 format: YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** End date in ISO 8601 format: YYYY-MM-DD */
  @IsOptional()
  @IsDateString()
  to?: string;
}

/**
 * Standard paginated list response wrapper.
 * EPIC: Cross-cutting | All paginated responses
 * @since 1.0.0
 */
export class PagedResponseDto<T> {
  /** Array of items for the current page */
  data: T[];
  /** Total items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
}


/**
 * @file   Decorators.ts
 * @module Common
 *
 * @description
 * Custom NestJS decorators: @Roles() and @CurrentUser().
 *
 * EPIC: Cross-cutting — All authenticated controllers
 *
 * @since 1.0.0
 */

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Key used by RolesGuard to read required roles from handler metadata */
export const ROLES_KEY = 'roles';

/**
 * Sets the allowed roles for a controller or handler method.
 * Used with RolesGuard.
 *
 * EPIC: Cross-cutting | Role-Based Access
 * @example @Roles('ADMIN', 'INVOICE_OPERATOR')
 * @since 1.0.0
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Parameter decorator extracting the authenticated user from the request.
 *
 * EPIC: Cross-cutting | JWT User Extraction
 * @example async myMethod(@CurrentUser() user: UserDto)
 * @since 1.0.0
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);


/**
 * @file   Modules.ts
 * @module All Modules — NestJS Module Definitions
 *
 * @description
 * NestJS @Module() class definitions for each EPIC domain.
 * Registers controllers, services, repositories, and imports.
 *
 * EPIC: EPIC-002 through EPIC-007, Cross-cutting
 *
 * @since 1.0.0
 */

import { Module }              from '@nestjs/common';
import { TypeOrmModule }       from '@nestjs/typeorm';
import { ScheduleModule }      from '@nestjs/schedule';
import { EventEmitterModule }  from '@nestjs/event-emitter';
import { HttpModule }          from '@nestjs/axios';

// EPIC-002 Invoice Module
import { InvoiceController }   from '../invoice/InvoiceController';
import { InvoiceService }      from '../invoice/InvoiceService';
import { InvoiceValidator }    from '../invoice/InvoiceValidator';
import { InvoiceBatchEntity }  from '../entities/Entities';
import { InvoiceRecordEntity } from '../entities/Entities';
import { FileUploadEntity }    from '../entities/Entities';

// EPIC-003 Preprocessing Module
import { PreprocessingController } from '../preprocessing/PreprocessingController';
import { PreprocessingService }    from '../preprocessing/PreprocessingService';
import { PreprocessingScheduler }  from '../preprocessing/PreprocessingScheduler';
import { ProcessingStatusEntity }  from '../entities/Entities';
import { AuditLogEntity }          from '../entities/Entities';

// EPIC-004 EDA Module
import { EdaController }           from '../eda/EdaController';
import { EdaService }              from '../eda/EdaService';
import { ExtractionResultEntity }  from '../entities/Entities';
import { OutputFileEntity }        from '../entities/Entities';

// EPIC-005 Tracker Module
import { TrackerController }       from '../tracker/TrackerController';
import { TrackerService }          from '../tracker/TrackerService';

// EPIC-006 Dashboard Module
import { DashboardController }     from '../dashboard/DashboardController';
import { DashboardService }        from '../dashboard/DashboardService';

// EPIC-007 Reporting Module
import { ReportingController }     from '../reporting/ReportingController';
import { ReportingService }        from '../reporting/ReportingService';
import { CsvExporter, ExcelExporter } from '../reporting/Exporters';
import { ReportFileEntity }        from '../entities/Entities';

// Cross-cutting
import { FileStorageService }      from '../file-storage/FileStorageService';
import { AppLogger }               from '../common/logger/AppLogger';

/**
 * Invoice ingestion domain module — EPIC-002
 * @since 1.0.0
 */
@Module({
  imports: [TypeOrmModule.forFeature([InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity])],
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceValidator, FileStorageService, AppLogger],
  exports: [InvoiceService],
})
export class InvoiceModule {}

/**
 * Data preprocessing domain module — EPIC-003
 * @since 1.0.0
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceBatchEntity, InvoiceRecordEntity, ProcessingStatusEntity, AuditLogEntity]),
    ScheduleModule.forRoot(),
  ],
  controllers: [PreprocessingController],
  providers: [PreprocessingService, PreprocessingScheduler, FileStorageService, AppLogger],
  exports: [PreprocessingService],
})
export class PreprocessingModule {}

/**
 * EDA extraction domain module — EPIC-004
 * @since 1.0.0
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceRecordEntity, InvoiceBatchEntity, ExtractionResultEntity, OutputFileEntity, ProcessingStatusEntity]),
    HttpModule,
  ],
  controllers: [EdaController],
  providers: [EdaService, FileStorageService, AppLogger],
  exports: [EdaService],
})
export class EdaModule {}

/**
 * Processing status tracker module — EPIC-005
 * @since 1.0.0
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProcessingStatusEntity, InvoiceBatchEntity])],
  controllers: [TrackerController],
  providers: [TrackerService, AppLogger],
  exports: [TrackerService],
})
export class TrackerModule {}

/**
 * Operations dashboard module — EPIC-006
 * @since 1.0.0
 */
@Module({
  imports: [TypeOrmModule.forFeature([ProcessingStatusEntity, InvoiceBatchEntity])],
  controllers: [DashboardController],
  providers: [DashboardService, AppLogger],
})
export class DashboardModule {}

/**
 * Reporting and export module — EPIC-007
 * @since 1.0.0
 */
@Module({
  imports: [TypeOrmModule.forFeature([InvoiceBatchEntity, InvoiceRecordEntity, ExtractionResultEntity, ProcessingStatusEntity, ReportFileEntity])],
  controllers: [ReportingController],
  providers: [ReportingService, CsvExporter, ExcelExporter, FileStorageService, AppLogger],
})
export class ReportingModule {}
