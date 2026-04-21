/**
 * playwright.config.ts — Invoice Processing Platform E2E suite.
 *
 * Test specs live under tests/e2e/, organised by EPIC.
 * Artefacts (screenshots, videos, traces) land in tests/e2e/test-output/results/.
 * Reporter artefacts (HTML, JUnit XML, JSON) land in tests/e2e/test-output/report/.
 *
 * Run:
 *   npx playwright test                         # headless
 *   npx playwright test --ui                    # UI mode
 *   npx playwright show-report tests/e2e/test-output/report/html
 *
 * Requires:
 *   - Backend running on http://localhost:3001 (Nest)
 *   - Python AI service running on http://localhost:8001 (FastAPI)
 *   - Frontend auto-launches via webServer (or BASE_URL env override)
 */

import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const REUSE_SERVER = process.env.CI ? false : true;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './tests/e2e/test-output/results',
  fullyParallel: false,          // auth-dependent flows share seeded credentials
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: './tests/e2e/test-output/report/html', open: 'never' }],
    ['junit', { outputFile: './tests/e2e/test-output/report/junit.xml' }],
    ['json',  { outputFile: './tests/e2e/test-output/report/results.json' }],
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
