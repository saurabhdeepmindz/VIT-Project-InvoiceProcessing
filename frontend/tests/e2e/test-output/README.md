# Playwright test output

Populated at test time. Contents are git-ignored (see `.gitignore`).

## Two output modes

### Aggregate (default) — `npm run e2e`

Reports for the whole 25-test suite land in a single set of folders:

| Path | Producer | Purpose |
| --- | --- | --- |
| `results/` | `outputDir` | Per-test traces/screenshots/videos (only on failure). |
| `report/html/` | `html` reporter | Browsable HTML report (`index.html`). The search box filters by spec file — type `epic-001-auth` to scope. |
| `report/junit.xml` | `junit` reporter | JUnit XML. Each `<testsuite name="epic-XXX-…/foo.spec.ts">` is tagged with the EPIC folder — CI tools (GitHub Actions, Jenkins) group by EPIC automatically. |
| `report/results.json` | `json` reporter | Machine-readable. |
| `report/summary.md` | `npm run e2e:summary` | Per-EPIC pass/fail/skip table (generated from `results.json`). |

### Per-EPIC — `npm run e2e:per-epic`

Runs Playwright once per EPIC and drops each run's artefacts into its own
folder. Ideal for maintenance — each EPIC gets an isolated HTML report:

| Path | What's inside |
| --- | --- |
| `results-epic-001-auth/`, `results-epic-002-upload/`, … | Per-test artefacts scoped to that EPIC. |
| `report-epic-001-auth/{html,junit.xml,results.json,summary.md}` | Complete report set per EPIC. |
| `report-epic-002-upload/…` | Same structure, scoped. |
| `report-<epic>/summary.md` | Per-EPIC markdown summary, suitable for PR comments. |

Open a single EPIC's HTML report:

```bash
npx playwright show-report tests/e2e/test-output/report-epic-005-tracker/html
```

## Opting in from the config side

`playwright.config.ts` honours `E2E_OUTPUT_SCOPE`:

```bash
# Manual single-EPIC run with scoped outputs:
E2E_OUTPUT_SCOPE=epic-005-tracker npx playwright test epic-005-tracker
# Writes results-epic-005-tracker/ and report-epic-005-tracker/.
```

The `run-per-epic.mjs` orchestrator does this automatically for every EPIC
folder it discovers.
