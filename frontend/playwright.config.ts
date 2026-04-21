/**
 * playwright.config.ts — Invoice Processing Platform E2E suite.
 *
 * Test specs live under tests/e2e/, organised by EPIC.
 *
 * Output layout — every run gets its own folder, history is preserved:
 *   tests/e2e/test-output/
 *   ├── runs/2026-04-21/run-01/
 *   │   ├── report/{html,junit.xml,results.json,summary.md}    aggregate
 *   │   ├── report-epic-001-auth/                              (per-EPIC mode)
 *   │   ├── results/                                           failure artefacts
 *   │   └── results-epic-001-auth/                             (per-EPIC mode)
 *   ├── runs/2026-04-21/run-02/…
 *   ├── runs/2026-04-22/run-01/…
 *   ├── latest/                                                copy of most recent run
 *   └── latest.json                                            { "runDir": "runs/…/run-XX" }
 *
 * Retention:
 *   E2E_KEEP_RUNS integer (default 10). Pruning is idempotent; set 0 to disable.
 *
 * Pinning (used by run-per-epic orchestrator so all EPICs share one run folder):
 *   E2E_RUN_DIR=<absolute path>   Reuse this run directory instead of making a new one.
 *
 * Per-EPIC within a run (optional):
 *   E2E_OUTPUT_SCOPE=epic-001-auth → nests under report-epic-001-auth/ etc.
 *
 * Run:
 *   npx playwright test                         # aggregate, creates new run folder
 *   npx playwright test --ui                    # UI mode
 *   npm run e2e:per-epic                        # one report subfolder per EPIC, same run folder
 *   npm run e2e:summary                         # per-EPIC pass/fail table
 *   npm run e2e:report                          # open latest run's HTML report
 */

import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeRunDir } = require('./tests/e2e/lib/run-dir.js') as {
  computeRunDir: (outputRoot: string) => string;
};

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const REUSE_SERVER = process.env.CI ? false : true;

const outputRoot = resolve(__dirname, 'tests', 'e2e', 'test-output');
// computeRunDir pins E2E_RUN_DIR on first call so subsequent config loads
// (workers, teardown) reuse the same folder.
const runDir = computeRunDir(outputRoot);

const scope = (process.env.E2E_OUTPUT_SCOPE ?? '').trim();
const suffix = scope ? `-${scope}` : '';
const resultsDir = resolve(runDir, `results${suffix}`);
const reportDir = resolve(runDir, `report${suffix}`);

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: resultsDir,
  globalTeardown: resolve(__dirname, 'tests', 'e2e', 'global-teardown.js'),
  fullyParallel: false,          // auth-dependent flows share seeded credentials
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html',  { outputFolder: resolve(reportDir, 'html'), open: 'never' }],
    ['junit', { outputFile:   resolve(reportDir, 'junit.xml') }],
    ['json',  { outputFile:   resolve(reportDir, 'results.json') }],
  ],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: REUSE_SERVER,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
