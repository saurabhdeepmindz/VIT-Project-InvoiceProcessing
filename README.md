# Bridgestone Invoice Processing Platform — v3.1

Vision-LLM invoice ingestion, extraction, tracking, dashboard, and reporting platform built to the LLD at [`docs/InvoiceProcessing_LLD_v3.0.docx`](docs/InvoiceProcessing_LLD_v3.0.docx) + [`docs/InvoiceProcessing_LLD_v3.1_Addendum.docx`](docs/InvoiceProcessing_LLD_v3.1_Addendum.docx).

- **Repo:** <https://github.com/saurabhdeepmindz/bridgestone-invoice-processing> (private)
- **Stack:** NestJS 11 (TypeScript, Node 24) · Next.js 14 · FastAPI (Python 3.11) · PostgreSQL 18
- **LLM (pluggable):** Stub (default) · Nano Banana · OpenAI · Anthropic
- **Tests:** 52 passing (35 backend TS + 17 Python)

---

## 1. What this platform does

| EPIC | Module | User-visible capability |
| --- | --- | --- |
| 001 | Auth | Email/password login; JWT access + refresh; 2 roles (`ADMIN`, `INVOICE_OPERATOR`) |
| 002 | Ingestion | Upload a CSV **manifest** of invoice URLs; SHA-256 content-hash duplicate detection; event-driven downstream pipeline |
| 003 | Preprocessing | Async URL fetch (SSRF allowlist, 30 MB cap, 3 retries with exponential backoff), SHA-256 image dedup, PDF page detection, dead-letter queue for permanent failures |
| 004 | EDA | Vision-first extraction via Python AI (OCR corroboration + rule engine + confidence scorer); per-batch output CSV auto-generated |
| 005 | Tracker | Paginated file-status board + per-batch detail with **13 extracted fields** per record, audit log, DLQ drill-down |
| 006 | Dashboard | Date-range metrics, daily/weekly trend chart (batches vs errors), top-error batches |
| 007 | Reporting | 3 report types × 2 formats (single-file / weekly / error × CSV / Excel) + download history |

---

## 2. Architecture (60-second tour)

```text
┌──────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Next.js 14      │  REST  │  NestJS 11           │  HTTP  │  FastAPI 3.11    │
│  (port 3000)     │◄──────►│  (port 3001)         │◄──────►│  (port 8001)     │
│                  │  JWT   │                      │  JSON  │                  │
│  /login          │        │  auth / invoice      │        │  /eda/extract    │
│  /upload         │        │  preprocessing / eda │        │  vision-first    │
│  /tracker        │        │  tracker / dashboard │        │  + rule engine   │
│  /tracker/:id    │        │  reporting           │        │  + scorer        │
│  /dashboard      │        │                      │        │                  │
│  /reports        │        └──────────┬───────────┘        │  StubProvider    │
└──────────────────┘                   │                    │  NanoBanana      │
                                       │ TypeORM            │  OpenAI          │
                              ┌────────▼────────┐           │  Anthropic       │
                              │  PostgreSQL 18  │           └──────────────────┘
                              │  (port 5432)    │                    │
                              │  10 tables      │                    │ Pillow, pypdfium2,
                              │  (via migrations│                    │ pytesseract (opt.)
                              │   db/migrations)│                    │
                              └─────────────────┘
                                       │
                              ┌────────▼────────┐
                              │  Local FS       │   (STORAGE_PROVIDER=local)
                              │  D:/…/storage   │
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
| Tesseract (OPTIONAL — only if you enable the OCR corroboration path) | any | set `TESSERACT_CMD` in `.env` |

Windows users: the defaults in `.env.sample` already point to `D:/invoice-processing-data/storage` and the Windows Tesseract path.

---

## 4. Fresh-machine setup — step by step

> **Clone** first: `git clone https://github.com/saurabhdeepmindz/bridgestone-invoice-processing` → `cd bridgestone-invoice-processing`. All paths below are relative to that directory.

### 4.1 Create `.env`

```bash
cp .env.sample .env
```

Open `.env` and set these (everything else can use the defaults for a demo):

| Key | What to put |
| --- | --- |
| `DATABASE_PASSWORD` | the password you set below when creating `invoice_user` |
| `JWT_ACCESS_SECRET` | random 64+ char string |
| `JWT_REFRESH_SECRET` | a different random 64+ char string |
| `LOCAL_STORAGE_PATH` | absolute path; default `D:/invoice-processing-data/storage` is fine on Windows |
| `USE_STUB_PROVIDER` | leave as **`true`** — no LLM keys required for demo |

