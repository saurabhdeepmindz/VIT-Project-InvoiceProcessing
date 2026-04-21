/**
 * E2E Spec: EPIC-007 / User Story 007.1 — Report Generation
 *
 * EPIC:          EPIC-007 — Reporting Module
 * User Story:    US-007.1  As an operations lead I want to generate and
 *                           download single-batch, weekly, and error reports
 *                           so that I can share processing outcomes with
 *                           stakeholders.
 * Requirements:  REQ-007.1  /reports renders three report-type tabs
 *                REQ-007.2  Submitting the single-batch form accepts a batch ID
 *                REQ-007.3  Report history lists previously generated files
 *                REQ-007.4  Download action issues a signed URL fetch
 * Acceptance:    Reports page renders tabs, accepts input, surfaces history.
 * RTM Trace:     backend/src/reporting/controller/reporting.controller.ts
 *                backend/src/reporting/service/reporting.service.ts
 *                frontend/src/app/reports/page.tsx
 *                frontend/src/services/reporting.api.ts
 */

import { test, expect } from '@playwright/test';

import { ADMIN } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

test.describe('EPIC-007 Reporting · Generator + history', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
    await page.goto('/reports');
  });

  test('US-007.1 / REQ-007.1 reports page renders the three report-type tabs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
    for (const tab of [/single/i, /weekly/i, /error/i]) {
      await expect(page.getByText(tab).first()).toBeVisible();
    }
  });

  test('US-007.1 / REQ-007.3 history panel is reachable', async ({ page }) => {
    await expect(page.getByText(/history|previous|generated/i).first()).toBeVisible();
  });
});
