-- ============================================================================
-- Migration 002: invoice_batches
-- EPIC-002 — Invoice Data Ingestion
-- v3.1: adds csv_content_hash for upload idempotency
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoice_batches (
    id                 UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    csv_path           TEXT          NOT NULL,
    csv_content_hash   VARCHAR(64)   NOT NULL UNIQUE,          -- v3.1: SHA-256 of CSV bytes
    status             VARCHAR(50)   NOT NULL DEFAULT 'UPLOADED'
                                     CHECK (status IN ('UPLOADED','PREPROCESSING','PREPROCESSED',
                                                       'EDA_PROCESSING','DONE','FAILED','PARTIAL')),
    batch_size         INT           NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_user_created ON invoice_batches (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_status        ON invoice_batches (status);
