/**
 * @file   data-source.ts
 * @module Database
 *
 * @description
 * TypeORM DataSource configuration for the Invoice Processing Platform.
 * Used by the NestJS TypeOrmModule at runtime AND by the TypeORM CLI
 * for schema introspection.
 *
 * EPIC: Cross-cutting — All Epics
 *
 * @since 1.0.0
 */

import { DataSource, DataSourceOptions } from 'typeorm';
import { UserEntity }             from '../auth/entities/user.entity';
import {
  InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity,
  ProcessingStatusEntity, AuditLogEntity, ExtractionResultEntity,
  OutputFileEntity, ReportFileEntity, DeadLetterRecordEntity,
} from '../entities/Entities';

export const buildDataSourceOptions = (): DataSourceOptions => ({
  type:        'postgres',
  host:        process.env.DATABASE_HOST        ?? 'localhost',
  port:        Number(process.env.DATABASE_PORT ?? 5432),
  username:    process.env.DATABASE_USER        ?? 'invoice_user',
  password:    process.env.DATABASE_PASSWORD    ?? '',
  database:    process.env.DATABASE_NAME        ?? 'invoice_processing',
  ssl:         process.env.DATABASE_SSL === 'true',
  synchronize: false,                                 // NEVER true — migrations only
  logging:     process.env.DATABASE_LOGGING === 'true',
  entities: [
    UserEntity,
    InvoiceBatchEntity, InvoiceRecordEntity, FileUploadEntity,
    ProcessingStatusEntity, AuditLogEntity, ExtractionResultEntity,
    OutputFileEntity, ReportFileEntity, DeadLetterRecordEntity,
  ],
  extra: {
    max: Number(process.env.DATABASE_MAX_CONNECTIONS ?? 20),
    idleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS ?? 30_000),
  },
});

// Export a default DataSource for TypeORM CLI consumers
export const AppDataSource = new DataSource(buildDataSourceOptions());
