/**
 * /forgot-password — EPIC-001 password reset request.
 * Always shows the same "we sent a link" confirmation to avoid email enumeration.
 * In dev, the actual reset link is logged to the backend console.
 */

'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/services/auth.api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (ev: FormEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      setMessage(res.message);
      setSubmitted(true);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-navy-900 px-4">
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-accent-500 flex items-center justify-center text-white font-display font-bold" aria-hidden>IP</div>
          <div>
            <h1 className="text-lg font-display font-bold text-navy-900">Invoice Processing</h1>
            <p className="text-xs text-ink-600">Reset your password</p>
          </div>
        </div>

        {!submitted ? (
          <>
            <h2 className="text-base font-display font-semibold text-ink-900 mb-1">Forgot password</h2>
            <p className="text-ink-600 mb-6 text-sm">
              Enter your email and we&apos;ll send a reset link. <span className="text-ink-400">(Demo: check the backend log.)</span>
            </p>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink-900 mb-1">Email</label>
                <input
                  id="email" type="email" required autoFocus
                  className="input disabled:opacity-60"
                  value={email} onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm" role="alert">
                  ⚠ {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full justify-center disabled:opacity-60" disabled={loading || !email}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-base font-display font-semibold text-success-500 mb-2">✓ Request received</h2>
            <p className="text-ink-600 text-sm mb-4">{message}</p>
            <div className="rounded-md bg-blue-100 text-blue-500 px-3 py-2 text-xs mb-4">
              <strong>Demo mode:</strong> no email is actually sent. The reset URL was logged to the
              backend console. Copy the <code>?token=…</code> query string into{' '}
              <code>/reset-password</code> to complete the flow.
            </div>
          </>
        )}

        <p className="mt-6 text-xs text-ink-600">
          <Link href="/login" className="text-blue-500 hover:text-blue-300">← Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
