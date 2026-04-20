/**
 * /tracker — EPIC-005 paginated file-status board.
 */

'use client';

import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  listTracker, type FileStatusRow, type ApiError,
} from '@/services/tracker.api';

function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

const STATUS_OPTIONS = [
  '', 'UPLOADED', 'PREPROCESSING', 'PREPROCESSED',
  'EDA_PROCESSING', 'DONE', 'PARTIAL', 'FAILED',
];

function statusBadge(status: string | null): string {
  switch (status) {
    case 'DONE': case 'PREPROCESSED': return 'bg-success-100 text-success-500';
    case 'PREPROCESSING': case 'EDA_PROCESSING': case 'PARTIAL': return 'bg-accent-100 text-accent-600';
    case 'UPLOADED': return 'bg-blue-100 text-blue-500';
    case 'FAILED': return 'bg-danger-100 text-danger-500';
    default: return 'bg-ink-100 text-ink-600';
  }
}

export default function TrackerListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FileStatusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await listTracker({ page, limit, status: status || undefined });
      setRows(res.data); setTotal(res.total);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.statusCode === 401) { router.replace('/login'); return; }
      setErr(ae.message ?? 'Failed to load');
    } finally { setLoading(false); }
  }, [page, limit, status, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('invoice.accessToken');
    if (!token) { router.replace('/login'); return; }
    void load();
  }, [load, router]);

  // Auto-poll when any in-flight rows exist
  useEffect(() => {
    const inflight = new Set(['UPLOADED', 'PREPROCESSING', 'PREPROCESSED', 'EDA_PROCESSING']);
    if (!rows.some(r => inflight.has(r.batchStatus))) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [rows, load]);

  const onLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('invoice.accessToken');
      window.localStorage.removeItem('invoice.refreshToken');
    }
    router.replace('/login');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-display font-semibold text-lg">Invoice Processing · Tracker</h1>
          <nav className="flex items-center gap-4 text-sm text-ink-400">
            <Link href="/upload" className="hover:text-white">Upload</Link>
            <span className="text-white">Tracker</span>
            <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link href="/reports" className="hover:text-white">Reports</Link>
          </nav>
        </div>
        <button
          onClick={onLogout}
          className="text-sm font-medium px-3 py-1.5 rounded-md border border-white/30 text-white hover:bg-white/10 transition"
        >
          Sign out
        </button>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">File processing status</h2>
            <div className="flex items-center gap-3 text-sm">
              <label htmlFor="status-filter" className="text-ink-600">Status</label>
              <select
                id="status-filter"
                className="input w-40 py-1"
                value={status}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => { setPage(1); setStatus(e.target.value); }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
              </select>
              <button className="text-sm text-blue-500 hover:text-blue-300" onClick={load} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {err && <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm mb-4">{err}</div>}

          {rows.length === 0 ? (
            <p className="text-sm text-ink-600">No batches found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-600 border-b border-ink-400/30">
                    <th className="py-2 pr-3">File</th>
                    <th className="pr-3">Batch</th>
                    <th className="pr-3">Records</th>
                    <th className="pr-3">Preprocessing</th>
                    <th className="pr-3">EDA</th>
                    <th className="pr-3">Conf.</th>
                    <th className="pr-3">Turn-around</th>
                    <th className="pr-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.batchId} className="border-b border-ink-400/10 hover:bg-ink-100/40">
                      <td className="py-2 pr-3">
                        <Link href={`/tracker/${r.batchId}`} className="text-blue-500 hover:text-blue-300 truncate max-w-[260px] inline-block align-middle">
                          {r.fileName.split('/').pop() ?? r.fileName}
                        </Link>
                      </td>
                      <td className="pr-3">
                        <span className={classNames('text-xs px-2 py-0.5 rounded', statusBadge(r.batchStatus))}>
                          {r.batchStatus}
                        </span>
                      </td>
                      <td className="pr-3">{r.processedRecords}/{r.batchSize} ({r.errorRecords} err)</td>
                      <td className="pr-3 text-xs">
                        <span className={classNames('px-2 py-0.5 rounded', statusBadge(r.preprocessingStatus))}>
                          {r.preprocessingStatus ?? '—'}
                        </span>
                        {r.preprocessingDurationSec != null && (
                          <span className="text-ink-600 ml-1">{r.preprocessingDurationSec}s</span>
                        )}
                      </td>
                      <td className="pr-3 text-xs">
                        <span className={classNames('px-2 py-0.5 rounded', statusBadge(r.edaStatus))}>
                          {r.edaStatus ?? '—'}
                        </span>
                        {r.edaDurationSec != null && (
                          <span className="text-ink-600 ml-1">{r.edaDurationSec}s</span>
                        )}
                      </td>
                      <td className="pr-3">{r.avgConfidence != null ? `${r.avgConfidence.toFixed(1)}%` : '—'}</td>
                      <td className="pr-3">{r.turnaroundTimeSec != null ? `${r.turnaroundTimeSec}s` : '—'}</td>
                      <td className="pr-3 text-ink-600">{new Date(r.uploadedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-ink-600">Page {page} of {totalPages} ({total} batches)</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border border-ink-400/40 disabled:opacity-40" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
                <button className="px-3 py-1 rounded border border-ink-400/40 disabled:opacity-40" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