> **IMPORTANT** — quote any value that contains `#`, e.g.
> `SEED_ADMIN_PASSWORD="ChangeMe!Admin#2026"`.
> `dotenv` treats unquoted `#` as an inline comment and silently truncates the value — which will leave you with an unexpected shorter seed password.

### 4.2 PostgreSQL — create DB + user + apply migrations

Windows with the `postgres` superuser:

```bash
# 1. Create the role + DB (one-off; use your postgres superuser password)
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d postgres -c \
  "CREATE ROLE invoice_user WITH LOGIN PASSWORD 'yourpassword';"

PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d postgres -c \
  "CREATE DATABASE invoice_processing OWNER invoice_user;"

# 2. Grant schema ownership (migrations install extensions)
PGPASSWORD=<postgres-password> psql -h localhost -U postgres -d invoice_processing -c \
  "GRANT ALL ON SCHEMA public TO invoice_user; ALTER SCHEMA public OWNER TO invoice_user;"

# 3. Apply all 11 migrations in order (run as postgres superuser because
#    migration 001 creates the uuid-ossp and pgcrypto extensions)
cd db/migrations
for f in 001_*.sql 002_*.sql 003_*.sql 004_*.sql 005_*.sql \
         006_*.sql 007_*.sql 008_*.sql 009_*.sql 010_*.sql 011_*.sql; do
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

### 4.3 Install dependencies

```bash
# Node workspaces (backend + frontend)
npm install

# Python AI service (creates a venv under python/.venv/)
cd python
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1       # PowerShell  —  or:  .venv\Scripts\activate (cmd.exe)
pip install -e ".[dev]"
deactivate
cd ..
```

### 4.4 Boot the three services (three terminals)

| Terminal | From | Command | Port |
| --- | --- | --- | --- |
| Backend | repo root | `npm run backend:dev` | **3001** |
| Python AI | `python/` | `.\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8001 --reload` | **8001** |
| Frontend | repo root | `npm run frontend:dev` | **3000** |

On first boot of the backend, two demo users are auto-seeded:

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@invoice-platform.local` | `ChangeMe!Admin#2026` |
| INVOICE_OPERATOR | `operator@invoice-platform.local` | `ChangeMe!Op#2026` |

### 4.5 Smoke checks

| URL | Expected |
| --- | --- |
| <http://localhost:3000/login> | Login screen renders |
| <http://localhost:3001/health> | `{"status":"ok","service":"invoice-processing-backend", …}` |
| <http://localhost:3001/ready> | `{"status":"ready","checks":{"database":{"ok":true},"python_ai":{"ok":true}}, …}` |
| <http://localhost:3001/api/docs> | Swagger UI with all tags (auth, invoice, preprocessing, eda, tracker, dashboard, reports, health) |
| <http://localhost:8001/health> | `{"status":"ok","service":"invoice-ai","llm_provider":"stub", …}` |
| <http://localhost:8001/eda/provider> | `{"provider":"stub","use_stub":true}` |

---

## 5. Demo walkthrough — try it before using real data

Five sample CSVs live in `backend/` for you to exercise the pipeline without needing real-world invoices:

| File | Contents | What happens end-to-end |
| --- | --- | --- |
| `backend/test-csv-sample.csv` | 3 URLs with **fake** `?context=abc/def/ghi` tokens | Upload succeeds → preprocessing fails → all 3 rows DLQ'd → batch status **FAILED** |
| `backend/phase2-real.csv` | 2 **real live** Bridgestone URLs | Full pipeline succeeds → status **DONE** in ~5 seconds |
| `backend/phase2-fresh.csv` | 3 different real URLs (non-duplicate content) | Full pipeline succeeds → status **DONE** |
| `backend/phase2-fail.csv` | 1 URL with `does-not-exist.jpg` | Preprocessing hits HTTP 400 → 1 DLQ entry → batch **FAILED** (useful for DLQ demo) |
| `backend/phase3-smoke.csv` | 2 real URLs | Used for full upload→preprocess→EDA→CSV smoke test |

> Re-uploading the same file twice will trigger the **CSV-content-hash idempotency guard** — the second attempt returns HTTP 409 `DUPLICATE_CSV`. That is a feature, not a bug. Copy one of the sample CSVs and add or remove a URL line to change the content hash before re-uploading.

### Step-by-step walkthrough

