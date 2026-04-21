/**
 * E2E Spec: EPIC-003 / User Story 003.1 — Preprocessing Pipeline Lifecycle
 *
 * EPIC:          EPIC-003 — Preprocessing Pipeline
 * User Story:    US-003.1  As an operator I need the system to fetch invoice
 *                           images from each CSV URL, hash-dedup them, inspect
 *                           PDFs, persist them to storage, and signal the EDA
 *                           stage so that the downstream extraction pipeline
 *                           has everything it needs.
 * Requirements:  REQ-003.1  Preprocessing runs asynchronously after upload
 *                REQ-003.2  Tracker exposes a dedicated `preprocessingStatus`
 *                           badge per batch (PREPROCESSING / PREPROCESSED /
 *                           FAILED)
 *                REQ-003.3  Batch `batchStatus` transitions through
 *                           UPLOADED → PREPROCESSING → PREPROCESSED /
 *                           EDA_PROCESSING → DONE / PARTIAL / FAILED
 *                REQ-003.4  Permanently-failing records land in the DLQ
 *                           (observed via tracker detail)
 * Acceptance:    The tracker list and detail views surface preprocessing
 *                outcomes (status badge + record counts) for every batch.
 * RTM Trace:     backend/src/preprocessing/scheduler/preprocessing.scheduler.ts
 *                backend/src/preprocessing/service/preprocessing.service.ts
 *                backend/src/preprocessing/service/image-fetch.service.ts
 *                backend/src/preprocessing/service/pdf-inspect.service.ts
 *                backend/src/dead-letter/dead-letter.service.ts
 *                frontend/src/app/tracker/page.tsx
 *                frontend/src/services/tracker.api.ts
 *
 * Note:          EPIC-003 is a headless, server-side pipeline — there is no
 *                dedicated UI surface. This spec is a lifecycle / observation
 *                test that asserts the outcomes of preprocessing are visible
 *                via the tracker. Functional coverage of the pipeline itself
 *                lives in backend Jest (ImageFetchService, PdfInspectService).
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

const ANY_BATCH_ROW = 'a[href^="/tracker/"]';

test.describe('EPIC-003 Preprocessing · Pipeline lifecycle (observation)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/tracker');
  });

  test('US-003.1 / REQ-003.2 tracker list surfaces a preprocessingStatus badge', async ({ page }) => {
    const firstRow = page.locator(ANY_BATCH_ROW).first();
    test.skip(await firstRow.count() === 0, 'No batches present yet — upload one first to observe preprocessing.');

    const badges = page.getByText(/PREPROCESSING|PREPROCESSED|PROCESSED|FAILED/i);
    expect(await badges.count()).toBeGreaterThan(0);
  });

  test('US-003.1 / REQ-003.3 at least one batch shows a terminal lifecycle status', async ({ page }) => {
    const firstRow = page.locator(ANY_BATCH_ROW).first();
    test.skip(await firstRow.count() === 0, 'No batches present yet.');

    const terminal = page.getByText(/DONE|PARTIAL|FAILED/i);
    expect(await terminal.count()).toBeGreaterThan(0);
  });

  test('US-003.1 / REQ-003.4 failed-batch detail exposes DLQ / error record counts', async ({ page }) => {
    const failedRow = page.locator('a[href^="/tracker/"]').filter({ has: page.getByText(/FAILED/i) }).first();
    test.skip(await failedRow.count() === 0, 'No FAILED batch to drill into — upload phase2-fail.csv to exercise this.');

    await failedRow.click();
    await page.waitForURL(/\/tracker\/[^/]+$/);

    await expect(
      page.getByText(/dead[-\s]?letter|DLQ|error record/i).first()
    ).toBeVisible();
  });
});
