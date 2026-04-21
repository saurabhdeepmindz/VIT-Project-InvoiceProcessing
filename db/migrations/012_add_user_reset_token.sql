-- ============================================================================
-- Migration 012: password-reset tokens
-- EPIC-001 — Auth extras: forgot/reset password flow
-- ============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token_hash        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reset_token_expires_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token_expires
    ON users (reset_token_expires_at)
    WHERE reset_token_hash IS NOT NULL;
