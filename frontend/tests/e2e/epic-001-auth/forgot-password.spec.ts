/**
 * E2E Spec: EPIC-001 / User Story 001.2 — Password Reset Request
 *
 * EPIC:          EPIC-001 — Authentication & User Management
 * User Story:    US-001.2  As an operator who forgot my password, I can
 *                           request a reset link so I can regain account access.
 * Requirements:  REQ-001.5  /forgot-password page accepts an email address
 *                REQ-001.6  Response is enumeration-safe: same confirmation
 *                           regardless of whether the account exists
 *                REQ-001.7  Reset link is logged server-side in demo mode
 *                REQ-001.8  A back-to-login link returns the user to /login
 * Acceptance:    Submitting the form surfaces a success confirmation without
 *                revealing account existence.
 * RTM Trace:     backend/src/auth/auth.controller.ts#requestReset
 *                backend/src/auth/auth.service.ts#requestPasswordReset
 *                frontend/src/app/forgot-password/page.tsx
 *                frontend/src/services/auth.api.ts#forgotPassword
 */

import { test, expect } from '@playwright/test';

test.describe('EPIC-001 Authentication · Forgot password', () => {
  test('US-001.2 / REQ-001.5,6 shows generic confirmation after submission', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();

    await page.getByLabel(/email/i).fill('anybody@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/request received|reset link/i)).toBeVisible({ timeout: 15_000 });
  });

  test('US-001.2 / REQ-001.6 unknown email surfaces the same confirmation (enumeration-safe)', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel(/email/i).fill('does-not-exist@nowhere.invalid');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByText(/request received|reset link/i)).toBeVisible({ timeout: 15_000 });
  });

  test('US-001.2 / REQ-001.8 back-to-login link returns to /login', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: /back to sign in/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
