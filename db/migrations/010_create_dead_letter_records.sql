-- ============================================================================
-- Migration 010: dead_letter_records  (v3.1 — new)
-- Cross-cutting — captures permanently-failed records after retries exhausted
-- ============================================================================

CREATE TABLE IF NOT EXISTS dead_letter_records (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id         UUID          NOT NULL REFERENCES invoice_batches(id) ON DELETE CASCADE,
    record_id        UUID          REFERENCES invoice_records(id) ON DELETE CASCADE,
    failure_stage    VARCHAR(50)   NOT NULL
                                   CHECK (failure_stage IN ('FETCH','PDF_CONVERT','OCR','LLM','RULE','OUTPUT')),
    error_code       VARCHAR(100),
    error_message    TEXT,
    attempts         INT           NOT NULL DEFAULT 1,
    last_attempt_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    retry_eligible   BOOLEAN       NOT NULL DEFAULT TRUE,
    retried_at       TIMESTAMPTZ,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dlq_batch_created  ON dead_letter_records (batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_eligible       ON dead_letter_records (retry_eligible, last_attempt_at)
    WHERE retry_eligible = TRUE AND resolved_at IS NULL;
