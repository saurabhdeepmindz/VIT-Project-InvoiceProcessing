/**
 * @file   constants.ts
 * @module Preprocessing (EPIC-003, v3.1)
 */

export const PREPROCESSING_EVENTS = {
  COMPLETED: 'preprocessing.completed',
  PARTIAL:   'preprocessing.partial',
  FAILED:    'preprocessing.failed',
} as const;

export const AUDIT_ACTIONS = {
  BATCH_PREPROCESSING_STARTED:   'preprocessing.batch.started',
  BATCH_PREPROCESSING_COMPLETED: 'preprocessing.batch.completed',
  BATCH_PREPROCESSING_FAILED:    'preprocessing.batch.failed',
  RECORD_FETCH_FAILED:           'preprocessing.record.fetch_failed',
  RECORD_FETCHED:                'preprocessing.record.fetched',
  RECORD_DEDUPED:                'preprocessing.record.deduped',
  RECORD_PDF_INSPECTED:          'preprocessing.record.pdf_inspected',
  RECORD_DEAD_LETTERED:          'preprocessing.record.dead_lettered',
} as const;

// Matches invoice_records.preprocessing_status CHECK constraint.
export const RECORD_PP_STATUS = {
  PENDING:        'PENDING',
  PROCESSING:     'PROCESSING',
  PROCESSED:      'PROCESSED',
  ERROR:          'ERROR',
  DEAD_LETTERED:  'DEAD_LETTERED',
} as const;

// Matches processing_status.preprocessing_status CHECK constraint.
export const BATCH_PP_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE:    'DONE',
  FAILED:  'FAILED',
  PARTIAL: 'PARTIAL',
} as const;

// PDF magic bytes
export const PDF_MAGIC = Buffer.from('%PDF-');

// IIFE-like constants from env at runtime (read via ConfigService)
export const DEFAULT_FETCH_CONCURRENCY = 3;
