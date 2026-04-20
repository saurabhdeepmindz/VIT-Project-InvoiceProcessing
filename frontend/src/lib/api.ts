/**
 * api.ts — thin fetch wrapper used by service modules.
 *
 * Automatically injects Authorization: Bearer <token> when the access token
 * is present in localStorage. Normalises error envelopes from the backend.
 */

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  requestId?: string;
}

const ACCESS_TOKEN_KEY = 'invoice.accessToken';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    let err: ApiError = { statusCode: res.status, message: res.statusText, error: 'HTTP_ERROR' };
    try { err = { ...err, ...(await res.json()) }; } catch { /* ignore */ }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
