/**
 * auth.api.ts — Auth endpoints client.
 * Maps to EPIC-001 backend AuthController.
 */

import { apiFetch, setAccessToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  accessExpiresIn: string;
}

const REFRESH_KEY = 'invoice.refreshToken';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAccessToken(res.accessToken);
  if (typeof window !== 'undefined') window.localStorage.setItem(REFRESH_KEY, res.refreshToken);
  return res;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } finally {
    setAccessToken(null);
    if (typeof window !== 'undefined') window.localStorage.removeItem(REFRESH_KEY);
  }
}

export async function me(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

export interface MessageResponse { message: string }

export function forgotPassword(email: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>('/auth/forgot', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<MessageResponse> {
  return apiFetch<MessageResponse>('/auth/reset', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

const REMEMBERED_EMAIL_KEY = 'invoice.rememberedEmail';

export function getRememberedEmail(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '';
}

export function setRememberedEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  if (email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}
