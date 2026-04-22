# Invoice Processing Platform — v3.1

A vendor-neutral, vision-LLM-based invoice ingestion, extraction, tracking, dashboard, and reporting platform. The solution is **customer-agnostic** — any organisation can point it at its own invoice image/PDF URLs and configure an allowlisted host.

- **Repository:** <https://github.com/saurabhdeepmindz/VIT-Project-InvoiceProcessing>
- **Stack:** NestJS 11 (TypeScript, Node 24) · Next.js 16 · React 19 · FastAPI (Python 3.11) · PostgreSQL 18
- **LLM providers (pluggable):** Stub (default, no key required) · Nano Banana / Gemini · OpenAI · Anthropic · Azure OpenAI
- **Tests:** 93 passing — 37 backend Jest · 31 Python pytest · 25 Playwright E2E (RTM-tagged across all 7 EPICs)

---

## Table of contents

1. [What this platform does](#1-what-this-platform-does)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Fresh-machine setup](#4-fresh-machine-setup)
5. [Demo walkthrough](#5-demo-walkthrough)
6. [API quick reference](#6-api-quick-reference)
7. [Project layout](#7-project-layout)
8. [Environment variables](#8-environment-variables)
9. [Running tests](#9-running-tests)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. What this platform does

| EPIC | Module | User-visible capability |
| --- | --- | --- |
| 001 | Auth | Email/password login; JWT access + refresh; two roles (`ADMIN`, `INVOICE_OPERATOR`); password-reset flow |
| 002 | Ingestion | Upload a CSV **manifest** of invoice URLs; SHA-256 content-hash duplicate detection; event-driven downstream pipeline |
| 003 | Preprocessing | Async URL fetch (SSRF allowlist, 30 MB cap, 3 retries with exponential backoff), image dedup, PDF page detection, dead-letter queue for permanent failures |
| 004 | EDA | Vision-first extraction via Python AI service (LLM + optional OCR corroboration + rule engine + confidence scorer); per-batch output CSV auto-generated |
| 005 | Tracker | Paginated file-status board + per-batch detail with **13 extracted fields** per record, audit log, DLQ drill-down, inline error messages on failed rows, and **two retry buttons** (preprocessing + EDA) |
| 006 | Dashboard | Date-range metrics, daily/weekly trend chart (batches vs errors), top-error batches |
| 007 | Reporting | 3 report types × 2 formats (single-file / weekly / error × CSV / Excel) + download history |

---

## 2. Architecture

```text
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Next.js 16      │  REST  │  NestJS 11           │  HTTP  │  FastAPI 3.11    │
│  (port 3000)     │◄──────►│  (port 3001)         │◄──────►│  (port 8001)     │
│                  │  JWT   │                      │  JSON  │                  │
│  /login          │        │  auth / invoice      │        │  /eda/extract    │
│  /upload         │        │  preprocessing / eda │        │  vision-first    │
│  /tracker        │        │  tracker / dashboard │        │  + rule engine   │
│  /tracker/:id    │        │  reporting           │        │  + scorer        │
│  /dashboard      │        │                      │        │                  │
│  /reports        │        └──────────┬───────────┘        │  Pluggable LLM:  │
└──────────────────┘                   │                    │   Stub           │
                                       │ TypeORM            │   Nano Banana    │
                              ┌────────▼────────┐           │   OpenAI         │
                              │  PostgreSQL 18  │           │   Anthropic      │
                              │  (port 5432)    │           │   Azure OpenAI   │
                              │  12 migrations  │           └──────────────────┘
                              └────────┬────────┘                     │
                                       │                              │ Pillow, pypdfium2,
                              ┌────────▼────────┐                     │ pytesseract (opt.)
                              │  Local FS       │   (STORAGE_PROVIDER=local)
                              │   upload/       │   CSV manifests
                              │   processed/    │   downloaded invoice images
                              │   output/       │   extracted-data CSVs
                              │   reports/      │   generated reports
                              └─────────────────┘
```

**Event flow per batch:**

```text
CSV upload  →  invoice.uploaded  →  PreprocessingScheduler
            fetch URL, hash, inspect PDF, store  →  preprocessing.completed
                        →  EdaScheduler
      POST /eda/extract per record  →  rule engine + scorer  →  output CSV
                        →  eda.completed
```

---

## 3. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | ≥ 24.14 | `node --version` |
| Python | 3.11.x | `py -3.11 --version` |
| PostgreSQL | 18.x | `psql --version` |
| Git | any recent | `git --version` |
| Tesseract | *(optional — only for OCR corroboration path)* | set `TESSERACT_CMD` in `.env` |

On Windows the defaults in `.env.sample` point to `D:/invoice-processing-data/storage` and the typical Windows Tesseract path. Adjust for your OS if needed.

---

## 4. Fresh-machine setup

> **Clone first:**
> ```bash
> git clone https://github.com/saurabhdeepmindz/VIT-Project-InvoiceProcessing.git
> cd VIT-Project-InvoiceProcessing
> ```
> All paths below are relative to that directory.

### 4.1 Create `.env`

```bash
cp .env.sample .env
```

Open `.env` and set at minimum:

| Key | What to put |
| --- | --- |
| `DATABASE_PASSWORD` | the password you will set for `invoice_user` in §4.2 |
| `JWT_ACCESS_SECRET` | a random 64+ char string |
| `JWT_REFRESH_SECRET` | a different random 64+ char string |
| `LOCAL_STORAGE_PATH` | absolute path for on-disk storage (default `D:/invoice-processing-data/storage` works on Windows) |
| `IMG_URL_HOST_ALLOWLIST` | comma-separated hostnames you trust for invoice URLs (set `*` only for local/dev) |
| `USE_STUB_PROVIDER` | leave as **`true`** for a demo — no LLM keys required |

> **IMPORTANT — quote any value containing `#`**, for example
> `SEED_ADMIN_PASSWORD="ChangeMe!Admin#2026"`.
> `dotenv` treats an unquoted `#` as an inline comment and silently truncates the value.

### 4.2 PostgreSQL — create DB, user, and apply migrations

Run as your PostgreSQL superuser (`postgres`):

```bash
# 1. Create the application role and database
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d postgres -c \
  "CREATE ROLE invoice_user WITH LOGIN PASSWORD 'yourpassword';"

PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d postgres -c \
  "CREATE DATABASE invoice_processing OWNER invoice_user;"

# 2. Grant schema ownership (migrations install extensions)
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d invoice_processing -c \
  "GRANT ALL ON SCHEMA public TO invoice_user; ALTER SCHEMA public OWNER TO invoice_user;"

# 3. Apply all 12 migrations in order (as postgres superuser, because
#    migration 001 installs uuid-ossp and pgcrypto extensions)
cd db/migrations
for f in 001_*.sql 002_*.sql 003_*.sql 004_*.sql 005_*.sql \
         006_*.sql 007_*.sql 008_*.sql 009_*.sql 010_*.sql \
         011_*.sql 012_*.sql; do
  PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d invoice_processing -f "$f"
done
cd ../..

# 4. Reassign table ownership to invoice_user (the application role)
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d invoice_processing <<'SQL'
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO invoice_user', r.tablename);
  END LOOP;
END$$;
ALTER FUNCTION public.set_updated_at() OWNER TO invoice_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO invoice_user;
SQL
```

> **Shortcut for demos — skip steps 3 and 4.** If you just want a fully
> seeded dataset (users + uploaded batches + extracted records) without
> running the pipeline yourself, restore the dump at
> [`database-backup/invoice-processing-data-backup.sql`](database-backup/README.md)
> using `pg_restore`. See that folder's README for the exact command.

### 4.3 Install dependencies

```bash
# Node workspaces (backend + frontend)
npm install

# Python AI service (creates a venv under python/.venv/)
cd python
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1       # PowerShell — or:  .venv\Scripts\activate (cmd.exe)
pip install -e ".[dev]"
deactivate
cd ..
```

### 4.4 Boot the three services (three terminals)

> **Run all three commands from the repo root** (the folder that contains
> `package.json` + `python/` + `frontend/` + `backend/`).
> `npm run backend:dev` and `npm run frontend:dev` are workspace-orchestrator
> scripts defined only in the root `package.json`, and `uvicorn` needs the
> repo-root CWD so `pydantic-settings` finds the root `.env` — otherwise it
> silently falls back to `USE_STUB_PROVIDER=true`.

| Terminal | From | Command | Port |
| --- | --- | --- | --- |
| Backend | **repo root** | `npm run backend:dev` | **3001** |
| Python AI | **repo root** | see per-shell table below | **8001** |
| Frontend | **repo root** | `npm run frontend:dev` | **3000** |

The Python AI service must be launched with the venv's `python.exe`; shell path syntax differs:

| Shell | Command (from repo root) |
| --- | --- |
| **Windows cmd.exe** | `python\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload` |
| **PowerShell** | `.\python\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload` |
| **bash / Git Bash** | `./python/.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload` |

### 4.5 Smoke checks

| URL | Expected |
| --- | --- |
| <http://localhost:3000/login> | Login screen renders |
| <http://localhost:3001/health> | `{"status":"ok","service":"invoice-processing-backend", …}` |
| <http://localhost:3001/ready> | `{"status":"ready","checks":{"database":{"ok":true},"python_ai":{"ok":true}}, …}` |
| <http://localhost:3001/api/docs> | Swagger UI with all tags (auth, invoice, preprocessing, eda, tracker, dashboard, reports, health) |
| <http://localhost:8001/health> | `{"status":"ok","service":"invoice-ai","llm_provider":"stub", …}` |
| <http://localhost:8001/eda/provider> | `{"provider":"stub","use_stub":true}` |

### 4.6 Default demo accounts

On first backend boot, two demo users are auto-seeded:

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@invoice-platform.local` | `ChangeMe!Admin#2026` |
| INVOICE_OPERATOR | `operator@invoice-platform.local` | `ChangeMe!Op#2026` |

Override these via `SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_OPERATOR_EMAIL / SEED_OPERATOR_PASSWORD` in `.env` before first boot.

---

## 5. Demo walkthrough

Several sample CSV manifests live in `backend/` so you can exercise the pipeline without preparing real data:

| File | Contents | Expected outcome |
| --- | --- | --- |
| `backend/test-csv-sample.csv` | 3 URLs with **fake** context tokens | Upload succeeds → preprocessing fails → all 3 rows DLQ'd → batch **FAILED** |
| `backend/demo-live.csv` | Real live invoice URLs | Full pipeline succeeds → batch **DONE** |
| `backend/demo-live-2.csv` | Different real URLs (distinct content hash) | Full pipeline succeeds → batch **DONE** |
| `backend/phase2-fail.csv` | 1 URL pointing at a non-existent image | Preprocessing hits HTTP 4xx → 1 DLQ entry → batch **FAILED** (useful for DLQ demo) |
| `backend/phase3-smoke.csv` | 2 real URLs | Full upload → preprocess → EDA → CSV smoke test |

> Re-uploading the **same** file twice triggers the **CSV content-hash idempotency guard** — the second attempt returns HTTP 409 `DUPLICATE_CSV`. That is a feature. Copy a sample CSV and add or remove a URL line to change the content hash before re-uploading.

### Step-by-step walkthrough

1. **Log in** at <http://localhost:3000/login> as the **operator** (`operator@invoice-platform.local` / `ChangeMe!Op#2026`).
2. You land on **`/upload`**. Drag `backend/demo-live.csv` into the dropzone (or click **Choose file**).
3. Click **Upload batch**. Within a few seconds the **Recent batches** table flips:
   **UPLOADED** (blue) → **PREPROCESSING** (orange) → **EDA_PROCESSING** (orange) → **DONE** (green).
   A **Download CSV** link appears once the batch is `DONE`.
4. Click the batch row → **/tracker/{batchId}** detail page.
5. The **Records** table shows the 13 extracted fields per row. Click the **▸** arrow on any row to expand additional fields (Invoice date, Quantity, Comments, LLM provider, Error message, …).
6. Open **/dashboard**. Adjust the date range; the metric cards populate. The trend chart shows blue bars (batches/day) and a red line (errors/day).
7. **Error demo (optional):** upload `backend/phase2-fail.csv` → batch flips to **FAILED** → open its tracker detail → scroll to the **Dead-letter queue** section.
8. **Generate a report:** open **/reports**:
   - **Single-file** tab: paste a DONE batchId (copy from /tracker). Choose CSV or Excel. Click Generate. Download from the history table below.
   - **Weekly** tab: pick a date range. Excel reports include colour-coded confidence cells.
   - **Error** tab: pick a date range + confidence threshold (default 70). Lists every record that failed or fell below threshold.
9. **Password-reset flow (optional):** log out. Click **Forgot password?**. Submit any email — the response is the same regardless of whether the account exists (enumeration-safe). In demo mode the reset URL is logged to the backend console; copy the `?token=…` into `/reset-password` to set a new password.

---

## 6. API quick reference

All endpoints are prefixed `/api/v1` and require a JWT Bearer token except `/health`, `/ready`, and `/metrics`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | returns access + refresh tokens |
| POST | `/auth/refresh` | public | rotate tokens (SHA-256 + `timingSafeEqual`) |
| POST | `/auth/logout` | any | revoke refresh token |
| GET | `/auth/me` | any | current user |
| POST | `/auth/forgot` | public | request password reset; enumeration-safe 202 response |
| POST | `/auth/reset` | public | complete password reset with token + new password |
| POST | `/invoice/batches` | operator / admin | multipart CSV upload |
| GET | `/invoice/batches` | operator / admin | list own batches |
| GET | `/invoice/batches/:id` | operator / admin | batch + processing_status |
| GET | `/preprocessing/batches/:id` | operator / admin | preprocessing view |
| GET | `/preprocessing/batches/:id/audit` | operator / admin | audit log |
| GET | `/preprocessing/batches/:id/dlq` | admin | DLQ entries |
| POST | `/preprocessing/batches/:id/retry` | operator / admin | re-queue errored records |
| GET | `/eda/batches/:id/summary` | operator / admin | extraction counts + avg confidence |
| GET | `/eda/batches/:id/records` | operator / admin | per-record extraction results |
| GET | `/eda/batches/:id/output.csv` | operator / admin | download generated CSV |
| POST | `/eda/batches/:id/run` | operator / admin | re-run EDA on FAILED / PENDING records (preserves successful extractions) |
| GET | `/tracker/files` | operator / admin | paginated file-status board |
| GET | `/tracker/files/:id` | operator / admin | detail: summary + records + audit + DLQ |
| GET | `/dashboard/metrics` | operator / admin | totals, averages, status breakdown |
| GET | `/dashboard/trend` | operator / admin | `?interval=day\|week` time series |
| GET | `/dashboard/top-errors` | operator / admin | top-N worst batches |
| POST | `/reports/generate` | operator / admin | generate a report file |
| GET | `/reports` | operator / admin | history |
| GET | `/reports/:id/download` | operator / admin | stream report file |

- Full interactive backend spec: <http://localhost:3001/api/docs> (Swagger).
- Python AI service spec: <http://localhost:8001/docs> — only `/health`, `/ready`, `/eda/extract`, `/eda/provider` are publicly callable.

---

## 7. Project layout

```text
.
├── README.md                           # project overview
├── README-V2.md                        # ← this file (clean onboarding guide)
├── .env.sample  .env  (gitignored)     # env config; quote any `#` values
├── .gitignore                          # excludes node_modules, dist, .venv, storage, logs, .env
├── package.json                        # npm workspaces (backend + frontend)
│
├── docs/                               # LLD + wireframes + reference material
│
├── database-backup/                    # demo data dump + restore helper
│   ├── README.md
│   └── invoice-processing-data-backup.sql
│
├── db/
│   ├── migrations/                     # 12 SQL files — apply in numeric order
│   └── seeds/
│
├── backend/                            # NestJS 11 API
│   ├── package.json  tsconfig.json  nest-cli.json
│   ├── scripts/hash-password.js        # bcrypt util
│   ├── demo-live.csv  demo-live-2.csv  # ← demo CSVs (see §5)
│   ├── phase2-*.csv  phase3-*.csv  test-csv-sample.csv
│   └── src/
│       ├── main.ts  app.module.ts
│       ├── config/configuration.ts
│       ├── database/{data-source,database.module}.ts
│       ├── entities/Entities.ts        # TypeORM entities
│       ├── common/                     # logger, filter, interceptors, guards
│       ├── file-storage/               # FileStorageService + local adapter
│       ├── health/                     # /health /ready /metrics
│       ├── auth/                       # EPIC-001
│       ├── invoice/                    # EPIC-002
│       ├── preprocessing/              # EPIC-003
│       ├── eda/                        # EPIC-004
│       ├── tracker/                    # EPIC-005
│       ├── dashboard/                  # EPIC-006
│       ├── reporting/                  # EPIC-007
│       └── dead-letter/                # cross-cutting DLQ module
│
├── python/                             # FastAPI AI microservice
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── config/settings.py
│       ├── providers/                  # stub / nano_banana / openai / anthropic + factory
│       ├── services/
│       │   ├── extraction_service.py   # orchestrator
│       │   ├── rule_engine.py          # normalise + soft-flag (GST, rego)
│       │   ├── confidence_scorer.py    # weighted 0-100
│       │   ├── multi_page_merger.py
│       │   ├── ocr_service.py          # optional Tesseract
│       │   └── pdf_service.py          # pypdfium2
│       ├── routers/eda_router.py       # POST /eda/extract
│       └── tests/                      # pytest (31 tests, incl. 14 provider tests)
│
└── frontend/                           # Next.js 16 (App Router) + React 19
    ├── package.json  next.config.mjs  tsconfig.json  tailwind.config.ts
    ├── playwright.config.ts            # E2E suite entry
    ├── src/
    │   ├── app/
    │   │   ├── login/page.tsx             # EPIC-001
    │   │   ├── forgot-password/page.tsx   # EPIC-001
    │   │   ├── reset-password/page.tsx    # EPIC-001
    │   │   ├── upload/page.tsx            # EPIC-002
    │   │   ├── tracker/page.tsx           # EPIC-005 list
    │   │   ├── tracker/[batchId]/page.tsx # EPIC-005 detail
    │   │   ├── dashboard/page.tsx         # EPIC-006
    │   │   └── reports/page.tsx           # EPIC-007
    │   ├── components/ui/TrendChart.tsx   # zero-dep inline-SVG chart
    │   ├── lib/api.ts                     # fetch wrapper with JWT injection
    │   └── services/*.api.ts
    └── tests/e2e/                         # Playwright E2E (25 tests, RTM-tagged)
```

---

## 8. Environment variables

All defaults live in [`.env.sample`](.env.sample). The variables most likely to need tuning:

| Var | Purpose | Default |
| --- | --- | --- |
| `USE_STUB_PROVIDER` | `true` → canned JSON, no LLM keys needed. `false` → honour `LLM_PROVIDER` | `true` |
| `LLM_PROVIDER` | `nano_banana` \| `openai` \| `anthropic` \| `azure_openai` | `nano_banana` |
| `EXTRACTION_MODE` | `vision_first` \| `ocr_first` | `vision_first` |
| `IMG_MAX_DOWNLOAD_MB` | Per-image size cap during URL fetch | `30` |
| `IMG_DOWNLOAD_TIMEOUT_MS` | Per-image timeout | `180000` |
| `IMG_DOWNLOAD_RETRY` | Retry count (exponential backoff) | `3` |
| `IMG_URL_HOST_ALLOWLIST` | Comma-separated hostnames for SSRF allowlist; `*` disables enforcement (dev only) | vendor-specific |
| `DLQ_ENABLED` | Write permanently-failed records to `dead_letter_records` | `true` |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `minio` | `local` |
| `LOCAL_STORAGE_PATH` | On-disk location for downloaded images / reports / output CSVs | `D:/invoice-processing-data/storage` |
| `METRICS_ENABLED` / `SWAGGER_ENABLED` | Toggle Prometheus metrics / Swagger UI | `true` / `true` |
| `OCR_PROVIDER` | `tesseract` \| `azure_cv` \| `none` — optional corroboration signal | `tesseract` |
| `PASSWORD_RESET_TTL_MINUTES` | Lifetime of a `/auth/forgot` reset token | `60` |

### Switching to a real LLM

All three real providers (Nano Banana / Gemini, OpenAI, Anthropic) are vision-first, JSON-coerced, and share a tolerant response parser that strips Markdown fences, leading prose, and trailing commas. Pick one and set its key:

```env
# OpenAI
USE_STUB_PROVIDER=false
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

```env
# Anthropic
USE_STUB_PROVIDER=false
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

```env
# Nano Banana → Google Gemini's OpenAI-compatible endpoint
USE_STUB_PROVIDER=false
LLM_PROVIDER=nano_banana
NB_API_KEY=AIza...                                                   # Google AI Studio key
NB_API_BASE=https://generativelanguage.googleapis.com/v1beta/openai
NB_MODEL=gemini-2.5-flash                                            # vision + JSON mode, fast + cheap
NB_MAX_TOKENS=4096                                                   # rich invoices need >2048
```

> **Gemini model notes.** `gemini-2.5-flash` and `gemini-2.5-pro` are the right fit for invoice *extraction* (vision + structured JSON). `gemini-3-pro-image-preview` is positioned for image *generation*, not extraction. The placeholder `NB_API_BASE` in `.env.sample` must be replaced with the Gemini OpenAI-compatible endpoint shown above to exercise the real-LLM path.

Restart the Python service, then verify:

```text
GET http://localhost:8001/eda/provider
→  {"provider":"openai","use_stub":false}
```

All providers share the same `VISION_SYSTEM_PROMPT` in `python/app/providers/_shared.py`, so extraction output is consistent regardless of which one is active.

---

## 9. Running tests

```bash
# Backend (Jest, 37 tests)
npm --workspace backend run test

# Python (pytest, 31 tests)
cd python
.\.venv\Scripts\Activate.ps1
pytest tests/ -v
deactivate
cd ..

# Frontend E2E (Playwright, 25 tests — RTM-tagged per EPIC, all 7 EPICs covered)
cd frontend
npm run e2e:install          # one-time: download Chromium
npm run e2e                  # aggregate run — every EPIC, one report folder
npm run e2e:per-epic         # one report folder per EPIC (maintenance view)
npm run e2e:auth             # scope to a single EPIC (+ upload/tracker/dashboard/etc.)
npm run e2e:summary          # pass/fail table + writes summary.md
npm run e2e:report           # open aggregate HTML report
cd ..
```

**Suite breakdown (93 tests total):**

| Suite | Tests | Where |
| --- | --- | --- |
| InvoiceValidator / InvoiceTransformer / InvoiceService | 26 | `backend/src/invoice/*.spec.ts` |
| ImageFetchService / PdfInspectService | 9 | `backend/src/preprocessing/service/*.spec.ts` |
| AuthService (refresh-rotation + SHA-256 hash + logout path) | 2 | `backend/src/auth/auth.service.spec.ts` |
| RuleEngine / ConfidenceScorer / MultiPageMerger | 17 | `python/tests/test_*.py` |
| LLM providers (Nano Banana + OpenAI + Anthropic + shared JSON parser) | 14 | `python/tests/test_llm_providers.py` |
| EPIC-001 Auth E2E (login, forgot, rbac) | 9 | `frontend/tests/e2e/epic-001-auth/` |
| EPIC-002 Upload E2E | 2 | `frontend/tests/e2e/epic-002-upload/` |
| EPIC-003 Preprocessing lifecycle (observation) | 3 | `frontend/tests/e2e/epic-003-preprocessing/` |
| EPIC-004 EDA extraction-fields (observation) | 3 | `frontend/tests/e2e/epic-004-eda/` |
| EPIC-005 Tracker E2E (list + detail) | 3 | `frontend/tests/e2e/epic-005-tracker/` |
| EPIC-006 Dashboard E2E | 3 | `frontend/tests/e2e/epic-006-dashboard/` |
| EPIC-007 Reports E2E | 2 | `frontend/tests/e2e/epic-007-reports/` |

Every Playwright spec carries an `EPIC / User Story / Requirements / Acceptance / RTM Trace` header pointing to the backend controller + service and the frontend page + API client it exercises. The consolidated matrix lives in [`frontend/tests/e2e/RTM.md`](frontend/tests/e2e/RTM.md).

E2E artefacts are git-ignored and written under `frontend/tests/e2e/test-output/runs/YYYY-MM-DD/run-XX/` with a `latest/` pointer auto-refreshed to the most recent run. Retention is capped by `E2E_KEEP_RUNS` (default 10).

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Login fails with "Invalid credentials" even with the exact seed password | Unquoted `#` in `SEED_*_PASSWORD` — dotenv treats everything after `#` as a comment | Quote the values (`SEED_ADMIN_PASSWORD="…#…"`) · delete `users` rows · restart backend so the seed re-runs |
| Port 3001 already in use → `EADDRINUSE` | Another NestJS / Next.js process owns the port | `netstat -ano -p tcp \| grep ":3001 "` → `taskkill //F //PID <PID>` |
| `Missing script: "backend:dev"` | Command was run from inside `backend/` instead of the repo root | `cd ..` and retry, or use the workspace script directly: `npm run start:dev` inside `backend/` |
| `'.' is not recognized as an internal or external command` | Windows `cmd.exe` doesn't parse the Unix `./path/…` prefix | Use the cmd row in §4.4 (backslashes, no leading `./`) |
| `/eda/provider` returns `{"provider":"stub","use_stub":true}` even with `USE_STUB_PROVIDER=false` | `uvicorn` was launched from `python/` and did not find the root `.env` | Kill it, `cd` to the repo root, and relaunch using the §4.4 command |
| `(invoice-venv)` or some other wrong venv is active | A different venv shadows `python\.venv\` | `deactivate` first, or verify the active venv has the project's deps installed — from repo root: `cd python; pip install -e ".[dev]"; cd ..` |
| `ModuleNotFoundError: No module named 'app'` | Plain `uvicorn app.main:app …` resolved to a system Python earlier on `PATH` | Call the venv's `python.exe` explicitly: `python\.venv\Scripts\python.exe -m uvicorn app.main:app …` |
| `Cannot access 'ProcessingStatusEntity' before initialization` at startup | TypeORM `emitDecoratorMetadata` + forward-referenced relations | Already fixed in code — `@ManyToOne / @OneToOne` types wrapped with TypeORM's `Relation<T>` |
| `npm ERR! ETARGET No matching version…` on fresh install | Registry lag or a pinned version that no longer exists | `npm view <pkg> version` for the real latest; bump `backend/package.json` |
| Python extraction returns ~80 confidence on stub-provider run but ~91 on real data | OCR corroboration boosts the score when Tesseract is installed | Expected. Set `OCR_PROVIDER=none` to get deterministic demo numbers |
| Free-tier Gemini returns HTTP 503 `UNAVAILABLE` on concurrent calls | Upstream quota / burst throttling | Tenacity retries 3× with exponential backoff; if it still fails, use the **↻ Retry EDA** button on the tracker detail |

---

## Contributing

```bash
# make a change
git checkout -b feat/my-change
git add <files>
git commit -m "feat: short description"
git push -u origin feat/my-change
# open a PR against main
```

Follow the commit prefix convention (`feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`).
