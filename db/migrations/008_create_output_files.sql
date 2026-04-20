-- ============================================================================
-- Migration 008: output_files
-- EPIC-004 — extracted CSV output per batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS output_files (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id       UUID          NOT NULL UNIQUE REFERENCES invoice_batches(id) ON DELETE CASCADE,
    file_path      TEXT          NOT NULL,
    record_count   INT           NOT NULL DEFAULT 0,
    generated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
