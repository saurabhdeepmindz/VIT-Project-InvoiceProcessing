/**
 * accounts.ts — Seeded demo credentials used by every E2E spec.
 *
 * Values mirror db/seeds/001_seed_admin.sql. Override per environment via
 * E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD / E2E_OPERATOR_EMAIL / E2E_OPERATOR_PASSWORD.
 */

export interface Account {
  readonly role: 'admin' | 'operator';
  readonly email: string;
  readonly password: string;
}

export const ADMIN: Account = {
  role: 'admin',
  email: process.env.E2E_ADMIN_EMAIL ?? 'admin@invoice-platform.local',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe!Admin#2026',
};

export const OPERATOR: Account = {
  role: 'operator',
  email: process.env.E2E_OPERATOR_EMAIL ?? 'operator@invoice-platform.local',
  password: process.env.E2E_OPERATOR_PASSWORD ?? 'ChangeMe!Op#2026',
};
