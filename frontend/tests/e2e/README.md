# Invoice Processing Platform — End-to-End Tests

Playwright E2E suite covering EPIC-001..007. Specs are organised one folder
per EPIC; each spec header ships a full RTM block (EPIC, user story,
requirement IDs, acceptance criteria, traced source files). The consolidated
index lives in [`RTM.md`](./RTM.md).

## Layout

```text
tests/e2e/
├── RTM.md                             # consolidated traceability matrix
├── fixtures/
│   ├── accounts.ts                    # seeded admin/operator credentials
│   ├── auth.ts                        # loginAs / logout helpers
│   └── sample-invoices.csv            # upload fixture
├── epic-001-auth/
│   ├── login.spec.ts                  # US-001.1
│   ├── forgot-password.spec.ts        # US-001.2
│   └── rbac.spec.ts                   # US-001.3
├── epic-002-upload/
│   └── csv-upload.spec.ts             # US-002.1
├── epic-003-preprocessing/            # *observation spec
│   └── pipeline-lifecycle.spec.ts     # US-003.1
├── epic-004-eda/                      # *observation spec
│   └── extraction-fields.spec.ts      # US-004.1
├── epic-005-tracker/
│   ├── tracker-list.spec.ts           # US-005.1
│   └── tracker-detail.spec.ts         # US-005.2
├── epic-006-dashboard/
│   └── dashboard.spec.ts              # US-006.1
├── epic-007-reports/
│   └── reports.spec.ts                # US-007.1
└── test-output/
    ├── results/                       # per-test traces, screenshots, videos
    └── report/
        ├── html/                      # Playwright HTML report
        ├── junit.xml                  # JUnit XML for CI ingestion
        └── results.json               # machine-readable results
```

## Running

Start the backend, Python AI service, and the frontend (or rely on the
`webServer` block in `playwright.config.ts` which auto-launches `npm run dev`
when the target URL is unreachable).

```bash
# From frontend/
npx playwright install chromium            # one-time browser install
npx playwright test                        # run everything headless
npx playwright test epic-001-auth          # scope to one EPIC
npx playwright test --ui                   # interactive mode
npx playwright show-report tests/e2e/test-output/report/html
```

Environment overrides (all optional):

| Variable               | Default                                 | Purpose                                            |
| ---------------------- | --------------------------------------- | -------------------------------------------------- |
| `E2E_BASE_URL`         | `http://localhost:3000`                 | Override where the app runs; disables `webServer`. |
| `E2E_ADMIN_EMAIL`      | `admin@invoice-platform.local`          | Seeded admin credentials.                          |
| `E2E_ADMIN_PASSWORD`   | `ChangeMe!Admin#2026`                   | Seeded admin credentials.                          |
| `E2E_OPERATOR_EMAIL`   | `operator@invoice-platform.local`       | Seeded operator credentials.                       |
| `E2E_OPERATOR_PASSWORD`| `ChangeMe!Op#2026`                      | Seeded operator credentials.                       |
| `CI`                   | —                                       | Enables retries, forbids `test.only`, workers = 1. |

## Output artefacts

All artefacts are written under `tests/e2e/test-output/` (kept out of git
via `frontend/.gitignore`).

* `results/` — per-test directories. A failed run holds a Playwright trace
  (`.zip`), a screenshot at failure (`.png`), and the session video
  (`.webm`). Inspect via `npx playwright show-trace tests/e2e/test-output/results/<run>/trace.zip`.
* `report/html/` — the HTML report. Open `index.html` directly or use
  `npx playwright show-report tests/e2e/test-output/report/html`.
* `report/junit.xml` — JUnit XML suitable for CI ingestion.
* `report/results.json` — machine-readable JSON of every test outcome.

## RTM annotations

Each spec file opens with a block of the form:

```text
EPIC:          EPIC-XXX — <name>
User Story:    US-XXX.Y   <narrative>
Requirements:  REQ-XXX.Z1, REQ-XXX.Z2, ...
Acceptance:    <given the narrative, what the test proves>
RTM Trace:     <backend symbols>
               <frontend pages / services>
```

See [`RTM.md`](./RTM.md) for the consolidated traceability matrix.
