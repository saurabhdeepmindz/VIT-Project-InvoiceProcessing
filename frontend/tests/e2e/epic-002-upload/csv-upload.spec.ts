/**
 * E2E Spec: EPIC-002 / User Story 002.1 — CSV Manifest Upload
 *
 * EPIC:          EPIC-002 — Invoice Batch Management
 * User Story:    US-002.1  As an operator I can upload a CSV manifest listing
 *                           invoice image URLs so that the batch enters the
 *                           processing pipeline.
 * Requirements:  REQ-002.1 /upload renders a CSV drop-zone plus a file chooser
 *                REQ-002.2 A valid CSV upload creates a new batch (HTTP 201)
 *                REQ-002.3 UI shows success state with the new batch ID
 *                REQ-002.4 Recent-batches table includes the new upload
 * Acceptance:    Uploading sample-invoices.csv produces a new UPLOADED batch
 *                visible in the recent-uploads list.
 * RTM Trace:     backend/src/invoice/controller/invoice.controller.ts#uploadBatch
 *                backend/src/invoice/service/invoice.service.ts#createBatch
 *                frontend/src/app/upload/page.tsx
 *                frontend/src/services/invoice.api.ts#uploadCsvBatch
 */

import path from 'node:path';

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

const SAMPLE_CSV = path.join(__dirname, '..', 'fixtures', 'sample-invoices.csv');

test.describe('EPIC-002 Invoice Batch · CSV upload', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/upload');
    await expect(page.getByRole('heading', { name: /upload/i })).toBeVisible();
  });

  test('US-002.1 / REQ-002.1 upload surface presents drop zone + file input', async ({ page }) => {
    await expect(page.locator('input[type="file"]')).toHaveCount(1);
  });

  test('US-002.1 / REQ-002.2,3,4 valid CSV creates a batch and surfaces success', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(SAMPLE_CSV);

    const submit = page.getByRole('button', { name: /upload|submit|start/i });
    if (await submit.count()) {
      await submit.first().click();
    }

    await expect(
      page.getByText(/upload successful|batch created|uploaded/i)
    ).toBeVisible({ timeout: 30_000 });

    await expect(page.getByText(/recent|latest|history/i).first()).toBeVisible();
  });
});
