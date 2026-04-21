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
npm run e2e:install            # one-time: download Chromium
npm run e2e                    # aggregate run — every EPIC, one report folder
npm run e2e:per-epic           # one report folder per EPIC (maintenance)
npm run e2e:auth               # scope to a single EPIC (+ its shortcuts)
npm run e2e:ui                 # interactive Playwright UI
npm run e2e:summary            # print pass/fail table + write summary.md
npm run e2e:report             # open aggregate HTML report
```

### History-preserving output

**Every run lands in its own timestamped folder** —
`tests/e2e/test-output/runs/YYYY-MM-DD/run-XX/`. Nothing is overwritten.
`npm run e2e:report` opens the most recent run via a `latest/` pointer
that global-teardown keeps up-to-date.

```text
tests/e2e/test-output/
├── runs/2026-04-21/run-01/{report,results}/
├── runs/2026-04-21/run-02/…
├── runs/2026-04-22/run-01/…
├── latest/report/html/              ← refreshed after every run
└── latest.json                      ← { "runDir": "runs/…/run-XX" }
```

**Aggregate mode (`npm run e2e`)** — CI-idiomatic: one JUnit XML, one HTML
report, one `results.json` covering all 25 tests. JUnit's `<testsuite>`
name prefixes every entry with its EPIC folder so GitHub Actions / Jenkins
dashboards group by EPIC automatically. `npm run e2e:summary` renders a
per-EPIC table and writes `summary.md` next to the JSON.

**Per-EPIC mode (`npm run e2e:per-epic`)** — maintenance-friendly: the
orchestrator `tests/e2e/run-per-epic.mjs` reserves ONE run folder up-front,
then invokes Playwright once per EPIC with `E2E_RUN_DIR` pinned and
`E2E_OUTPUT_SCOPE=<epic>` set, so all EPIC artefacts land inside the same
run folder as side-by-side subfolders:

```text
tests/e2e/test-output/runs/2026-04-21/run-03/
  report-epic-001-auth/{html,junit.xml,results.json,summary.md}
  report-epic-002-upload/…
  results-epic-001-auth/
  …
```

Open a specific EPIC from a specific run:

```bash
npx playwright show-report tests/e2e/test-output/runs/2026-04-21/run-03/report-epic-005-tracker/html
```

### Retention

`E2E_KEEP_RUNS` (env var, default `10`) caps how many runs stay on disk.
Oldest are pruned after each invocation. Set to `0` to disable pruning.

```bash
E2E_KEEP_RUNS=30 npm run e2e        # keep up to 30 runs
E2E_KEEP_RUNS=0  npm run e2e        # keep everything (careful — disk bloat)
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

All artefacts are written under `tests/e2e/test-output/` (git-ignored).
See [`test-output/README.md`](./test-output/README.md) for the full layout
including per-EPIC folders. Quick reference:

* `results/` (or `results-<epic>/`) — per-test traces, failure screenshots,
  videos. Inspect with `npx playwright show-trace <path>/trace.zip`.
* `report/html/` (or `report-<epic>/html/`) — browsable HTML report.
* `report/junit.xml` — JUnit XML; `<testsuite>` names prefix with EPIC
  folder so CI dashboards group automatically.
* `report/results.json` — machine-readable JSON.
* `report/summary.md` — per-EPIC pass/fail table, re-generate with
  `npm run e2e:summary`.

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
