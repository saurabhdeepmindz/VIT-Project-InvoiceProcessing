# Bridgestone Invoice Processing Platform — v3.1

Vision-LLM invoice ingestion, extraction, tracking, dashboard, and reporting platform built to the LLD at [`docs/InvoiceProcessing_LLD_v3.0.docx`](docs/InvoiceProcessing_LLD_v3.0.docx) + [`docs/InvoiceProcessing_LLD_v3.1_Addendum.docx`](docs/InvoiceProcessing_LLD_v3.1_Addendum.docx).

- **Repo:** <https://github.com/saurabhdeepmindz/bridgestone-invoice-processing> (private)
- **Stack:** NestJS 11 (TypeScript, Node 24) · Next.js 16 · React 19 · FastAPI (Python 3.11) · PostgreSQL 18
- **LLM (pluggable, fully wired):** Stub (default) · Nano Banana · OpenAI · Anthropic
- **Tests:** **93 passing** — 37 backend Jest · 31 Python pytest · 25 Playwright E2E (RTM-tagged, EPIC-001..007)
- **Security:** 0 npm audit vulnerabilities (backend + frontend) after Next 14→16 + bcrypt 6 upgrades

## What's new since the initial cut (post-launch hardening)

| Category | Commit | Highlights |
| --- | --- | --- |
| Quickest | `90cb491` | Real DLQ `attempts` tracking; bcrypt 5→6 (backend audit → 0 vulns) |
| Small | `db7e8e9` | `/auth/forgot` + `/auth/reset` flow (pages + enumeration-safe API); login polish (Remember-me, Forgot-password link, password toggle, branded header); **refresh-token SHA-256 fix** (bcrypt-72-byte-truncation security bug) |
| Medium | `42520aa` | Real LLM providers (NanoBanana httpx, OpenAI SDK, Anthropic SDK) with vision-first base64 image blocks, shared tolerant JSON parser, 14 new unit tests |
| Larger | `f884d96` | Playwright E2E suite (19 tests, EPIC-organised, full RTM trace); Next.js 14.2 → 16.2 + React 18 → 19 + ESLint 8 → 9 (frontend audit → 0 vulns, clears 5 Next.js CVEs) |

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
│  Next.js 16      │  REST  │  NestJS 11           │  HTTP  │  FastAPI 3.11    │
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

# 3. Apply all 12 migrations in order (run as postgres superuser because
#    migration 001 creates the uuid-ossp and pgcrypto extensions)
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
9. **Optional — password reset flow:** log out. Click **Forgot password?** on the login screen. Enter any email and submit. The response is the same regardless of whether the account exists (enumeration-safe). In demo mode the actual reset URL is logged to the backend console — copy the `?token=…` query string into `/reset-password` to set a new password; the refresh token hash is also nulled, forcing re-login on all active sessions.

---

## 6. API quick reference

All endpoints are prefixed `/api/v1` and require a JWT Bearer token (except `/health`, `/ready`, `/metrics`).

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | returns access + refresh tokens |
| POST | `/auth/refresh` | public | rotate tokens (SHA-256 + `timingSafeEqual`) |
| POST | `/auth/logout` | any | revoke refresh token |
| GET | `/auth/me` | any | current user |
| POST | `/auth/forgot` | public | request password reset; enumeration-safe 202 response; reset URL logged server-side in demo mode |
| POST | `/auth/reset` | public | complete password reset with token + new password |
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
│   ├── migrations/                    # 12 SQL files — apply in numeric order
│   │                                  #   001-011: schema bootstrap
│   │                                  #   012: reset_token_hash + TTL for password reset
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
│       │   ├── _shared.py               # VISION_SYSTEM_PROMPT + tolerant JSON parser
│       │   ├── stub_provider.py         # USE_STUB_PROVIDER=true (default)
│       │   ├── nano_banana_provider.py  # real: httpx + /chat/completions + image_url
│       │   ├── openai_provider.py       # real: official openai SDK + json_object
│       │   ├── anthropic_provider.py    # real: official anthropic SDK + image block
│       │   └── provider_factory.py
│       ├── services/
│       │   ├── extraction_service.py    # orchestrator
│       │   ├── rule_engine.py           # normalise + soft-flag (GST reconcile, rego)
│       │   ├── confidence_scorer.py     # weighted 0-100 + bonuses
│       │   ├── multi_page_merger.py
│       │   ├── ocr_service.py           # optional Tesseract
│       │   └── pdf_service.py           # pypdfium2
│       ├── routers/eda_router.py        # POST /eda/extract
│       └── tests/                       # pytest (31 tests — incl. 14 provider tests)
│
└── frontend/                            # Next.js 16 (App Router) + React 19
    ├── package.json  next.config.mjs  tsconfig.json  tailwind.config.ts
    ├── playwright.config.ts             # E2E suite entry
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx  page.tsx  globals.css
    │   │   ├── login/page.tsx             # EPIC-001  (polished: Remember-me, toggle, branded)
    │   │   ├── forgot-password/page.tsx   # EPIC-001  password reset request
    │   │   ├── reset-password/page.tsx    # EPIC-001  token + new password
    │   │   ├── upload/page.tsx            # EPIC-002  (CSV dropzone + live polling)
    │   │   ├── tracker/page.tsx           # EPIC-005  list
    │   │   ├── tracker/[batchId]/page.tsx # EPIC-005  detail — expandable 13-field rows
    │   │   ├── dashboard/page.tsx         # EPIC-006  metrics + trend chart
    │   │   └── reports/page.tsx           # EPIC-007  3 tabs + history
    │   ├── components/ui/TrendChart.tsx   # zero-dep inline-SVG chart
    │   ├── lib/api.ts                     # fetch wrapper with JWT injection
    │   └── services/{auth,invoice,tracker,dashboard,reporting}.api.ts
    └── tests/e2e/                         # Playwright E2E (25 tests, RTM-tagged)
        ├── RTM.md                         # consolidated traceability matrix
        ├── README.md                      # run & env-override guide
        ├── fixtures/                      # accounts + login helper + sample CSV
        ├── epic-001-auth/                 # login, forgot-password, rbac
        ├── epic-002-upload/               # csv upload
        ├── epic-003-preprocessing/        # pipeline-lifecycle (observation)
        ├── epic-004-eda/                  # extraction-fields (observation)
        ├── epic-005-tracker/              # list + detail
        ├── epic-006-dashboard/            # metrics + trend + top-errors
        ├── epic-007-reports/              # tabs + history
        └── test-output/                   # runtime artefacts (git-ignored)
            ├── results/                   # per-test traces, screenshots, videos
            └── report/                    # html + junit.xml + results.json
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
| `PASSWORD_RESET_TTL_MINUTES` | Lifetime of a `/auth/forgot` reset token | `60` |

