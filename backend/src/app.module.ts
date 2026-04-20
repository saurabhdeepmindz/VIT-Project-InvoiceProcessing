/**
 * @file   app.module.ts
 * @module AppModule
 *
 * @description
 * Root module wiring all cross-cutting concerns and EPIC modules together.
 *
 * Phase 0 (this commit): Config + Database + Auth + Health + FileStorage + Common
 * Phase 1+ (future): InvoiceModule, PreprocessingModule, EdaModule,
 *                    TrackerModule, DashboardModule, ReportingModule
 *
 * @since 1.0.0
 */

import { Module }               from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule }         from '@nestjs/config';
import { EventEmitterModule }   from '@nestjs/event-emitter';
import { ScheduleModule }       from '@nestjs/schedule';
import { ValidationPipe }       from '@nestjs/common';
import * as path                from 'node:path';

import { loadConfig }           from './config/configuration';
import { DatabaseModule }       from './database/database.module';
import { AppLogger }            from './common/logger/AppLogger';
import { HttpExceptionFilter }  from './common/filters/HttpExceptionFilter';
import { LoggingInterceptor }   from './common/interceptors/LoggingInterceptor';
import { MetricsInterceptor }   from './common/interceptors/MetricsInterceptor';
import { FileStorageModule }    from './file-storage/file-storage.module';
import { HealthModule }         from './health/health.module';
import { AuthModule }           from './auth/auth.module';
import { InvoiceModule }        from './invoice/invoice.module';
import { DeadLetterModule }     from './dead-letter/dead-letter.module';
import { PreprocessingModule }  from './preprocessing/preprocessing.module';
import { EdaModule }            from './eda/eda.module';
import { TrackerModule }        from './tracker/tracker.module';
import { DashboardModule }      from './dashboard/dashboard.module';
import { ReportingModule }      from './reporting/reporting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Monorepo .env lives one level above the backend workspace CWD.
      // Try both the project-root .env and an optional backend-local .env.
      envFilePath: [
        path.resolve(process.cwd(), '../.env'),
        path.resolve(process.cwd(), '.env'),
      ],
      load: [loadConfig],
      cache: true,
    }),
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    FileStorageModule,
    HealthModule,
    AuthModule,
    DeadLetterModule,
    InvoiceModule,
    PreprocessingModule,
    EdaModule,
    TrackerModule,
    DashboardModule,
    ReportingModule,
  ],
  providers: [
    AppLogger,
    { provide: APP_FILTER,      useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
  exports: [AppLogger],
})
export class AppModule {}
