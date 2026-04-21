/**
 * eda.api.ts — EPIC-004 EDA admin endpoints.
 */

import { apiFetch, type ApiError } from '@/lib/api';

export type { ApiError };

export interface RerunResponse {
  batchId: string;
}

/**
 * Re-runs EDA extraction on a batch. The backend only re-processes records
 * whose eda_status is PENDING or FAILED — records already EXTRACTED are
 * left untouched. Admin-only endpoint.
 */
export function rerunEda(batchId: string): Promise<RerunResponse> {
  return apiFetch<RerunResponse>(`/eda/batches/${batchId}/run`, { method: 'POST' });
}
