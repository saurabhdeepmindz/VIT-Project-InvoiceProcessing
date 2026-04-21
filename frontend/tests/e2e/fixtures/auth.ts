/**
 * auth.ts — Shared login helper for E2E specs.
 *
 * Drives the real /login page rather than hitting the API directly so the UI
 * flow itself remains under test. Returns once the landing route after login
 * has settled.
 */

import { expect, Page } from '@playwright/test';

import type { Account } from './accounts';

const LANDING_ROUTE_RE = /\/(upload|tracker|dashboard|reports)(\?|$|\/)/;

export async function loginAs(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(account.email);
  await page.getByLabel(/^password$/i).fill(account.password);
  await page.getByRole('button', { name: /sign in|log\s*in/i }).click();
  await page.waitForURL(LANDING_ROUTE_RE, { timeout: 20_000 });
  await expect(page).toHaveURL(LANDING_ROUTE_RE);
}

export async function logout(page: Page): Promise<void> {
  const trigger = page.getByRole('button', { name: /sign out|log\s*out/i });
  if (await trigger.count()) {
    await trigger.first().click();
    await page.waitForURL(/\/login(\?|$)/, { timeout: 10_000 });
  }
}
