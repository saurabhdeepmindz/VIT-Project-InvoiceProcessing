# Playwright test output

Populated at test time. Contents are git-ignored.

| Sub-path                  | Producer                                           | Purpose                                                       |
| ------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `results/`                | `outputDir` in `playwright.config.ts`              | Per-test artefacts: trace.zip, screenshot at failure, video.  |
| `report/html/`            | `html` reporter                                    | Browsable HTML report (`index.html`).                         |
| `report/junit.xml`        | `junit` reporter                                   | JUnit XML, ingest in CI.                                      |
| `report/results.json`     | `json` reporter                                    | Machine-readable results for dashboards / RTM tooling.        |

Run `npx playwright test` from `frontend/` to populate this folder.
