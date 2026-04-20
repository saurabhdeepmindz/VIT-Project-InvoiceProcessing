/**
 * /upload — EPIC-002 CSV manifest upload (v3.1).
 * CSV-only. Native drag-and-drop. Shows progress, success, errors.
 */

'use client';

import {
  useEffect, useState, useCallback, DragEvent, ChangeEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  uploadCsvBatch, listBatches,
  type BatchResponse, type BatchListItem, type ApiErrorShape,
} from '@/services/invoice.api';

const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB ?? 50);

type UiState = 'idle' | 'uploading' | 'success' | 'error';

function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile]         = useState<File | null>(null);
  const [state, setState]       = useState<UiState>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult]     = useState<BatchResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [recent, setRecent] = useState<BatchListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const loadRecent = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await listBatches(1, 10);
      setRecent(res.data);
    } catch (err) {
      const e = err as ApiErrorShape;
      if (e.statusCode === 401) router.replace('/login');
    } finally {
      setLoadingList(false);
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('invoice.accessToken');
    if (!token) { router.replace('/login'); return; }
    void loadRecent();
  }, [loadRecent, router]);

  // Auto-poll while any batch is still in a non-terminal state.
  useEffect(() => {
    const inFlight = new Set(['UPLOADED', 'PREPROCESSING', 'PREPROCESSED', 'EDA_PROCESSING']);
    const hasInFlight = recent.some(b => inFlight.has(b.status));
    if (!hasInFlight) return;
    const t = setInterval(() => { void loadRecent(); }, 3000);
    return () => clearInterval(t);
  }, [recent, loadRecent]);

  const onDownloadCsv = (batchId: string): void => {
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('invoice.accessToken') : null;
    if (!token) { router.replace('/login'); return; }
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    fetch(`${base}/eda/batches/${batchId}/output.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-batch-${batchId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err: Error) => setError(err.message));
  };

  const validateAndSet = (f: File | null) => {
    setError(null); setResult(null); setProgress(0); setState('idle');
    if (!f) { setFile(null); return; }
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      setError(`Only .csv files are accepted (got ${f.type || 'unknown type'})`);
      setFile(null); return;
    }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_UPLOAD_MB} MB cap`);
      setFile(null); return;
    }
    setFile(f);
  };

  const onDrop = (ev: DragEvent<HTMLDivElement>) => {
    ev.preventDefault(); setDragOver(false);
    validateAndSet(ev.dataTransfer.files?.[0] ?? null);
  };

  const onPick = (ev: ChangeEvent<HTMLInputElement>) => {
    validateAndSet(ev.target.files?.[0] ?? null);
  };

  const onUpload = async () => {
    if (!file) return;
    setState('uploading'); setError(null); setProgress(0);
    try {
      const res = await uploadCsvBatch(file, setProgress);
      setResult(res); setState('success'); setFile(null);
      void loadRecent();
    } catch (err) {
      const e = err as ApiErrorShape;
      setState('error');
      setError(e.message ?? 'Upload failed');
      if (e.statusCode === 401) router.replace('/login');
    }
  };

  const onLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('invoice.accessToken');
      window.localStorage.removeItem('invoice.refreshToken');
    }
    router.replace('/login');
  };

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-display font-semibold text-lg">Invoice Processing · Upload</h1>
          <nav className="flex items-center gap-4 text-sm text-ink-400">
            <span className="text-white">Upload</span>
            <Link href="/tracker" className="hover:text-white">Tracker</Link>
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

      <section className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-2">Upload CSV manifest</h2>
          <p className="text-sm text-ink-600 mb-6">
            CSV must have an <code>Invoice Links</code> column with one invoice URL per row.
            Max {MAX_UPLOAD_MB} MB.
          </p>

          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={classNames(
              'border-2 border-dashed rounded-lg px-6 py-10 text-center transition',
              dragOver ? 'border-accent-500 bg-accent-100' : 'border-ink-400/40 bg-ink-100',
            )}
          >
            <p className="text-ink-900 font-medium mb-1">
              {file ? file.name : 'Drag your CSV here'}
            </p>
            <p className="text-sm text-ink-600 mb-4">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or'}
            </p>
            <label className="btn-primary cursor-pointer inline-block">
              Choose file
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
            </label>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {state === 'uploading' && (
            <div className="mt-4">
              <div className="w-full bg-ink-100 rounded-full h-2 overflow-hidden">
                <div className="bg-accent-500 h-2 transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-ink-600 mt-2">Uploading… {progress}%</p>
            </div>
          )}

          {result && state === 'success' && (
            <div className="mt-4 rounded-md bg-success-100 text-success-500 px-3 py-3 text-sm">
              <p className="font-semibold">Batch created</p>
              <p>ID: <code>{result.batchId}</code></p>
              <p>{result.totalRecords} records · status {result.status}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              className="btn-primary disabled:opacity-50"
              disabled={!file || state === 'uploading'}
              onClick={onUpload}
            >
              {state === 'uploading' ? 'Uploading…' : 'Upload batch'}
            </button>
            {file && state !== 'uploading' && (
              <button className="text-ink-600 hover:text-ink-900 text-sm" onClick={() => validateAndSet(null)}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold">Recent batches</h2>
            <button className="text-sm text-blue-500 hover:text-blue-300" onClick={loadRecent} disabled={loadingList}>
              {loadingList ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-600">No batches yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-600 border-b border-ink-400/30">
                  <th className="py-2">Batch ID</th>
                  <th>Records</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.batchId} className="border-b border-ink-400/10">
                    <td className="py-2 font-mono text-xs">{b.batchId.slice(0, 8)}…</td>
                    <td>{b.batchSize}</td>
                    <td>
                      <span className={classNames(
                        'text-xs px-2 py-0.5 rounded',
                        b.status === 'UPLOADED'        && 'bg-blue-100 text-blue-500',
                        b.status === 'PREPROCESSING'   && 'bg-accent-100 text-accent-600',
                        b.status === 'PREPROCESSED'    && 'bg-blue-100 text-blue-500',
                        b.status === 'EDA_PROCESSING'  && 'bg-accent-100 text-accent-600',
                        b.status === 'DONE'            && 'bg-success-100 text-success-500',
                        b.status === 'FAILED'          && 'bg-danger-100 text-danger-500',
                        b.status === 'PARTIAL'         && 'bg-accent-100 text-accent-600',
                      )}>
                        {b.status}
                      </span>
                    </td>
                    <td className="text-ink-600">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="text-right">
                      {(b.status === 'DONE' || b.status === 'PARTIAL') && (
                        <button
                          onClick={() => onDownloadCsv(b.batchId)}
                          className="text-xs text-blue-500 hover:text-blue-300 underline"
                        >
                          Download CSV
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}
