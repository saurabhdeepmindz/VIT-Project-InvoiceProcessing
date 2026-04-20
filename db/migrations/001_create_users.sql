-- ============================================================================
-- Migration 001: users
-- EPIC-001 — Authentication & Authorization (minimal for demo)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    email            VARCHAR(255)  NOT NULL UNIQUE,
    password_hash    VARCHAR(255)  NOT NULL,
    full_name        VARCHAR(200),
    role             VARCHAR(50)   NOT NULL DEFAULT 'INVOICE_OPERATOR'
                                   CHECK (role IN ('ADMIN', 'INVOICE_OPERATOR')),
    status           VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE'
                                   CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
    refresh_token_hash VARCHAR(255),
    last_login_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);
