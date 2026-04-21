# Playwright test output

Populated at test time. Contents are git-ignored (see `.gitignore`).

## Per-run folder layout — history is preserved

Every Playwright invocation lands in its own timestamped run folder so
previous runs are never overwritten:

```text
tests/e2e/test-output/
├── runs/
│   ├── 2026-04-21/
│   │   ├── run-01/
│   │   │   ├── report/{html,junit.xml,results.json,summary.md}
│   │   │   ├── results/                                          per-test failure artefacts
│   │   │   ├── report-epic-001-auth/     (per-EPIC orchestrator creates these)
│   │   │   └── results-epic-001-auth/    (per-EPIC orchestrator creates these)
│   │   ├── run-02/
│   │   └── run-03/
│   └── 2026-04-22/
│       └── run-01/
├── latest/                ← file copy of the most recent run
│   └── report/html/       ← `npm run e2e:report` opens this
├── latest.json            ← { "runDir": "runs/2026-04-21/run-03", … }
└── README.md
```

## Retention

`E2E_KEEP_RUNS` (env var, default `10`) caps the number of runs kept on
disk. After each Playwright invocation, global-teardown prunes everything
older than the cap (sorted by modified time). Set `E2E_KEEP_RUNS=0` to
disable pruning.

```bash
# Keep only the 5 most recent runs for this invocation
E2E_KEEP_RUNS=5 npm run e2e
```

## Artefact reference

| Artefact | Producer | Purpose |
| --- | --- | --- |
| `runs/<day>/run-XX/report/html/` | `html` reporter | Browsable HTML report. Search box filters by spec file — type `epic-001-auth` to scope. |
| `runs/<day>/run-XX/report/junit.xml` | `junit` reporter | JUnit XML. Each `<testsuite name="epic-XXX-…/foo.spec.ts">` is tagged with the EPIC folder — CI tools group automatically. |
| `runs/<day>/run-XX/report/results.json` | `json` reporter | Machine-readable. |
| `runs/<day>/run-XX/report/summary.md` | `npm run e2e:summary` | Per-EPIC pass/fail/skip table. |
| `runs/<day>/run-XX/results/` | `outputDir` | Per-test traces/screenshots/videos (only on failure). |
| `runs/<day>/run-XX/report-epic-XXX/` | per-EPIC orchestrator | Same four reporter files, scoped to one EPIC. |
| `latest/` | global-teardown | Convenience copy of the most recent run. |
| `latest.json` | global-teardown | Pointer (`{"runDir": "..."}`) for tooling. |

## Useful commands

```bash
# Open the most recent run's HTML report
npm run e2e:report

# Per-EPIC breakdown of the most recent run
npm run e2e:summary

# Open a specific older run
npx playwright show-report tests/e2e/test-output/runs/2026-04-21/run-01/report/html

# Open a specific EPIC from a specific run
npx playwright show-report tests/e2e/test-output/runs/2026-04-21/run-01/report-epic-005-tracker/html

# List all kept runs
ls -l tests/e2e/test-output/runs/
```

## Environment knobs

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_RUN_DIR` | (auto) | Pin a specific run folder instead of creating a new one. Set by `run-per-epic.mjs`. |
| `E2E_KEEP_RUNS` | `10` | Retention cap. `0` disables pruning. |
| `E2E_OUTPUT_SCOPE` | (unset) | Nest under `report-<scope>/`. Set by `run-per-epic.mjs`. |
