-- ============================================================================
-- Migration 009: report_files
-- EPIC-007 — reporting & data export
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_files (
    id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type           VARCHAR(50)   NOT NULL
                                        CHECK (report_type IN ('SINGLE_FILE','WEEKLY','ERROR')),
    parameters            JSONB         NOT NULL,
    file_path             TEXT          NOT NULL,
    file_format           VARCHAR(20)   NOT NULL DEFAULT 'CSV'
                                        CHECK (file_format IN ('CSV','XLSX')),
    record_count          INT           NOT NULL DEFAULT 0,
    generated_by_user_id  UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_type_generated ON report_files (report_type, generated_at DESC);
