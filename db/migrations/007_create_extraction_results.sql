-- ============================================================================
-- Migration 007: extraction_results
-- EPIC-004 — structured LLM output for each invoice record
-- ============================================================================

CREATE TABLE IF NOT EXISTS extraction_results (
    id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_record_id           UUID          NOT NULL UNIQUE REFERENCES invoice_records(id) ON DELETE CASCADE,

    dealer_name                 VARCHAR(200),
    customer_name               VARCHAR(200),
    customer_mobile             VARCHAR(20),                        -- E.164 AU: +61XXXXXXXXX
    vehicle_registration_number VARCHAR(20),
    tyre_size                   VARCHAR(50),                        -- e.g. 205/55R16
    tyre_pattern                VARCHAR(100),
    invoice_amount_excl_gst     DECIMAL(12,2),
    gst_amount                  DECIMAL(12,2),
    gst_components              JSONB,
    quantity                    INT,
    invoice_date                DATE,
    invoice_number              VARCHAR(100),
    comments                    TEXT,                               -- soft-flags appended here (GST mismatch, rego warning, etc.)

    confidence_score            DECIMAL(5,2),                       -- 0..100
    llm_provider_used           VARCHAR(100)  NOT NULL DEFAULT 'unknown',
    extraction_status           VARCHAR(50)   NOT NULL DEFAULT 'PENDING'
                                              CHECK (extraction_status IN ('PENDING','EXTRACTED','PARTIAL','FAILED')),
    raw_llm_response            JSONB,
    ocr_text                    TEXT,                               -- corroboration signal
    extracted_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extraction_status ON extraction_results (extraction_status);
