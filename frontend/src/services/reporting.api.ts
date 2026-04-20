/**
 * reporting.api.ts — EPIC-007 client.
 */

import { apiFetch, type ApiError } from '@/lib/api';

export type { ApiError };

export type ReportType = 'SINGLE_FILE' | 'WEEKLY' | 'ERROR';
export type ReportFormat = 'CSV' | 'XLSX';

export interface GenerateReportInput {
  reportType: ReportType;
  format: ReportFormat;
  batchId?: string;
  from?: string;
  to?: string;
  lowConfidenceThreshold?: number;
}

export interface ReportFile {
  id: string;
  reportType: ReportType;
  fileFormat: ReportFormat;
  filePath: string;
  recordCount: number;
  parameters: Record<string, string>;
  generatedByUserId: string;
  generatedAt: string;
}

export interface ReportList {
  data: ReportFile[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function generateReport(input: GenerateReportInput): Promise<ReportFile> {
  return apiFetch<ReportFile>('/reports/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listReports(page = 1, limit = 20, type?: ReportType): Promise<ReportList> {
  const qp = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (type) qp.append('type', type);
  return apiFetch<ReportList>(`/reports?${qp.toString()}`);
}

export function downloadReport(id: string, filename: string): Promise<void> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('invoice.accessToken') : null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  return fetch(`${base}/reports/${id}/download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
}
