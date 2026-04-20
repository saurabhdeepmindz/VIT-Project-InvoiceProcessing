-- ============================================================================
-- Migration 005: processing_status
-- EPIC-003 (upserts) / EPIC-005 (reads) / EPIC-006 (aggregates) / EPIC-007 (joins)
-- One row per batch, upserted after each stage
-- ============================================================================

CREATE TABLE IF NOT EXISTS processing_status (
    id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id                    UUID          NOT NULL UNIQUE REFERENCES invoice_batches(id) ON DELETE CASCADE,

    preprocessing_status        VARCHAR(50)   NOT NULL DEFAULT 'PENDING'
                                              CHECK (preprocessing_status IN ('PENDING','RUNNING','DONE','FAILED','PARTIAL')),
    preprocessing_start         TIMESTAMPTZ,
    preprocessing_end           TIMESTAMPTZ,
    preprocessing_duration_s    INT,

    eda_status                  VARCHAR(50)   NOT NULL DEFAULT 'PENDING'
                                              CHECK (eda_status IN ('PENDING','RUNNING','DONE','FAILED','PARTIAL')),
    eda_start                   TIMESTAMPTZ,
    eda_end                     TIMESTAMPTZ,
    eda_duration_s              INT,

    total_records               INT           NOT NULL DEFAULT 0,
    processed_records           INT           NOT NULL DEFAULT 0,
    error_records               INT           NOT NULL DEFAULT 0,
    avg_confidence              DECIMAL(5,2),
    turnaround_time_s           INT,

    created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_created ON processing_status (created_at DESC);
