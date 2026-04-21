/**
 * Login page — EPIC-001 with Small-category polish.
 * Adds: branded header, password-visibility toggle, Remember-me,
 *       Forgot-password link, better error state, disabled fields
 *       during submit.
 */

'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  login, getRememberedEmail, setRememberedEmail,
} from '@/services/auth.api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  useEffect(() => {
    const remembered = getRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRemember(true);
    } else {
      setEmail('operator@invoice-platform.local');
    }
  }, []);

  const onSubmit = async (ev: FormEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setRememberedEmail(remember ? email : null);
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
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-md bg-accent-500 flex items-center justify-center text-white font-display font-bold"
            aria-hidden
          >
            IP
          </div>
          <div>
            <h1 className="text-lg font-display font-bold text-navy-900">Invoice Processing</h1>
            <p className="text-xs text-ink-600">Bridgestone Platform · v3.1</p>
          </div>
        </div>

        <h2 className="text-base font-display font-semibold text-ink-900 mb-1">Sign in</h2>
        <p className="text-ink-600 mb-6 text-sm">Use your operator or admin credentials.</p>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink-900 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              disabled={isSubmitting}
              className="input disabled:opacity-60"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              aria-invalid={error ? 'true' : undefined}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink-900 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                required
                disabled={isSubmitting}
                className="input pr-20 disabled:opacity-60"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={error ? 'true' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-600 hover:text-ink-900 px-2 py-1 rounded"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-ink-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-ink-400/60"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={isSubmitting}
              />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-blue-500 hover:text-blue-300 font-medium"
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <div
              className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm flex items-start gap-2"
              role="alert"
            >
              <span aria-hidden>⚠</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full justify-center disabled:opacity-60"
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-xs text-ink-600">
          Demo credentials are seeded on first backend boot — see{' '}
          <code className="text-[11px]">.env.sample</code>.
        </p>
      </div>
    </main>
  );
}
