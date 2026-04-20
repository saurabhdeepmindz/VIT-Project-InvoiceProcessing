/**
 * @file   constants.ts
 * @module Reporting (EPIC-007, v3.1)
 */

export const REPORT_TYPE = {
  SINGLE_FILE: 'SINGLE_FILE',
  WEEKLY: 'WEEKLY',
  ERROR: 'ERROR',
} as const;
export type ReportType = typeof REPORT_TYPE[keyof typeof REPORT_TYPE];

export const REPORT_FORMAT = { CSV: 'CSV', XLSX: 'XLSX' } as const;
export type ReportFormat = typeof REPORT_FORMAT[keyof typeof REPORT_FORMAT];

export const SINGLE_FILE_COLUMNS = [
  'record_id', 'batch_id', 'source_url', 'csv_row_number',
  'dealer_name', 'customer_name', 'customer_mobile',
  'vehicle_registration_number', 'tyre_size', 'tyre_pattern',
  'invoice_amount_excl_gst', 'gst_amount', 'quantity',
  'invoice_date', 'invoice_number', 'comments',
  'preprocessing_status', 'eda_status', 'extraction_status',
  'confidence_score', 'llm_provider_used', 'extracted_at',
] as const;

export const WEEKLY_COLUMNS = [
  'week_start', 'week_end', 'total_batches', 'done_batches', 'failed_batches',
  'partial_batches', 'total_records', 'processed_records', 'error_records',
  'avg_preprocessing_s', 'avg_eda_s', 'avg_turnaround_s', 'avg_confidence',
] as const;

export const ERROR_COLUMNS = [
  'batch_id', 'file_name', 'record_id', 'csv_row_number', 'source_url',
  'preprocessing_status', 'eda_status', 'extraction_status',
  'error_message', 'confidence_score', 'uploaded_at',
] as const;

export const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 70;
