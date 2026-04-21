/**
 * preprocessing.api.ts — EPIC-003 preprocessing endpoints.
 */

import { apiFetch, type ApiError } from '@/lib/api';

export type { ApiError };

export interface RetryPreprocessingResponse {
  batchId: string;
  queued: number;
}

/**
 * Re-queues preprocessing for records currently in DEAD_LETTERED or ERROR state.
 * Resets the matched records to PENDING and re-triggers the preprocessing
 * scheduler. Records that already succeeded are left untouched.
 * Allowed for INVOICE_OPERATOR and ADMIN roles.
 */
export function retryPreprocessing(batchId: string): Promise<RetryPreprocessingResponse> {
  return apiFetch<RetryPreprocessingResponse>(
    `/preprocessing/batches/${batchId}/retry`,
    { method: 'POST' },
  );
}
