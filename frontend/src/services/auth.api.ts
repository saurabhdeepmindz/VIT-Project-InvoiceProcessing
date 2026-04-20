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
