/**
 * E2E Spec: EPIC-001 / User Story 001.3 — Route Guard & Role-Based Access
 *
 * EPIC:          EPIC-001 — Authentication & User Management
 * User Story:    US-001.3  As a security stakeholder I require protected routes
 *                           to reject unauthenticated requests so that only
 *                           signed-in users can access workspace data.
 * Requirements:  REQ-001.9  Unauthenticated navigation to a protected route
 *                           redirects to /login
 *                REQ-001.10 Signing out clears session state and returns to /login
 *                REQ-001.11 Successful login on an admin account reaches the
 *                           admin-accessible workspace (dashboard/tracker)
 * Acceptance:    Protected surfaces require a valid session; sign-out revokes it.
 * RTM Trace:     backend/src/auth/guards/jwt-auth.guard.ts
 *                backend/src/common/guards/RolesGuard-and-Exceptions.ts
 *                frontend route-level guards (app/*)
 */

import { test, expect } from '@playwright/test';

import { ADMIN } from '../fixtures/accounts';
import { loginAs, logout } from '../fixtures/auth';

test.describe('EPIC-001 Authentication · RBAC & route guards', () => {
  test('US-001.3 / REQ-001.9 unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('US-001.3 / REQ-001.11 admin reaches a workspace route after sign-in', async ({ page }) => {
    await loginAs(page, ADMIN);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('US-001.3 / REQ-001.10 sign-out clears session and returns to /login', async ({ page }) => {
    await loginAs(page, ADMIN);
    await logout(page);
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });
});
