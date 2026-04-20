-- ============================================================================
-- Migration 006: audit_logs
-- EPIC-003 — immutable audit trail for compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id     UUID          REFERENCES invoice_batches(id) ON DELETE CASCADE,
    record_id    UUID          REFERENCES invoice_records(id) ON DELETE CASCADE,
    action       VARCHAR(100)  NOT NULL,
    actor        VARCHAR(255)  NOT NULL,
    payload      JSONB,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_batch_created ON audit_logs (batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_logs (action);
