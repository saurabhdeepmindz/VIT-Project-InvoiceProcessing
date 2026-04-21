/**
 * E2E Spec: EPIC-005 / User Story 005.1 — Batch Tracker List
 *
 * EPIC:          EPIC-005 — Processing Status Tracker
 * User Story:    US-005.1  As an operator I want to see all batches and their
 *                           current processing status so that I can monitor
 *                           the pipeline end-to-end.
 * Requirements:  REQ-005.1 /tracker renders a paginated list of batches
 *                REQ-005.2 Each row shows batch ID, file name, status, record counts
 *                REQ-005.3 Status column uses colour-coded badges
 *                REQ-005.4 Clicking a row navigates to the batch detail page
 * Acceptance:    List view loads, displays header columns, and supports
 *                drill-down to detail.
 * RTM Trace:     backend/src/tracker/controller/tracker.controller.ts#list
 *                backend/src/tracker/service/tracker.service.ts#listFiles
 *                frontend/src/app/tracker/page.tsx
 *                frontend/src/services/tracker.api.ts#listTracker
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

test.describe('EPIC-005 Tracker · List view', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/tracker');
  });

  test('US-005.1 / REQ-005.1,2 list page renders headline columns', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /tracker|batches|files/i })).toBeVisible();
    for (const column of [/file/i, /status/i, /records/i]) {
      await expect(page.getByText(column).first()).toBeVisible();
    }
  });

  test('US-005.1 / REQ-005.4 clicking a row navigates to detail view', async ({ page }) => {
    const firstRowLink = page.locator('a[href^="/tracker/"]').first();
    const count = await firstRowLink.count();
    test.skip(count === 0, 'No batches present yet — skip drill-down');

    await firstRowLink.click();
    await page.waitForURL(/\/tracker\/[^/]+$/);
    await expect(page).toHaveURL(/\/tracker\/[^/]+$/);
  });
});