1. **Log in** at <http://localhost:3000/login> as the **operator** (`operator@invoice-platform.local` / `ChangeMe!Op#2026`).
2. You land on **`/upload`**. Drag `backend/phase2-fresh.csv` into the dropzone (or click **Choose file**).
3. Click **Upload batch**. Within ~3 seconds the **Recent batches** table flips:
   - Badge goes **UPLOADED** (blue) → **PREPROCESSING** (orange) → **EDA_PROCESSING** (orange) → **DONE** (green).
   - A **Download CSV** link appears next to the row once the batch is `DONE`.
4. Click the file name in the Recent batches table → **/tracker/{batchId}** detail page.
5. The **Records** table shows the 13 extracted fields per row (Invoice #, Dealer, Customer, Amount, GST, Rego, EDA status, Confidence). Click the **▸** arrow on any row to expand additional fields (Invoice date, Quantity, Tyre size, Comments, LLM provider, Error message).
6. Go to **/dashboard**. Adjust the date range; watch the metric cards populate. The trend chart shows blue bars (batches/day) and a red line (errors/day).
7. **Optional error demo:** upload `backend/phase2-fail.csv` → watch the batch flip to **FAILED** → open its tracker detail → scroll to the **Dead-letter queue** section.
8. **Generate a report:** navigate to **/reports**:
   - **Single-file** tab: paste a DONE batchId (copy one from /tracker). Choose CSV or Excel. Click Generate. Download from the history table below.
   - **Weekly** tab: pick a date range. Generate. Excel reports have **colour-coded confidence cells** (red / amber / green).
   - **Error** tab: pick a date range + confidence threshold (default 70). Generate. Lists every record that failed or fell below threshold.

---

## 6. API quick reference

All endpoints are prefixed `/api/v1` and require a JWT Bearer token (except `/health`, `/ready`, `/metrics`).

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | returns access + refresh tokens |
| POST | `/auth/refresh` | public | rotate tokens |
| POST | `/auth/logout` | any | revoke refresh token |
| GET | `/auth/me` | any | current user |
| POST | `/invoice/batches` | operator / admin | multipart CSV upload |
| GET | `/invoice/batches` | operator / admin | list own batches |
| GET | `/invoice/batches/:id` | operator / admin | batch + processing_status |
| GET | `/preprocessing/batches/:id` | operator / admin | preprocessing view |
| GET | `/preprocessing/batches/:id/audit` | operator / admin | audit log |
| GET | `/preprocessing/batches/:id/dlq` | admin | DLQ entries |
| POST | `/preprocessing/batches/:id/retry` | admin | re-queue errored records |
| GET | `/eda/batches/:id/summary` | operator / admin | extraction counts + avg confidence |
| GET | `/eda/batches/:id/records` | operator / admin | per-record extraction results |
| GET | `/eda/batches/:id/output.csv` | operator / admin | download generated CSV |
| POST | `/eda/batches/:id/run` | admin | re-run EDA |
| GET | `/tracker/files` | operator / admin | paginated file-status board |
| GET | `/tracker/files/:id` | operator / admin | detail: summary + records (with 13 fields) + audit + DLQ |
| GET | `/dashboard/metrics` | operator / admin | totals, averages, status breakdown |
| GET | `/dashboard/trend` | operator / admin | `?interval=day\|week` time series |
| GET | `/dashboard/top-errors` | operator / admin | top-N worst batches |
| POST | `/reports/generate` | operator / admin | generate a report file |
| GET | `/reports` | operator / admin | history |
| GET | `/reports/:id/download` | operator / admin | stream report file |

Full interactive spec: <http://localhost:3001/api/docs> (Swagger).

Python AI service: <http://localhost:8001/docs> — only `/health`, `/ready`, `/eda/extract`, `/eda/provider` are publicly callable.

---

## 7. Project layout

```text
.
├── README.md                          # ← you are here
├── .env.sample  .env  (gitignored)    # env config; quote # values
├── .gitignore                         # excludes node_modules, dist, .venv, storage, logs, .env
├── package.json                       # npm workspaces (backend + frontend)
│
├── docs/
│   ├── InvoiceProcessing_LLD_v3.0.docx
│   ├── InvoiceProcessing_LLD_v3.1_Addendum.docx
│   ├── InvoiceProcessing-screens/     # wireframes (HTML) + screen RTM
│   └── reference-docs/                # sample invoices + URL CSV
│
├── db/
│   ├── migrations/                    # 11 SQL files — apply in numeric order
│   └── seeds/
│
├── backend/                           # NestJS 11 API
│   ├── package.json  tsconfig.json  nest-cli.json
│   ├── scripts/hash-password.js       # bcrypt util
│   ├── test-csv-sample.csv            # ← demo CSVs (see §5)
│   ├── phase2-real.csv
│   ├── phase2-fresh.csv
│   ├── phase2-fail.csv
│   ├── phase3-smoke.csv
│   └── src/
│       ├── main.ts  app.module.ts
│       ├── config/configuration.ts
│       ├── database/{data-source,database.module}.ts
│       ├── entities/Entities.ts         # TypeORM entities (v3.1 schema)
│       ├── common/                      # logger, filter, interceptors, guards, decorators, exceptions
│       ├── file-storage/                # FileStorageService + local adapter
│       ├── health/                      # /health /ready /metrics
│       ├── auth/                        # EPIC-001
│       ├── invoice/                     # EPIC-002  {controller, service, dto, events, interfaces, repositories}
│       ├── preprocessing/               # EPIC-003  + scheduler/ + builders of URL fetch, PDF inspect, audit log
│       ├── eda/                         # EPIC-004  + CsvOutputService
│       ├── tracker/                     # EPIC-005
│       ├── dashboard/                   # EPIC-006
│       ├── reporting/                   # EPIC-007  + builders/{single-file, weekly, error} + CsvExporter / ExcelExporter
│       └── dead-letter/                 # cross-cutting DLQ module
│
├── python/                              # FastAPI AI microservice
│   ├── pyproject.toml
│   └── app/
│       ├── main.py
│       ├── config/settings.py
│       ├── utils/logger.py
│       ├── providers/
│       │   ├── base_provider.py         # vision-first contract
│       │   ├── stub_provider.py         # USE_STUB_PROVIDER=true (default)
│       │   ├── nano_banana_provider.py
│       │   ├── anthropic_provider.py
│       │   └── provider_factory.py
│       ├── services/
│       │   ├── extraction_service.py    # orchestrator
│       │   ├── rule_engine.py           # normalise + soft-flag (GST reconcile, rego)
│       │   ├── confidence_scorer.py     # weighted 0-100 + bonuses
│       │   ├── multi_page_merger.py
│       │   ├── ocr_service.py           # optional Tesseract
│       │   └── pdf_service.py           # pypdfium2
│       ├── routers/eda_router.py        # POST /eda/extract
│       └── tests/                       # pytest (17 tests)
│
└── frontend/                            # Next.js 14 (App Router)
    ├── package.json  next.config.mjs  tsconfig.json  tailwind.config.ts
    └── src/
        ├── app/
        │   ├── layout.tsx  page.tsx  globals.css
        │   ├── login/page.tsx             # EPIC-001
        │   ├── upload/page.tsx            # EPIC-002  (CSV dropzone + live polling)
        │   ├── tracker/page.tsx           # EPIC-005  list
        │   ├── tracker/[batchId]/page.tsx # EPIC-005  detail — expandable 13-field rows
        │   ├── dashboard/page.tsx         # EPIC-006  metrics + trend chart
        │   └── reports/page.tsx           # EPIC-007  3 tabs + history
        ├── components/ui/TrendChart.tsx   # zero-dep inline-SVG chart
        ├── lib/api.ts                     # fetch wrapper with JWT injection
        └── services/{auth,invoice,tracker,dashboard,reporting}.api.ts
```

---

## 8. Environment variables — highlights

All defaults live in [`.env.sample`](.env.sample). The ones most likely to change:

| Var | Purpose | Default |
| --- | --- | --- |
| `USE_STUB_PROVIDER` | `true` → canned JSON, no LLM keys needed. `false` → honour `LLM_PROVIDER` | `true` |
| `LLM_PROVIDER` | `nano_banana` \| `openai` \| `anthropic` \| `azure_openai` | `nano_banana` |
| `EXTRACTION_MODE` | `vision_first` \| `ocr_first` | `vision_first` |
| `IMG_MAX_DOWNLOAD_MB` | Per-image size cap during URL fetch | `30` |
| `IMG_DOWNLOAD_TIMEOUT_MS` | Per-image timeout | `180000` |
| `IMG_DOWNLOAD_RETRY` | Retry count (exponential backoff) | `3` |
| `IMG_URL_HOST_ALLOWLIST` | Comma-separated; `*` disables. Enforces SSRF allowlist | Bridgestone demo host |
| `DLQ_ENABLED` | Write permanently-failed records to `dead_letter_records` | `true` |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `minio` | `local` |
| `LOCAL_STORAGE_PATH` | Where downloaded images / reports / output CSVs are saved | `D:/invoice-processing-data/storage` |
| `METRICS_ENABLED` / `SWAGGER_ENABLED` | Turn on/off | `true` / `true` |
| `OCR_PROVIDER` | `tesseract` \| `azure_cv` \| `none` — OCR is **optional** corroboration signal | `tesseract` |

### Switching to a real LLM

```env
USE_STUB_PROVIDER=false
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Restart the Python service. Verify:

```text
GET http://localhost:8001/eda/provider
→  {"provider":"openai","use_stub":false}
```

---

## 9. Tests

```bash
# Backend (Jest, 35 tests)
npm --workspace backend run test

# Python (pytest, 17 tests)
cd python
.\.venv\Scripts\Activate.ps1
pytest tests/ -v
deactivate
cd ..
```

Coverage (≥80% on logic-bearing files):

| Suite | Tests | Where |
| --- | --- | --- |
| InvoiceValidator / InvoiceTransformer / InvoiceService | 26 | `backend/src/invoice/*.spec.ts` |
| ImageFetchService / PdfInspectService | 9 | `backend/src/preprocessing/service/*.spec.ts` |
| RuleEngine / ConfidenceScorer / MultiPageMerger | 17 | `python/tests/test_*.py` |

---

## 10. Troubleshooting (things we hit)

| Symptom | Cause | Fix |
| --- | --- | --- |
| Login fails with "Invalid credentials" even with exact seed password | Unquoted `#` in `SEED_*_PASSWORD` in `.env` — dotenv treats everything after `#` as a comment and stores the truncated value | Quote the values: `SEED_ADMIN_PASSWORD="ChangeMe!Admin#2026"` · delete `users` rows · restart backend so the seed re-runs |
| `colors[Colorizer.allColors[lookup]] is not a function` crash on login | Winston's `colorize()` didn't know about the custom `audit` log level | Already fixed in `backend/src/common/logger/AppLogger.ts` via `winston.addColors({...})` |
| `Cannot access 'ProcessingStatusEntity' before initialization` at startup | TypeORM `emitDecoratorMetadata` + forward-referenced relations | Already fixed by wrapping the `@ManyToOne / @OneToOne` type annotations with TypeORM's `Relation<T>` |
| Port 3001 already in use → `EADDRINUSE` | Another NestJS / Next.js process owns the port | `netstat -ano -p tcp \| grep ":3001 "` → `taskkill //F //PID <PID>` |
| `/tracker/:id` shows `Unhandled Runtime Error: An unsupported type was passed to use()` | Next.js 15 async-`params` pattern accidentally used with Next.js 14 | Already fixed — `params: { batchId: string }` (plain object, not Promise) |
| `gh repo view` works but `git push` prompts for credentials | `gh` CLI is logged in but git protocol not configured | Already set via `gh auth setup-git` or push through HTTPS with the gh token |
| `npm ERR! ETARGET No matching version…` on fresh install | `npm` can't find the exact version pinned — happens when registry lags or I guessed a version | `npm view <pkg> version` to get the real latest; update `backend/package.json` |
| Python extraction returns score ~80 on fresh stub-provider run but ~91 after real-data runs | `OCR_PROVIDER=tesseract` in `.env` — Tesseract (if installed) returns OCR confidence that contributes to the score | Normal. To deterministically get 80 for demo set `OCR_PROVIDER=none` in `.env` and restart Python |

---

## 11. Git

This repo lives at <https://github.com/saurabhdeepmindz/bridgestone-invoice-processing> (private).

```bash
# make a change
git add <files>
git commit -m "feat: ..."
git push
```

---

## 12. Deferred / known follow-ups

1. **Login-page UI polish** — shipped minimal; revisit before the customer demo.
2. **Real-LLM wire-up** — Nano Banana / OpenAI / Anthropic provider stubs exist; vision-API HTTP calls to be fleshed out when keys are available.
3. **npm audit** — 6 high-sev transitive advisories from Phase 0 install. Run `npm audit fix` before any production push.
4. **DLQ cosmetic** — `attempts: 4` is logged even for non-retryable 4xx failures where only 1 attempt was made; should record the real attempt count.
5. **E2E Playwright** — not written. Manual smoke walkthroughs (§5) cover the critical paths for now.
6. **Auth EPIC-001** is deliberately "basic minimum" — no password reset, no "forgot password" UI, no refresh-rotation E2E test.
