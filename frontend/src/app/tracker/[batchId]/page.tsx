/**
 * /tracker/[batchId] — EPIC-005 detail view.
 */

'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTrackerDetail, type FileStatusDetail, type ApiError } from '@/services/tracker.api';

function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

function badge(status: string | null): string {
  switch (status) {
    case 'DONE': case 'PREPROCESSED': case 'EXTRACTED': return 'bg-success-100 text-success-500';
    case 'PREPROCESSING': case 'EDA_PROCESSING': case 'PARTIAL': case 'RUNNING': case 'PROCESSING': return 'bg-accent-100 text-accent-600';
    case 'UPLOADED': case 'PENDING': return 'bg-blue-100 text-blue-500';
    case 'FAILED': case 'DEAD_LETTERED': case 'ERROR': return 'bg-danger-100 text-danger-500';
    default: return 'bg-ink-100 text-ink-600';
  }
}

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default function TrackerDetailPage({ params }: PageProps) {
  // Next.js 16: route params are an async Promise in client pages — unwrap with React.use().
  const { batchId } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<FileStatusDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const d = await getTrackerDetail(batchId);
      setDetail(d);
    } catch (e) {
      const ae = e as ApiError;
      if (ae.statusCode === 401) { router.replace('/login'); return; }
      setErr(ae.message ?? 'Failed to load');
    } finally { setLoading(false); }
  }, [batchId, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('invoice.accessToken');
    if (!token) { router.replace('/login'); return; }
    void load();
  }, [load, router]);

  useEffect(() => {
    if (!detail) return;
    const inflight = ['UPLOADED', 'PREPROCESSING', 'PREPROCESSED', 'EDA_PROCESSING'];
    if (!inflight.includes(detail.summary.batchStatus)) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [detail, load]);

  const downloadCsv = (): void => {
    if (typeof window === 'undefined') return;
    const token = window.localStorage.getItem('invoice.accessToken');
    if (!token) { router.replace('/login'); return; }
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    fetch(`${base}/eda/batches/${batchId}/output.csv`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `invoice-batch-${batchId}.csv`; a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e: Error) => setErr(e.message));
  };

  const onLogout = (): void => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('invoice.accessToken');
      window.localStorage.removeItem('invoice.refreshToken');
    }
    router.replace('/login');
  };

  const [expanded, setExpanded] = (useState as typeof import('react').useState)<string | null>(null);
  const toggleExpand = (id: string): void => setExpanded(prev => (prev === id ? null : id));

  return (
    <main className="min-h-screen bg-ink-50">
      <header className="bg-navy-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="font-display font-semibold text-lg">Invoice Processing · Tracker</h1>
          <nav className="flex items-center gap-4 text-sm text-ink-400">
            <Link href="/upload" className="hover:text-white">Upload</Link>
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

      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Link href="/tracker" className="text-sm text-blue-500 hover:text-blue-300">← Back to list</Link>

        {err && <div className="rounded-md bg-danger-100 text-danger-500 px-3 py-2 text-sm">{err}</div>}
        {loading && !detail && <p className="text-sm text-ink-600">Loading…</p>}

        {detail && (
          <>
            <div className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display font-semibold text-lg">{detail.summary.fileName.split('/').pop()}</h2>
                  <p className="text-xs text-ink-600 font-mono break-all">{detail.summary.batchId}</p>
                </div>
                {detail.summary.outputCsvPath && (
                  <button className="btn-primary" onClick={downloadCsv}>Download CSV</button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-ink-600 text-xs mb-1">Batch status</div>
                  <span className={classNames('px-2 py-0.5 rounded text-xs', badge(detail.summary.batchStatus))}>
                    {detail.summary.batchStatus}
                  </span>
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">Preprocessing</div>
                  <span className={classNames('px-2 py-0.5 rounded text-xs', badge(detail.summary.preprocessingStatus))}>
                    {detail.summary.preprocessingStatus ?? '—'}
                  </span>
                  {detail.summary.preprocessingDurationSec != null && <span className="text-xs text-ink-600 ml-2">{detail.summary.preprocessingDurationSec}s</span>}
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">EDA</div>
                  <span className={classNames('px-2 py-0.5 rounded text-xs', badge(detail.summary.edaStatus))}>
                    {detail.summary.edaStatus ?? '—'}
                  </span>
                  {detail.summary.edaDurationSec != null && <span className="text-xs text-ink-600 ml-2">{detail.summary.edaDurationSec}s</span>}
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">Avg confidence</div>
                  <div>{detail.summary.avgConfidence != null ? `${detail.summary.avgConfidence.toFixed(1)}%` : '—'}</div>
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">Records</div>
                  <div>{detail.summary.processedRecords}/{detail.summary.batchSize} (errors: {detail.summary.errorRecords}, DLQ: {detail.summary.deadLetteredRecords})</div>
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">Turn-around</div>
                  <div>{detail.summary.turnaroundTimeSec != null ? `${detail.summary.turnaroundTimeSec}s` : '—'}</div>
                </div>
                <div>
                  <div className="text-ink-600 text-xs mb-1">Uploaded</div>
                  <div>{new Date(detail.summary.uploadedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="font-display font-semibold mb-3">Records ({detail.records.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-600 border-b border-ink-400/30">
                      <th className="py-2 pr-3 w-8"></th>
                      <th className="pr-3">#</th>
                      <th className="pr-3">Invoice #</th>
                      <th className="pr-3">Dealer</th>
                      <th className="pr-3">Customer</th>
                      <th className="pr-3">Amount (ex GST)</th>
                      <th className="pr-3">GST</th>
                      <th className="pr-3">Rego</th>
                      <th className="pr-3">EDA</th>
                      <th className="pr-3">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.records.map(r => {
                      const isOpen = expanded === r.recordId;
                      return (
                        <>
                          <tr
                            key={r.recordId}
                            className="border-b border-ink-400/10 cursor-pointer hover:bg-ink-100/40"
                            onClick={() => toggleExpand(r.recordId)}
                          >
                            <td className="py-2 pr-3 text-ink-600">{isOpen ? '▾' : '▸'}</td>
                            <td className="pr-3 text-ink-600">{r.csvRowNumber}</td>
                            <td className="pr-3 font-mono text-xs">{r.invoiceNumber ?? '—'}</td>
                            <td className="pr-3 truncate max-w-[160px]" title={r.dealerName ?? ''}>{r.dealerName ?? '—'}</td>
                            <td className="pr-3 truncate max-w-[140px]" title={r.customerName ?? ''}>{r.customerName ?? '—'}</td>
                            <td className="pr-3">{r.invoiceAmountExclGst ?? '—'}</td>
                            <td className="pr-3">{r.gstAmount ?? '—'}</td>
                            <td className="pr-3 font-mono text-xs">{r.vehicleRegistrationNumber ?? '—'}</td>
                            <td className="pr-3"><span className={classNames('text-xs px-2 py-0.5 rounded', badge(r.edaStatus))}>{r.edaStatus}</span></td>
                            <td className="pr-3">{r.confidenceScore != null ? `${r.confidenceScore.toFixed(1)}%` : '—'}</td>
                          </tr>
                          {isOpen && (
                            <tr key={`${r.recordId}-x`} className="border-b border-ink-400/10 bg-ink-100/30">
                              <td />
                              <td colSpan={9} className="py-3 pr-3">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  <div><span className="text-ink-600">Source URL:</span> <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-300 break-all">{r.sourceUrl}</a></div>
                                  <div><span className="text-ink-600">Invoice date:</span> {r.invoiceDate ?? '—'}</div>
                                  <div><span className="text-ink-600">Quantity:</span> {r.quantity ?? '—'}</div>
                                  <div><span className="text-ink-600">Tyre size:</span> {r.tyreSize ?? '—'}</div>
                                  <div><span className="text-ink-600">Tyre pattern:</span> {r.tyrePattern ?? '—'}</div>
                                  <div><span className="text-ink-600">Mobile:</span> {r.customerMobile ?? '—'}</div>
                                  <div><span className="text-ink-600">LLM provider:</span> {r.llmProviderUsed ?? '—'}</div>
                                  <div><span className="text-ink-600">Page count:</span> {r.pageCount ?? '—'}</div>
                                  <div><span className="text-ink-600">Preprocessing:</span> <span className={classNames('px-2 py-0.5 rounded', badge(r.preprocessingStatus))}>{r.preprocessingStatus}</span></div>
                                  <div><span className="text-ink-600">Extraction:</span> <span className={classNames('px-2 py-0.5 rounded', badge(r.extractionStatus))}>{r.extractionStatus ?? '—'}</span></div>
                                  {r.comments && <div className="col-span-2 md:col-span-4"><span className="text-ink-600">Comments:</span> {r.comments}</div>}
                                  {r.errorMessage && <div className="col-span-2 md:col-span-4 text-danger-500"><span className="text-ink-600">Error:</span> {r.errorMessage}</div>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {detail.dlq.length > 0 && (
              <div className="card p-6 border-l-4 border-danger-500">
                <h3 className="font-display font-semibold mb-3 text-danger-500">Dead-letter queue ({detail.dlq.length})</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-ink-600 border-b border-ink-400/30">
                      <th className="py-2 pr-3">Stage</th>
                      <th className="pr-3">Code</th>
                      <th className="pr-3">Message</th>
                      <th className="pr-3">Attempts</th>
                      <th className="pr-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.dlq.map(d => (
                      <tr key={d.id} className="border-b border-ink-400/10">
                        <td className="py-2 pr-3">{d.failureStage}</td>
                        <td className="pr-3 text-xs">{d.errorCode ?? '—'}</td>
                        <td className="pr-3 text-xs text-ink-600 max-w-[380px] truncate" title={d.errorMessage ?? ''}>{d.errorMessage}</td>
                        <td className="pr-3">{d.attempts}</td>
                        <td className="pr-3 text-ink-600">{new Date(d.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card p-6">
              <h3 className="font-display font-semibold mb-3">Audit log (last {detail.auditTail.length})</h3>
              {detail.auditTail.length === 0 ? (
                <p className="text-sm text-ink-600">No audit entries yet.</p>
              ) : (
                <ul className="space-y-1 text-sm font-mono">
                  {detail.auditTail.map((a, i) => (
                    <li key={i} className="text-ink-600">
                      <span className="text-ink-900">{new Date(a.createdAt).toLocaleTimeString()}</span>
                      {' · '}<span className="text-accent-600">{a.action}</span>
                      {' · '}<span>{a.actor}</span>
                      {a.recordId && <> · <span className="text-ink-400">{a.recordId.slice(0, 8)}</span></>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
