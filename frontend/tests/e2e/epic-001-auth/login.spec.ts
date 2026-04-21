/**
 * E2E Spec: EPIC-001 / User Story 001.1 — Operator Login
 *
 * EPIC:          EPIC-001 — Authentication & User Management
 * User Story:    US-001.1  As an operator I can sign in with valid credentials
 *                           so that I can access the invoice processing workspace.
 * Requirements:  REQ-001.1  Valid email/password returns access+refresh tokens
 *                REQ-001.2  Invalid credentials surface a generic error
 *                REQ-001.3  Successful login lands on an authorised workspace route
 *                REQ-001.4  "Remember me" persists the email between sessions
 * Acceptance:    Login form validates, authenticates, and routes the user to
 *                the workspace (upload/tracker/dashboard/reports).
 * RTM Trace:     backend/src/auth/auth.controller.ts#login
 *                frontend/src/app/login/page.tsx
 *                frontend/src/services/auth.api.ts#login
 */

import { test, expect } from '@playwright/test';

import { OPERATOR } from '../fixtures/accounts';

test.describe('EPIC-001 Authentication · Login', () => {
  test('US-001.1 / REQ-001.1 operator logs in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    await page.getByLabel(/email/i).fill(OPERATOR.email);
    await page.getByLabel(/^password$/i).fill(OPERATOR.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(/\/(upload|tracker|dashboard|reports)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('US-001.1 / REQ-001.2 invalid credentials surface a generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(OPERATOR.email);
    await page.getByLabel(/^password$/i).fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('US-001.1 / REQ-001.4 remember-me persists email across reloads', async ({ page, context }) => {
    await page.goto('/login');
    const rememberCheckbox = page.getByLabel(/remember/i);
    if (await rememberCheckbox.count()) {
      await rememberCheckbox.check();
    }
    await page.getByLabel(/email/i).fill(OPERATOR.email);
    await page.getByLabel(/^password$/i).fill(OPERATOR.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(upload|tracker|dashboard|reports)/);

    const fresh = await context.newPage();
    await fresh.goto('/login');
    await expect(fresh.getByLabel(/email/i)).toHaveValue(OPERATOR.email);
    await fresh.close();
  });
});
