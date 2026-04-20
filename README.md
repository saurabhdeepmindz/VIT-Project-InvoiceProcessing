# Invoice Processing Platform — Phase 0 (Foundation)

Bridgestone Invoice Processing Platform built to the spec in `docs/InvoiceProcessing_LLD_v3.0.docx` plus `docs/InvoiceProcessing_LLD_v3.1_Addendum.docx`.

## Phase 0 — what this commit ships

This commit delivers the **foundation** layer that every EPIC module depends on:

| Area | Files / Notes |
|---|---|
| Root config | `.env.sample` (full v3.0 + v3.1 vars), `package.json` (workspaces), `.gitignore` |
| DB schema | 11 migrations in `db/migrations/` + seed in `db/seeds/` — all v3.0 + v3.1 tables upfront |
| Backend — runtime | `backend/src/{main,app.module,config/configuration,database/data-source}.ts` |
| Backend — common | `AppLogger`, `HttpExceptionFilter`, `LoggingInterceptor`, `MetricsInterceptor`, `RolesGuard`, `JwtAuthGuard`, `@Roles`, `@Public`, `@CurrentUser`, 11 exception classes |
| Backend — storage | `FileStorageService` + `LocalStorageAdapter` (Windows-ready), module global |
| Backend — health | `/health`, `/ready`, `/metrics` endpoints |
| Backend — EPIC-001 | Full minimal auth (login, refresh-rotation, logout, me, JWT access+refresh, bcrypt, seeded admin + operator) |
| Python AI | FastAPI shell + `/health`, `/ready`, `/metrics`, provider factory with **`USE_STUB_PROVIDER`** toggle, `StubProvider` |
| Frontend | Next.js 14 shell, login page, Tailwind theme from wireframe palette, api/auth clients |

EPIC modules 002–007 are **not** part of Phase 0 — their pseudo-files remain at their existing locations with `TODO:` bodies and will be elaborated in Phases 1–6.

---

## Prerequisites (your local environment)

- **Node.js 24.14.0**+ (`node --version`)
- **Python 3.11** (`py -3.11 --version`)
- **PostgreSQL 18** (`psql --version`)
- **Tesseract OCR** (optional; only needed for OCR corroboration path) — install from https://github.com/UB-Mannheim/tesseract/wiki on Windows, then set `TESSERACT_CMD` in `.env`

---

## Setup (fresh machine)

### 1. Copy env

```bash
cd InvoiceProcessing_PseudoFiles_v3.0
cp .env.sample .env
```

Edit `.env`:
- **`DATABASE_PASSWORD`** — whatever you set when creating the Postgres role
- **`JWT_ACCESS_SECRET`** and **`JWT_REFRESH_SECRET`** — 64+ char random strings each
- **`LOCAL_STORAGE_PATH`** — absolute Windows path (default `D:/invoice-processing-data/storage`)
- Leave **`USE_STUB_PROVIDER=true`** for now (no LLM keys needed)

### 2. Database

```bash
# Create DB + user (one-off)
psql -U postgres -c "CREATE USER invoice_user WITH PASSWORD 'yourpassword';"
psql -U postgres -c "CREATE DATABASE invoice_processing OWNER invoice_user;"

# Apply migrations (run in order)
cd db/migrations
for f in *.sql; do psql -U invoice_user -d invoice_processing -f "$f"; done
```

### 3. Install dependencies

```bash
# From project root
npm install                  # installs backend + frontend workspaces

# Python
cd python
py -3.11 -m venv .venv
.venv\Scripts\activate       # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
cd ..
```

### 4. Run (3 terminals)

| Terminal | Command | Port |
|---|---|---|
| Backend | `npm run backend:dev` | 3001 |
| Python AI | `cd python && uvicorn app.main:app --port 8001 --reload` | 8001 |
| Frontend | `npm run frontend:dev` | 3000 |

Seeded demo users (created on first backend boot):
- `admin@invoice-platform.local` / `ChangeMe!Admin#2026`
- `operator@invoice-platform.local` / `ChangeMe!Op#2026`

### 5. Verify

- Frontend: http://localhost:3000/login
- Swagger: http://localhost:3001/api/docs
- Health: http://localhost:3001/health → `{"status":"ok", ...}`
- Ready:  http://localhost:3001/ready  → checks DB + Python AI
- Python: http://localhost:8001/health → `{"llm_provider":"stub", ...}`

---

## Environment variable highlights (v3.1)

| Var | Purpose | Phase 0 default |
|---|---|---|
| `USE_STUB_PROVIDER` | Overrides LLM_PROVIDER with canned-response stub when true | `true` |
| `EXTRACTION_MODE` | `vision_first` (new primary) or `ocr_first` | `vision_first` |
| `IMG_MAX_DOWNLOAD_MB` | Cap for image downloads from CSV URLs | `30` |
| `IMG_DOWNLOAD_TIMEOUT_MS` | Per-image timeout | `180000` (3 min) |
| `IMG_DOWNLOAD_RETRY` | Retries on transient network error | `3` |
| `IMG_URL_HOST_ALLOWLIST` | Comma-separated hostnames; `*` disables check | Bridgestone demo host |
| `DLQ_ENABLED` | Dead-letter queue for permanently-failed records | `true` |
| `STORAGE_PROVIDER` | `local` \| `s3` \| `minio` | `local` |
| `LOCAL_STORAGE_PATH` | Absolute path for local FS adapter | `D:/invoice-processing-data/storage` |

