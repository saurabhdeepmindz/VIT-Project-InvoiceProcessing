-- ============================================================================
-- Migration 011: updated_at triggers
-- Cross-cutting — keeps updated_at columns fresh automatically
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'users',
        'invoice_batches',
        'invoice_records',
        'processing_status'
    ])
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON %I;', t, t);
        EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
    END LOOP;
END$$;
