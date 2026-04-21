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

    const firstRowLink = page.locator('a[href^="/tracker/"]').first();
    test.skip(await firstRowLink.count() === 0, 'No batches to drill into');
    await firstRowLink.click();
    await page.waitForURL(/\/tracker\/[^/]+$/);

    await expect(page.getByText(/file name|batch|status/i).first()).toBeVisible();

    const extractionHints = [
      /dealer/i,
      /customer/i,
      /invoice number|inv(?:oice)?[^a-z]*no/i,
      /tyre size/i,
    ];
    for (const pattern of extractionHints) {
      await expect(page.getByText(pattern).first()).toBeVisible();
    }
  });
});
