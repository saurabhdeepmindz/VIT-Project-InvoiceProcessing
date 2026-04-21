/**
 * E2E Spec: EPIC-006 / User Story 006.1 — Operations Dashboard
 *
 * EPIC:          EPIC-006 — Operational Dashboard
 * User Story:    US-006.1  As an operations lead I want aggregated metrics,
 *                           a trend visualisation, and a top-errors list so
 *                           that I can gauge platform health at a glance.
 * Requirements:  REQ-006.1 /dashboard exposes total-batches / total-records
 *                          / avg-confidence tiles
 *                REQ-006.2 Trend chart or series renders for the selected window
 *                REQ-006.3 Top-errors panel lists the worst recent batches
 *                REQ-006.4 Date-range filter is present and defaults to last N days
 * Acceptance:    Dashboard renders its three pillars: metrics, trend, top errors.
 * RTM Trace:     backend/src/dashboard/controller/dashboard.controller.ts
 *                backend/src/dashboard/service/dashboard.service.ts
 *                frontend/src/app/dashboard/page.tsx
 *                frontend/src/services/dashboard.api.ts
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';
import { loginAs } from '../fixtures/auth';

test.describe('EPIC-006 Dashboard · Metrics + trend + top errors', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, OPERATOR);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /dashboard|metrics|overview/i })).toBeVisible();
  });

  test('US-006.1 / REQ-006.1 metric tiles are present', async ({ page }) => {
    for (const label of [/batches/i, /records/i, /confidence/i]) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('US-006.1 / REQ-006.3 top errors panel is reachable', async ({ page }) => {
    await expect(page.getByText(/top errors|errors|failures/i).first()).toBeVisible();
  });

  test('US-006.1 / REQ-006.4 date-range inputs are present', async ({ page }) => {
    const dateInputs = page.locator('input[type="date"]');
    expect(await dateInputs.count()).toBeGreaterThan(0);
  });
});
