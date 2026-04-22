# Database backup — demo data

A `pg_dump -Fc` (PostgreSQL custom-format) snapshot of the demo database
including:

- Seeded admin + operator users (credentials already documented in
  `.env.sample` — same `ChangeMe!Admin#2026` / `ChangeMe!Op#2026`).
- Uploaded demo batches: `phase2-real.csv`, `phase2-fresh.csv`,
  `phase3-smoke.csv`, `test-csv-sample.csv`, `demo-live.csv`,
  `demo-live-2.csv`.
- Per-record extraction results from the Gemini 2.5-flash live run
  (13-field structured data, confidence scores, provider = `nano_banana`).

## When to use it

Restore this dump when you want to skip the upload → preprocessing → EDA
pipeline during a demo and jump straight to the tracker / dashboard /
reports views with realistic data already in place.

## Restore from a clean database

```bash
# 1. Drop + recreate the schema (adjust user/password to match your .env)
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d postgres -c \
  "DROP DATABASE IF EXISTS invoice_processing; \
   CREATE DATABASE invoice_processing OWNER invoice_user;"

# 2. Restore the custom-format dump
PGPASSWORD=<postgres-password> pg_restore \
  -h localhost -U postgres \
  -d invoice_processing \
  --no-owner --no-privileges --clean --if-exists \
  database-backup/invoice-processing-data-backup.sql

# 3. (Optional) reassign table ownership to the application role
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d invoice_processing <<'SQL'
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO invoice_user', r.tablename);
  END LOOP;
END$$;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_user;
SQL
```

## Regenerating the dump

After running your own upload + extraction flow, capture a fresh dump:

```bash
PGPASSWORD=<postgres-password> pg_dump \
  -h localhost -U postgres \
  -d invoice_processing \
  -Fc -f database-backup/invoice-processing-data-backup.sql
```

## Notes

- Format: `pg_dump -Fc` (custom binary archive, not plain SQL). Restore
  with `pg_restore`, not `psql -f`.
- Password hashes in the dump are bcrypt — same as `.env.sample`
  defaults, no plaintext secrets.
- Refresh-token hashes are SHA-256 and batch-scoped; restoring will
  invalidate any currently-logged-in sessions (users have to re-login).
- The dump targets the schema produced by migrations 001–012. If your
  local DB is ahead of this, delete + recreate before restoring.
