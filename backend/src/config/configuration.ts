/**
 * @file   configuration.ts
 * @module Config
 *
 * @description
 * Typed configuration loader built on @nestjs/config.
 * Reads environment variables and exposes a strongly-typed config tree
 * via ConfigService.get<AppConfig>('...').
 *
 * EPIC: Cross-cutting — All Epics
 * @since 1.0.0
 */

import { z } from 'zod';

/**
 * Zod schema validating required environment variables at startup.
 * Throws a descriptive error if any required var is missing or malformed.
 */
const envSchema = z.object({
  NODE_ENV:     z.enum(['development', 'staging', 'production']).default('development'),
  APP_PORT:     z.coerce.number().int().positive().default(3001),
  API_PREFIX:   z.string().default('/api/v1'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_HOST:               z.string().default('localhost'),
  DATABASE_PORT:               z.coerce.number().int().positive().default(5432),
  DATABASE_NAME:               z.string().default('invoice_processing'),
  DATABASE_USER:               z.string().default('invoice_user'),
  DATABASE_PASSWORD:           z.string(),
  DATABASE_SSL:                z.coerce.boolean().default(false),
  DATABASE_MAX_CONNECTIONS:    z.coerce.number().int().positive().default(20),
  DATABASE_SYNCHRONIZE:        z.coerce.boolean().default(false),
  DATABASE_LOGGING:            z.coerce.boolean().default(false),

  JWT_ACCESS_SECRET:   z.string().min(32),
  JWT_REFRESH_SECRET:  z.string().min(32),
  JWT_ACCESS_EXPIRY:   z.string().default('15m'),
  JWT_REFRESH_EXPIRY:  z.string().default('7d'),

  SEED_ADMIN_EMAIL:       z.string().email().default('admin@invoice-platform.local'),
  SEED_ADMIN_PASSWORD:    z.string().min(8).default('ChangeMe!Admin#2026'),
  SEED_OPERATOR_EMAIL:    z.string().email().default('operator@invoice-platform.local'),
  SEED_OPERATOR_PASSWORD: z.string().min(8).default('ChangeMe!Op#2026'),

  STORAGE_PROVIDER:    z.enum(['local', 's3', 'minio']).default('local'),
  LOCAL_STORAGE_PATH:  z.string().default('D:/invoice-processing-data/storage'),
  AWS_S3_BUCKET:       z.string().optional(),
  AWS_REGION:          z.string().optional(),
  AWS_ACCESS_KEY_ID:   z.string().optional(),
  AWS_SECRET_ACCESS_KEY:z.string().optional(),
  MAX_UPLOAD_SIZE_MB:  z.coerce.number().int().positive().default(50),

  UPLOAD_DIR_PATH:    z.string().default('upload/'),
  PROCESSED_DIR_PATH: z.string().default('processed/'),
  OUTPUT_DIR_PATH:    z.string().default('output/'),
  REPORT_DIR_PATH:    z.string().default('reports/'),

  IMG_MAX_DOWNLOAD_MB:     z.coerce.number().int().positive().default(30),
  IMG_DOWNLOAD_TIMEOUT_MS: z.coerce.number().int().positive().default(180_000),
  IMG_DOWNLOAD_RETRY:      z.coerce.number().int().nonnegative().default(3),
  IMG_DOWNLOAD_BACKOFF_MS: z.coerce.number().int().positive().default(1000),
  IMG_URL_HOST_ALLOWLIST:  z.string().default('*'),

  EXTRACTION_MODE:        z.enum(['vision_first', 'ocr_first']).default('vision_first'),
  DLQ_ENABLED:            z.coerce.boolean().default(true),
  DLQ_RETRY_AFTER_MINUTES:z.coerce.number().int().positive().default(60),

  HEALTHCHECK_ENABLED: z.coerce.boolean().default(true),
  METRICS_ENABLED:     z.coerce.boolean().default(true),
  SWAGGER_ENABLED:     z.coerce.boolean().default(true),

  PYTHON_AI_SERVICE_URL:      z.string().url().default('http://localhost:8001'),
  PYTHON_AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  PYTHON_AI_RETRY_ATTEMPTS:     z.coerce.number().int().nonnegative().default(3),

  BATCH_CRON_SCHEDULE:   z.string().default('*/15 * * * *'),
  BATCH_MAX_CONCURRENT:  z.coerce.number().int().positive().default(5),
  BATCH_RETRY_ATTEMPTS:  z.coerce.number().int().nonnegative().default(3),

  LOG_LEVEL:   z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT:  z.enum(['json', 'pretty']).default('pretty'),
  LOG_FILE_PATH:   z.string().optional(),
  AUDIT_LOG_PATH:  z.string().optional(),

  BCRYPT_SALT_ROUNDS:    z.coerce.number().int().positive().default(12),
  LOGIN_RATE_LIMIT_MAX:  z.coerce.number().int().positive().default(5),
  RATE_LIMIT_TTL_SECONDS:z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Loads and validates environment variables. Invoked once by @nestjs/config.
 * @throws {Error} if validation fails (aborts startup — fail-fast)
 */
export function loadConfig(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
