/**
 * Login page — Phase 0 minimal EPIC-001 form.
 * Calls /auth/login, stores access + refresh tokens, redirects to /dashboard.
 */

'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/services/auth.api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('operator@invoice-platform.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const onSubmit = async (ev: FormEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/upload');
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Login failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-navy-900 mb-1">Invoice Processing</h1>
        <p className="text-ink-600 mb-6 text-sm">Sign in to continue</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-900 mb-1">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-900 mb-1">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm" role="alert">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-xs text-ink-600">
          Demo credentials are seeded on first backend boot (see <code>.env.sample</code>).
        </p>
      </div>
    </main>
  );
}