### Switching to a real LLM

All three real providers (Nano Banana, OpenAI, Anthropic) are now fully wired — vision-first, JSON-coerced, with a tolerant response parser that strips Markdown fences, leading prose, and trailing commas. Pick one and set its key:

```env
USE_STUB_PROVIDER=false
LLM_PROVIDER=openai                         # openai | anthropic | nano_banana
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

```env
USE_STUB_PROVIDER=false
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
```

Restart the Python service. Verify:

```text
GET http://localhost:8001/eda/provider
→  {"provider":"openai","use_stub":false}
```

All providers share the same `VISION_SYSTEM_PROMPT` in `python/app/providers/_shared.py`, so extraction output is consistent regardless of which one is active.

---

## 9. Tests

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

**RTM traceability:** every Playwright spec header carries an `EPIC / User Story / Requirements / Acceptance / RTM Trace` block pointing at the backend controller + service and the frontend page + API-client it exercises. The consolidated matrix lives in [`frontend/tests/e2e/RTM.md`](frontend/tests/e2e/RTM.md).

**E2E artefacts** (git-ignored; populated at run time):

| Path | Purpose |
| --- | --- |
| `frontend/tests/e2e/test-output/results/` | Per-test traces, screenshots, videos — `npx playwright show-trace <path>/trace.zip` |
| `frontend/tests/e2e/test-output/report/html/` | Browsable Playwright HTML report |
| `frontend/tests/e2e/test-output/report/junit.xml` | JUnit XML for CI ingestion — `<testsuite>` entries tagged by EPIC folder |
| `frontend/tests/e2e/test-output/report/results.json` | Machine-readable results for dashboarding / RTM tooling |
| `frontend/tests/e2e/test-output/report/summary.md` | Per-EPIC pass/fail/skip markdown summary (written by `e2e:summary`) |

**Per-EPIC output mode** (`npm run e2e:per-epic`) — drops scoped folders side-by-side:

```text
frontend/tests/e2e/test-output/
├── report-epic-001-auth/{html,junit.xml,results.json,summary.md}
├── report-epic-002-upload/…
├── report-epic-003-preprocessing/…
├── report-epic-004-eda/…
├── report-epic-005-tracker/…
├── report-epic-006-dashboard/…
├── report-epic-007-reports/…
├── results-epic-001-auth/    # per-test artefacts scoped per EPIC
└── …
```

Opt-in manually: set `E2E_OUTPUT_SCOPE=<epic-folder>` before any
`npx playwright test` command and artefacts will nest under that scope.

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

## 12. Post-launch hardening — status

| # | Item | Status | Notes |
| --- | --- | --- | --- |
| 1 | Login-page UI polish | ✅ Done (`db7e8e9`) | Branded header, Remember-me, Forgot-password link, Show/Hide password, disabled-during-submit, improved error UI with `role="alert"` |
| 2 | Real-LLM wire-up (Nano Banana / OpenAI / Anthropic) | ✅ Done (`42520aa`) | Vision-first; shared tolerant JSON parser; 14 new unit tests; see §8 *Switching to a real LLM* |
| 3 | npm audit — backend | ✅ Done (`90cb491`) | `bcrypt 5 → 6` dropped transitive `tar` / `node-pre-gyp` advisories → **0 vulnerabilities** |
| 4 | npm audit — frontend | ✅ Done (`f884d96`) | `next 14 → 16` + `react 18 → 19` + `eslint 8 → 9` → **0 vulnerabilities** (cleared GHSA-9g9p-9gw9-jx7f / GHSA-h25m-26qc-wcjf / GHSA-ggv3-7p47-pfv8 / GHSA-3x4c-7xq6-9pq8 / GHSA-q4gf-8mx6-v5v3) |
| 5 | DLQ cosmetic — real `attempts` count | ✅ Done (`90cb491`) | `ImageFetchService` tracks `actualAttempts`; `PreprocessingService` extracts real count from caught exception |
| 6 | E2E Playwright suite | ✅ Done (`f884d96`) | 19 tests, EPIC-organised (`tests/e2e/epic-00N-*/`), full RTM trace in every spec header + consolidated [`RTM.md`](frontend/tests/e2e/RTM.md) |
| 7 | Auth EPIC-001 extras | ✅ Done (`db7e8e9`) | Password reset flow (`/auth/forgot` + `/auth/reset` + `/forgot-password` + `/reset-password` pages); refresh-rotation unit test; **security fix:** refresh-token hashing replaced with SHA-256 + `timingSafeEqual` (bcrypt truncates at 72 bytes, which silently broke refresh-token rotation since JWTs for the same user share a long common prefix) |

Remaining deliberate deferrals: none blocking demo.
