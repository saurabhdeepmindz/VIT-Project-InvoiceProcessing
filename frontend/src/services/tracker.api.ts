/**
 * tracker.api.ts — EPIC-005 client.
 */

import { apiFetch, type ApiError } from '@/lib/api';

export type { ApiError };

export interface FileStatusRow {
  batchId: string;
  fileName: string;
  uploadedAt: string;
  batchStatus: string;
  batchSize: number;
  preprocessingStatus: string | null;
  preprocessingDurationSec: number | null;
  edaStatus: string | null;
  edaDurationSec: number | null;
  totalRecords: number;
  processedRecords: number;
  errorRecords: number;
  deadLetteredRecords: number;
  avgConfidence: number | null;
  turnaroundTimeSec: number | null;
  outputCsvPath: string | null;
}

export interface FileStatusList {
  data: FileStatusRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TrackerRecord {
  recordId: string;
  csvRowNumber: number;
  sourceUrl: string;
  preprocessingStatus: string;
  edaStatus: string;
  pageCount: number | null;
  confidenceScore: number | null;
  extractionStatus: string | null;
  errorMessage: string | null;
}

export interface TrackerAuditEntry {
  action: string;
  actor: string;
  recordId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface TrackerDlqEntry {
  id: string;
  recordId: string | null;
  failureStage: string;
  errorCode: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
}

export interface FileStatusDetail {
  summary: FileStatusRow;
  records: TrackerRecord[];
  auditTail: TrackerAuditEntry[];
  dlq: TrackerDlqEntry[];
}

export interface TrackerListFilters {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
}

export function listTracker(filters: TrackerListFilters = {}): Promise<FileStatusList> {
  const qp = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') qp.append(k, String(v)); });
  const qs = qp.toString();
  return apiFetch<FileStatusList>(`/tracker/files${qs ? `?${qs}` : ''}`);
}

export function getTrackerDetail(batchId: string): Promise<FileStatusDetail> {
  return apiFetch<FileStatusDetail>(`/tracker/files/${batchId}`);
}
