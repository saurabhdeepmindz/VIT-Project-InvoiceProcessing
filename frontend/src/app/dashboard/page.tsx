/**
 * /dashboard — EPIC-006 operations dashboard.
 * Metric cards + trend chart + top-errors list, with date range filter.
 */

'use client';

import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getMetrics, getTrend, getTopErrors,
  type DashboardMetrics, type TrendSeries, type TopErrorBatch, type ApiError,
} from '@/services/dashboard.api';
import TrendChart from '@/components/ui/TrendChart';

function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(s: string): string {
  return new Date(`${s}T00:00:00Z`).toISOString();
}

function endOfDay(s: string): string {
  return new Date(`${s}T23:59:59.999Z`).toISOString();
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'blue' | 'success' | 'danger' | 'accent' | 'default';
}

function MetricCard({ label, value, sub, tone = 'default' }: MetricCardProps) {
  const toneClass =
    tone === 'success' ? 'text-success-500' :
    tone === 'danger'  ? 'text-danger-500'  :
    tone === 'accent'  ? 'text-accent-600'  :
    tone === 'blue'    ? 'text-blue-500'    : 'text-navy-900';
  return (
    <div className="card p-5">
      <div className="text-xs text-ink-600 mb-1">{label}</div>
      <div className={classNames('font-display text-2xl font-semibold', toneClass)}>{value}</div>
      {sub && <div className="text-xs text-ink-600 mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const today = toDateInput(new Date());
  const monthAgo = toDateInput(new Date(Date.now() - 30 * 86_400_000));

  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [interval, setInterval] = useState<'day' | 'week'>('day');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trend, setTrend] = useState<TrendSeries | null>(null);
  const [topErrors, setTopErrors] = useState<TopErrorBatch[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const params = { from: startOfDay(from), to: endOfDay(to) };
    try {
      const [m, t, tops] = await Promise.all([
        getMetrics(params),
        getTrend({ ...params, interval }),
        getTopErrors({ ...params, limit: 5 }),
      ]);
      setMetrics(m); setTrend(t); setTopErrors(tops);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.statusCode === 401) { router.replace('/login'); return; }
      setErr(ae.message ?? 'Failed to load dashboard');
    } finally { setLoading(false); }
  }, [from, to, interval, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('invoice.accessToken');
    if (!token) { router.replace('/login'); return; }
    void load();
  }, [load, router]);

  const onLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('invoice.accessToken');
      window.localStorage.removeItem('invoice.refreshToken');
    }
    router.replace('/login');
  };

  const fmt = (n: number | null | undefined, unit = ''): string =>
    n == null ? '—' : `${n}${unit}`;

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-display font-semibold text-lg">Invoice Processing · Dashboard</h1>
          <nav className="flex items-center gap-4 text-sm text-ink-400">
            <Link href="/upload" className="hover:text-white">Upload</Link>
            <Link href="/tracker" className="hover:text-white">Tracker</Link>
            <span className="text-white">Dashboard</span>
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
        <div className="card p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="from" className="text-xs text-ink-600 block mb-1">From</label>
              <input id="from" type="date" className="input w-40" value={from} onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="to" className="text-xs text-ink-600 block mb-1">To</label>
              <input id="to" type="date" className="input w-40" value={to} onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)} />
            </div>
            <div>
              <label htmlFor="interval" className="text-xs text-ink-600 block mb-1">Interval</label>
              <select id="interval" className="input w-28" value={interval} onChange={(e: ChangeEvent<HTMLSelectElement>) => setInterval(e.target.value as 'day' | 'week')}>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
              </select>
            </div>
            <button className="btn-primary" onClick={load} disabled={loading}>
              {loading ? 'Loading…' : 'Apply'}
            </button>
          </div>
        </div>

        {err && <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm">{err}</div>}

        {metrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Batches in range"     value={metrics.totalBatches} sub={`${metrics.totalRecords} records`} />
              <MetricCard label="Successfully processed" value={metrics.doneBatches} tone="success" sub={`${metrics.partialBatches} partial`} />
              <MetricCard label="Failed batches"       value={metrics.failedBatches} tone="danger" sub={`${metrics.totalErrorRecords} record errors`} />
              <MetricCard label="Dead-lettered records" value={metrics.totalDlqRecords} tone="danger" />
              <MetricCard label="Avg preprocessing"    value={fmt(metrics.avgPreprocessingSec, 's')} tone="blue" />
              <MetricCard label="Avg EDA"              value={fmt(metrics.avgEdaSec, 's')} tone="accent" />
              <MetricCard label="Avg turnaround"       value={fmt(metrics.avgTurnaroundSec, 's')} />
              <MetricCard label="Avg confidence"       value={metrics.avgConfidence != null ? `${metrics.avgConfidence}%` : '—'} tone="success" />
            </div>

            <div className="card p-6">
              <h3 className="font-display font-semibold mb-4">Trend</h3>
              {trend ? <TrendChart points={trend.points} /> : <p className="text-sm text-ink-600">Loading…</p>}
            </div>

            <div className="card p-6">
              <h3 className="font-display font-semibold mb-4">Top batches by errors</h3>
              {topErrors.length === 0 ? (
                <p className="text-sm text-ink-600">No errors in range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-600 border-b border-ink-400/30">
                      <th className="py-2 pr-3">File</th>
                      <th className="pr-3">Status</th>
                      <th className="pr-3">Record errors</th>
                      <th className="pr-3">DLQ</th>
                      <th className="pr-3">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topErrors.map(t => (
                      <tr key={t.batchId} className="border-b border-ink-400/10">
                        <td className="py-2 pr-3">
                          <Link href={`/tracker/${t.batchId}`} className="text-blue-500 hover:text-blue-300">
                            {t.fileName.split('/').pop() ?? t.fileName}
                          </Link>
                        </td>
                        <td className="pr-3">{t.batchStatus}</td>
                        <td className="pr-3 text-danger-500">{t.errorRecords}</td>
                        <td className="pr-3 text-danger-500">{t.dlqCount}</td>
                        <td className="pr-3 text-ink-600">{new Date(t.uploadedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
