-- ============================================================================
-- Migration 003: invoice_records
-- EPIC-002 (create), EPIC-003 (preprocessing updates), EPIC-004 (eda updates)
-- v3.1: adds source_url, image_hash, page_count for URL-based ingestion + dedup
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_records (
    id                     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id               UUID          NOT NULL REFERENCES invoice_batches(id) ON DELETE CASCADE,
    source_url             TEXT          NOT NULL,                           -- v3.1: origin URL from CSV
    image_path             TEXT,                                              -- populated by EPIC-003 after download
    image_hash             VARCHAR(64),                                       -- v3.1: SHA-256 of downloaded bytes
    page_count             INT           NOT NULL DEFAULT 1,                  -- v3.1: >1 for multi-page PDFs
    csv_row_number         INT           NOT NULL,
    raw_csv_data           JSONB,
    raw_metadata           JSONB,
    preprocessing_status   VARCHAR(50)   NOT NULL DEFAULT 'PENDING'
                                         CHECK (preprocessing_status IN ('PENDING','PROCESSING','PROCESSED','ERROR','DEAD_LETTERED')),
    eda_status             VARCHAR(50)   NOT NULL DEFAULT 'PENDING'
                                         CHECK (eda_status IN ('PENDING','PROCESSING','EXTRACTED','PARTIAL','FAILED','DEAD_LETTERED')),
    error_message          TEXT,
    created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_records_batch_pp    ON invoice_records (batch_id, preprocessing_status);
CREATE INDEX IF NOT EXISTS idx_records_batch_eda   ON invoice_records (batch_id, eda_status);
CREATE INDEX IF NOT EXISTS idx_records_image_hash  ON invoice_records (image_hash)
    WHERE image_hash IS NOT NULL;
