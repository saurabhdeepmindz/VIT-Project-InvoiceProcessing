/**
 * /reset-password?token=... — consume a reset token, set a new password.
 */

'use client';

import { useEffect, useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resetPassword } from '@/services/auth.api';

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) setError('Missing reset token in URL. Use the link from your reset email.');
  }, [token]);

  const onSubmit = async (ev: FormEvent<HTMLFormElement>): Promise<void> => {
    ev.preventDefault();
    setError(null);
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8)   { setError('Password must be at least 8 characters.'); return; }
    if (!/\d/.test(newPassword))  { setError('Password must contain at least one digit.'); return; }
    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Reset failed');
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
            <p className="text-xs text-ink-600">Set a new password</p>
          </div>
        </div>

        {done ? (
          <>
            <h2 className="text-base font-display font-semibold text-success-500 mb-2">✓ Password updated</h2>
            <p className="text-ink-600 text-sm">Redirecting you to sign in…</p>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="np" className="block text-sm font-medium text-ink-900 mb-1">New password</label>
              <div className="relative">
                <input
                  id="np"
                  type={showPwd ? 'text' : 'password'}
                  required minLength={8}
                  className="input pr-20 disabled:opacity-60"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-600 hover:text-ink-900 px-2 py-1"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-xs text-ink-600 mt-1">Min 8 characters; must include at least one digit.</p>
            </div>

            <div>
              <label htmlFor="cp" className="block text-sm font-medium text-ink-900 mb-1">Confirm password</label>
              <input
                id="cp" type={showPwd ? 'text' : 'password'}
                required minLength={8}
                className="input disabled:opacity-60"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm" role="alert">⚠ {error}</div>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center disabled:opacity-60"
              disabled={loading || !token || !newPassword || !confirm}
            >
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-ink-600">
          <Link href="/login" className="text-blue-500 hover:text-blue-300">← Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="p-8 text-ink-600">Loading…</p>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
