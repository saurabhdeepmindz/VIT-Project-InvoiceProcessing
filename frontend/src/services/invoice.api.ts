/**
 * invoice.api.ts — EPIC-002 client (v3.1).
 * Maps to backend InvoiceController under /api/v1/invoice/batches.
 */

const ACCESS_TOKEN_KEY = 'invoice.accessToken';

export interface BatchResponse {
  batchId: string;
  totalRecords: number;
  status: 'UPLOADED';
  csvContentHash: string;
  csvPath: string;
  createdAt: string;
}

export interface BatchListItem {
  batchId: string;
  status: string;
  batchSize: number;
  createdAt: string;
}

export interface BatchListResponse {
  data: BatchListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BatchStatus {
  batchId: string;
  status: string;
  batchSize: number;
  createdAt: string;
  updatedAt: string;
  preprocessingStatus: string | null;
  edaStatus: string | null;
  totalRecords: number | null;
  processedRecords: number | null;
  errorRecords: number | null;
  avgConfidence: number | null;
}

export interface ApiErrorShape {
  statusCode: number;
  message: string;
  error: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
}

async function parseError(res: Response): Promise<never> {
  let err: ApiErrorShape = { statusCode: res.status, message: res.statusText, error: 'HTTP_ERROR' };
  try { err = { ...err, ...(await res.json()) }; } catch { /* ignore */ }
  throw err;
}

/**
 * POST /invoice/batches — multipart upload of the CSV manifest.
 * Uses XMLHttpRequest so we can surface progress events.
 */
export function uploadCsvBatch(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<BatchResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    xhr.open('POST', `${baseUrl()}/invoice/batches`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
    };

    xhr.onload = () => {
      try {
        const body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) resolve(body as BatchResponse);
        else reject({ statusCode: xhr.status, ...(body ?? {}) } as ApiErrorShape);
      } catch {
        reject({ statusCode: xhr.status, message: xhr.responseText || 'Upload failed', error: 'PARSE_ERROR' } as ApiErrorShape);
      }
    };

    xhr.onerror = () => reject({ statusCode: 0, message: 'Network error', error: 'NETWORK' } as ApiErrorShape);
    xhr.send(form);
  });
}

export async function listBatches(page = 1, limit = 10): Promise<BatchListResponse> {
  const token = getToken();
  const res = await fetch(`${baseUrl()}/invoice/batches?page=${page}&limit=${limit}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return parseError(res);
  return res.json();
}

export async function getBatch(batchId: string): Promise<BatchStatus> {
  const token = getToken();
  const res = await fetch(`${baseUrl()}/invoice/batches/${batchId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return parseError(res);
  return res.json();
}
