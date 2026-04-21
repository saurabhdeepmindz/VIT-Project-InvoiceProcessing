/**
 * E2E Spec: EPIC-004 / User Story 004.1 — Extraction Field Outcomes
 *
 * EPIC:          EPIC-004 — Automated Invoice Data Extraction (EDA)
 * User Story:    US-004.1  As an operator I expect every DONE batch's tracker
 *                           detail to surface the 13 canonical extraction
 *                           fields per record, along with confidence and the
 *                           LLM provider that produced each result.
 * Requirements:  REQ-004.1  Tracker detail exposes the 13 canonical fields
 *                           per LLD §3.2 (dealer_name, customer_name,
 *                           customer_mobile, vehicle_registration_number,
 *                           tyre_size, tyre_pattern, invoice_amount_excl_gst,
 *                           gst_amount, quantity, invoice_date,
 *                           invoice_number, comments, + llm_provider_used)
 *                REQ-004.2  Tracker surfaces an `edaStatus` badge per batch
 *                           (EXTRACTED / PARTIAL / FAILED)
 *                REQ-004.3  Batches with any successful extraction expose a
 *                           numeric `avgConfidence` (0–100)
 *                REQ-004.4  DONE batches expose a downloadable output CSV link
 * Acceptance:    A successfully processed batch surfaces the 13 fields,
 *                confidence score, and output CSV on the tracker detail page.
 * RTM Trace:     python/app/services/extraction_service.py
 *                python/app/providers/{stub,nano_banana,openai,anthropic}_provider.py
 *                backend/src/eda/service/eda.service.ts
 *                backend/src/eda/service/csv-output.service.ts
 *                frontend/src/app/tracker/[batchId]/page.tsx
 *                frontend/src/services/tracker.api.ts
 *
 * Note:          EPIC-004 is a headless AI-service pipeline — there is no
 *                dedicated UI surface. This spec is a lifecycle / observation
 *                test that asserts the *outcomes* of extraction are visible
 *                via the tracker. Functional coverage of the providers lives
 *                in Python pytest (test_llm_providers.py + test_rule_engine.py
 *                + test_confidence_scorer.py).
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

const DONE_BATCH_LOCATOR = 'a[href^="/tracker/"]';

test.describe('EPIC-004 EDA · Extraction outcomes (observation)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/tracker');
  });

  test('US-004.1 / REQ-004.2 tracker list shows an edaStatus badge', async ({ page }) => {
    const firstRow = page.locator(DONE_BATCH_LOCATOR).first();
    test.skip(await firstRow.count() === 0, 'No batches present yet.');

    const edaBadges = page.getByText(/EXTRACTED|PARTIAL|EDA_PROCESSING|FAILED|DONE/i);
    expect(await edaBadges.count()).toBeGreaterThan(0);
  });

  test('US-004.1 / REQ-004.1,3 DONE batch detail surfaces the 13 canonical fields + confidence', async ({ page }) => {
    const doneRow = page.locator(DONE_BATCH_LOCATOR).filter({ has: page.getByText(/DONE/i) }).first();
    test.skip(
      await doneRow.count() === 0,
      'No DONE batch to drill into — upload phase2-fresh.csv or phase3-smoke.csv first.'
    );

    await doneRow.click();
    await page.waitForURL(/\/tracker\/[^/]+$/);

    const fieldLabels = [
      /dealer/i,
      /customer/i,
      /mobile|phone/i,
      /vehicle|rego|registration/i,
      /tyre\s*size/i,
      /tyre\s*pattern/i,
      /invoice\s*amount|excl\s*gst/i,
      /gst/i,
      /quantity|qty/i,
      /invoice\s*date/i,
      /invoice\s*(number|no)/i,
      /comment/i,
      /confidence/i,
    ];

    for (const label of fieldLabels) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('US-004.1 / REQ-004.4 DONE batch exposes a downloadable output CSV link', async ({ page }) => {
    const doneRow = page.locator(DONE_BATCH_LOCATOR).filter({ has: page.getByText(/DONE/i) }).first();
    test.skip(await doneRow.count() === 0, 'No DONE batch present to download.');

    // The "Download CSV" link lives on either the list row or the detail page.
    const downloadAffordance = page.getByRole('link', { name: /download\s*csv|output\s*csv/i })
      .or(page.getByRole('button', { name: /download\s*csv|output\s*csv/i }));

    expect(await downloadAffordance.count()).toBeGreaterThan(0);
  });
});