Switch to a real LLM:
```env
USE_STUB_PROVIDER=false
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

---

## Project layout

```
InvoiceProcessing_PseudoFiles_v3.0/
├─ .env.sample                       # v3.1 template (full)
├─ package.json                      # workspace root
├─ db/
│  ├─ migrations/                    # 11 SQL files — apply in order
│  └─ seeds/
├─ docs/                             # LLD + addendum + wireframes + samples
├─ backend/                          # NestJS API
│  ├─ package.json, tsconfig.json, nest-cli.json
│  ├─ scripts/hash-password.js       # util: bcrypt a plaintext
│  └─ src/
│     ├─ main.ts, app.module.ts
│     ├─ config/configuration.ts
│     ├─ database/{data-source,database.module}.ts
│     ├─ common/
│     │  ├─ logger/AppLogger.ts
│     │  ├─ filters/HttpExceptionFilter.ts
│     │  ├─ interceptors/{LoggingInterceptor,MetricsInterceptor}.ts
│     │  ├─ guards/{JwtAuthGuard,RolesGuard}.ts
│     │  ├─ decorators/{roles,public,current-user}.decorator.ts
│     │  └─ exceptions/index.ts       # all custom exceptions
│     ├─ file-storage/
│     │  ├─ FileStorageService.ts, file-storage.module.ts
│     │  └─ adapters/local.adapter.ts
│     ├─ health/{health.controller,health.module}.ts
│     ├─ auth/                        # EPIC-001 minimal
│     │  ├─ auth.{controller,service,module}.ts
│     │  ├─ dto/{login,refresh,auth-response}.dto.ts
│     │  ├─ strategies/{jwt,refresh}.strategy.ts
│     │  └─ entities/user.entity.ts
│     ├─ entities/Entities.ts         # v3.1 schema (csv_content_hash, source_url, image_hash, page_count, DLQ)
│     ├─ invoice/                     # EPIC-002 — pseudo; elaborated in Phase 1
│     ├─ preprocessing/               # EPIC-003 — pseudo; elaborated in Phase 2
│     ├─ eda/                         # EPIC-004 — pseudo; elaborated in Phase 3
│     ├─ tracker/                     # EPIC-005 — pseudo; elaborated in Phase 4
│     ├─ dashboard/                   # EPIC-006 — pseudo; elaborated in Phase 5
│     └─ reporting/                   # EPIC-007 — pseudo; elaborated in Phase 6
├─ python/                            # FastAPI AI microservice
│  ├─ pyproject.toml
│  └─ app/
│     ├─ main.py
│     ├─ config/settings.py           # USE_STUB_PROVIDER toggle
│     ├─ utils/logger.py
│     ├─ providers/
│     │  ├─ base_provider.py          # vision-first (v3.1)
│     │  ├─ stub_provider.py          # canned responses — Phase 0 default
│     │  ├─ provider_factory.py
│     │  ├─ nano_banana_provider.py   # pseudo; elaborated in Phase 3
│     │  └─ anthropic_provider.py     # pseudo; elaborated in Phase 3
│     ├─ routers/                     # pseudo; elaborated in Phase 3
│     └─ services/                    # pseudo; elaborated in Phase 3
└─ frontend/
   ├─ package.json, tsconfig.json, next.config.mjs, tailwind.config.ts
   └─ src/
      ├─ app/{layout,page}.tsx
      ├─ app/login/page.tsx           # Phase 0 login
      ├─ app/DashboardAndReportsPage.tsx   # pseudo; Phases 5+6
      ├─ app/InvoiceUploadPage.tsx         # pseudo; Phase 1
      ├─ app/StatusTrackerPage.tsx         # pseudo; Phase 4
      ├─ lib/api.ts                   # fetch wrapper
      └─ services/auth.api.ts         # login / logout / me
```

---

## Next — Phase 1 (EPIC-002 Ingestion)

Waiting for your go-ahead to start. Phase 1 scope:

1. Elaborate `InvoiceController`, `InvoiceService`, `InvoiceValidator`, `InvoiceTransformer` per v3.1 (CSV-manifest model, no image upload).
2. CSV parser + URL allowlist validator + `csv_content_hash` idempotency.
3. `invoice.uploaded` event emission.
4. Frontend `InvoiceUploadPage` elaboration (CSV-only drop zone, progress feedback).
5. Unit tests (Jest) + integration tests (Supertest + real Postgres via docker-compose or manual setup) with ≥80% coverage.

Open questions before Phase 1:
- Do you want Phase 1 to include real upload end-to-end (CSV → DB → event) but stop short of URL download? (URL download is Phase 2 / EPIC-003.)
- Any UI-level edits you want to request after you've seen the login page?
