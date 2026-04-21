/**
 * dashboard.api.ts — EPIC-006 client.
 */

import { apiFetch, type ApiError } from '@/lib/api';

export type { ApiError };

export interface StatusBreakdown { status: string; count: number }

export interface DashboardMetrics {
  from: string;
  to: string;
  totalBatches: number;
  totalRecords: number;
  doneBatches: number;
  failedBatches: number;
  partialBatches: number;
  totalErrorRecords: number;
  totalDlqRecords: number;
  avgPreprocessingSec: number | null;
  avgEdaSec: number | null;
  avgTurnaroundSec: number | null;
  avgConfidence: number | null;
  statusBreakdown: StatusBreakdown[];
}

export interface TrendPoint {
  bucket: string;
  batches: number;
  records: number;
  errors: number;
  avgConfidence: number | null;
}

export interface TrendSeries {
  from: string;
  to: string;
  interval: 'day' | 'week';
  points: TrendPoint[];
}

export interface TopErrorBatch {
  batchId: string;
  fileName: string;
  uploadedAt: string;
  errorRecords: number;
  dlqCount: number;
  batchStatus: string;
}

export interface DashboardFilters { from?: string; to?: string }

function qs(filters: Readonly<Record<string, string | number | undefined>> | object): string {
  const p = new URLSearchParams();
  Object.entries(filters as Record<string, unknown>).forEach(([k, v]) => {
    if (v != null && v !== '') p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function getMetrics(filters: DashboardFilters = {}): Promise<DashboardMetrics> {
  return apiFetch<DashboardMetrics>(`/dashboard/metrics${qs(filters)}`);
}

export function getTrend(filters: DashboardFilters & { interval?: 'day' | 'week' } = {}): Promise<TrendSeries> {
  return apiFetch<TrendSeries>(`/dashboard/trend${qs(filters)}`);
}

export function getTopErrors(filters: DashboardFilters & { limit?: number } = {}): Promise<TopErrorBatch[]> {
  return apiFetch<TopErrorBatch[]>(`/dashboard/top-errors${qs(filters)}`);
}
