/**
 * playwright.config.ts — Invoice Processing Platform E2E suite.
 *
 * Test specs live under tests/e2e/, organised by EPIC.
 *
 * Output layout (default — aggregate run):
 *   tests/e2e/test-output/results/             per-test failure artefacts
 *   tests/e2e/test-output/report/html/         browsable HTML report
 *   tests/e2e/test-output/report/junit.xml     CI ingestion (groups by EPIC testsuite)
 *   tests/e2e/test-output/report/results.json  machine-readable
 *
 * Output layout (per-EPIC — when E2E_OUTPUT_SCOPE is set):
 *   tests/e2e/test-output/results-<scope>/
 *   tests/e2e/test-output/report-<scope>/{html,junit.xml,results.json}
 *
 * The orchestrator script `tests/e2e/run-per-epic.mjs` sets E2E_OUTPUT_SCOPE
 * per EPIC so each EPIC's reports land in its own folder side-by-side.
 *
 * Run:
 *   npx playwright test                         # headless, aggregate
 *   npx playwright test --ui                    # UI mode
 *   npm run e2e:per-epic                        # one report folder per EPIC
 *   npm run e2e:summary                         # print per-EPIC pass/fail table
 *   npm run e2e:report                          # open aggregate HTML report
 *
 * Requires:
 *   - Backend running on http://localhost:3001 (Nest)
 *   - Python AI service running on http://localhost:8001 (FastAPI)
 *   - Frontend auto-launches via webServer (or BASE_URL env override)
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const REUSE_SERVER = process.env.CI ? false : true;

const scope = (process.env.E2E_OUTPUT_SCOPE ?? '').trim();
const suffix = scope ? `-${scope}` : '';
const resultsDir = `./tests/e2e/test-output/results${suffix}`;
const reportDir = `./tests/e2e/test-output/report${suffix}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: resultsDir,
  fullyParallel: false,          // auth-dependent flows share seeded credentials
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html',  { outputFolder: `${reportDir}/html`, open: 'never' }],
    ['junit', { outputFile:   `${reportDir}/junit.xml` }],
    ['json',  { outputFile:   `${reportDir}/results.json` }],
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
