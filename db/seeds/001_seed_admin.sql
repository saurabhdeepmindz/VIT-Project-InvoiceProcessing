-- ============================================================================
-- Seed 001: demo users
-- EPIC-001 — seeds one ADMIN and one INVOICE_OPERATOR for the demo
-- Passwords are bcrypt hashes of the plaintexts below (generated offline).
-- Update to match the values set in .env (SEED_ADMIN_PASSWORD / SEED_OPERATOR_PASSWORD).
-- ============================================================================

-- Defaults: admin / ChangeMe!Admin#2026   operator / ChangeMe!Op#2026
-- Replace hashes via:  node backend/scripts/hash-password.js <plaintext>

INSERT INTO users (email, password_hash, full_name, role)
VALUES
  ('admin@invoice-platform.local',
   '$2b$12$REPLACE_WITH_BCRYPT_HASH_OF_ADMIN_PASSWORD_NOT_COMMITTED',
   'Platform Admin',
   'ADMIN'),
  ('operator@invoice-platform.local',
   '$2b$12$REPLACE_WITH_BCRYPT_HASH_OF_OPERATOR_PASSWORD_NOT_COMMITTED',
   'Invoice Operator',
   'INVOICE_OPERATOR')
ON CONFLICT (email) DO NOTHING;
