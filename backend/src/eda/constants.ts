/**
 * @file   constants.ts
 * @module EDA (EPIC-004, v3.1)
 */

export const EDA_EVENTS = {
  COMPLETED: 'eda.completed',
  PARTIAL:   'eda.partial',
  FAILED:    'eda.failed',
} as const;

export const RECORD_EDA_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  EXTRACTED: 'EXTRACTED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  DEAD_LETTERED: 'DEAD_LETTERED',
} as const;

export const BATCH_EDA_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

// 13 fields in canonical column order for the output CSV
export const CSV_COLUMNS = [
  'record_id', 'batch_id', 'source_url',
  'dealer_name', 'customer_name', 'customer_mobile',
  'vehicle_registration_number', 'tyre_size', 'tyre_pattern',
  'invoice_amount_excl_gst', 'gst_amount', 'quantity',
  'invoice_date', 'invoice_number', 'comments',
  'confidence_score', 'extraction_status', 'llm_provider_used', 'extracted_at',
] as const;
