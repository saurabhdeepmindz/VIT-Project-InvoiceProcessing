/**
 * E2E Spec: EPIC-005 / User Story 005.2 — Batch Detail & Extraction Fields
 *
 * EPIC:          EPIC-005 — Processing Status Tracker
 * User Story:    US-005.2  As an operator I want to drill into a batch and
 *                           inspect per-record extraction, audit tail, and
 *                           dead-letter entries so that I can diagnose
 *                           processing issues.
 * Requirements:  REQ-005.5  /tracker/:batchId loads a summary block
 *                REQ-005.6  Per-record table exposes the 13 extracted fields
 *                           (dealer_name, customer_name, invoice_number, ...)
 *                REQ-005.7  Audit tail shows recent audit_log entries
 *                REQ-005.8  DLQ section lists dead-lettered records
 * Acceptance:    Detail view renders the summary, extraction fields, audit
 *                tail, and DLQ panel.
 * RTM Trace:     backend/src/tracker/controller/tracker.controller.ts#detail
 *                backend/src/tracker/service/tracker.service.ts#getDetail
 *                frontend/src/app/tracker/[batchId]/page.tsx
 *                frontend/src/services/tracker.api.ts#getTrackerDetail
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

test.describe('EPIC-005 Tracker · Detail view', () => {
  test('US-005.2 / REQ-005.5,6 detail page exposes summary + extraction fields', async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/tracker');

    // Find a DONE batch row so the 13 extraction fields are actually populated.
    // Read the batchId directly off the row's <a> so we can't pick up a stray
    // navigation link. Fall back to skip if no DONE batches exist yet.
    const doneRow = page.locator('tbody tr').filter({ hasText: /DONE/i }).first();
    const rowCount = await doneRow.count();
    test.skip(rowCount === 0, 'No DONE batch row present — upload and process one first');

    const batchId = await doneRow.locator('a[href^="/tracker/"]').first().getAttribute('href');
    test.skip(!batchId || !/^\/tracker\/[0-9a-f]{8}-/.test(batchId ?? ''), 'DONE row has no valid batchId link');
    await page.goto(batchId!);
    await page.waitForLoadState('networkidle');

    const main = page.getByRole('main');
    await expect(main.getByText(/batch status|records/i).first()).toBeVisible();

    // Summary + always-visible record columns (Invoice # / Dealer / Customer).
    for (const pattern of [/dealer/i, /customer/i, /invoice\s*(#|number|no)/i]) {
      await expect(main.getByText(pattern).first()).toBeVisible();
    }

    // Expand the first record row so the remaining fields (tyre size, invoice
    // date, tyre pattern, comments, llm provider) become visible.
    const firstToggle = main.getByRole('row').filter({ hasText: /▸/ }).first();
    if (await firstToggle.count()) {
      await firstToggle.click();
      await expect(main.getByText(/tyre size/i).first()).toBeVisible();
    }
  });
});
