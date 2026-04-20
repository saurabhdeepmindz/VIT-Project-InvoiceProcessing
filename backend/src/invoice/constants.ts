/**
 * @file   constants.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Module-level constants for invoice ingestion.
 *
 * @since 3.1.0
 */

/**
 * The single required CSV column per v3.1 addendum §A.2.
 * Matches the sample file docs/reference-docs/InvoicesLink-csv.csv
 * which uses the header "Invoice Links:" (trailing colon in sample).
 * Validator normalises by stripping trailing ':' and whitespace.
 */
export const REQUIRED_CSV_HEADER = 'Invoice Links';

/** Alternative/normalised spellings accepted for the URL column header. */
export const CSV_URL_HEADER_ALIASES: readonly string[] = [
  'invoice links',
  'invoice link',
  'invoice_link',
  'invoice_links',
  'url',
  'invoice_url',
];

/** Max CSV file size in bytes (defaults to MAX_UPLOAD_SIZE_MB=50 from .env). */
export const DEFAULT_MAX_CSV_SIZE_MB = 50;

/** Max rows we will accept in a single CSV (prevents abuse / accidental huge uploads). */
export const MAX_CSV_ROWS = 10_000;

/** Accepted MIME types for uploaded CSV. Excel sometimes saves as ms-excel. */
export const ACCEPTED_CSV_MIMETYPES: readonly string[] = [
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
];

/** Event names emitted by InvoiceService. */
export const INVOICE_EVENTS = {
  UPLOADED: 'invoice.uploaded',
} as const;

/**
 * Invoice service injection token — used by controllers and other modules
 * to inject the interface rather than the concrete class. Supports test mocks.
 */
export const INVOICE_SERVICE = Symbol('IInvoiceService');

/** Batch lifecycle statuses (must match invoice_batches.status CHECK constraint). */
export const BATCH_STATUS = {
  UPLOADED: 'UPLOADED',
  PREPROCESSING: 'PREPROCESSING',
  PREPROCESSED: 'PREPROCESSED',
  EDA_PROCESSING: 'EDA_PROCESSING',
  DONE: 'DONE',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
} as const;

export type BatchStatus = typeof BATCH_STATUS[keyof typeof BATCH_STATUS];
