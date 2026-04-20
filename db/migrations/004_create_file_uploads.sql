-- ============================================================================
-- Migration 004: file_uploads
-- EPIC-002 — Tracks every file (CSV + downloaded images) stored in filesystem
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_uploads (
    id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id          UUID          NOT NULL REFERENCES invoice_batches(id) ON DELETE CASCADE,
    record_id         UUID          REFERENCES invoice_records(id) ON DELETE CASCADE,
    file_name         VARCHAR(512)  NOT NULL,
    file_type         VARCHAR(100)  NOT NULL,
    file_size_bytes   BIGINT        NOT NULL,
    storage_path      TEXT          NOT NULL,
    source            VARCHAR(20)   NOT NULL DEFAULT 'UPLOAD'
                                    CHECK (source IN ('UPLOAD','FETCHED','GENERATED')),
    uploaded_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_uploads_batch ON file_uploads (batch_id);
