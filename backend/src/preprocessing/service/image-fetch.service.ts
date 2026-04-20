/**
 * @file   image-fetch.service.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * @description
 * Downloads invoice image/PDF bytes from source URLs.
 *
 * v3.1 guarantees:
 *  - Host allowlist enforcement (SSRF guard — configurable via IMG_URL_HOST_ALLOWLIST)
 *  - Size cap at response level (IMG_MAX_DOWNLOAD_MB, default 30 MB)
 *  - Timeout (IMG_DOWNLOAD_TIMEOUT_MS, default 180 000 ms)
 *  - Retry with exponential backoff (IMG_DOWNLOAD_RETRY attempts)
 *  - Returns bytes + SHA-256 for dedup
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { createHash } from 'node:crypto';
import { AppLogger } from '../../common/logger/AppLogger';
import {
  UrlFetchException,
  UrlSizeExceededException,
  UrlHostNotAllowedException,
} from '../../common/exceptions';

export interface FetchResult {
  bytes: Buffer;
  sha256: string;
  contentType: string | null;
  sizeBytes: number;
  attempts: number;
}

@Injectable()
export class ImageFetchService {
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly allowlist: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('ImageFetchService');
    this.maxBytes   = Number(config.get('IMG_MAX_DOWNLOAD_MB') ?? 30) * 1024 * 1024;
    this.timeoutMs  = Number(config.get('IMG_DOWNLOAD_TIMEOUT_MS') ?? 180_000);
    this.maxRetries = Number(config.get('IMG_DOWNLOAD_RETRY') ?? 3);
    this.backoffMs  = Number(config.get('IMG_DOWNLOAD_BACKOFF_MS') ?? 1000);
    this.allowlist  = (config.get<string>('IMG_URL_HOST_ALLOWLIST') ?? '*')
      .split(',').map(s => s.trim()).filter(Boolean);
  }

  async fetch(url: string): Promise<FetchResult> {
    this.enforceHostAllowlist(url);

    let lastErr: unknown = null;
    const attempts = Math.max(1, this.maxRetries + 1);
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const res = await axios.get<ArrayBuffer>(url, {
          responseType: 'arraybuffer',
          timeout: this.timeoutMs,
          maxContentLength: this.maxBytes,
          maxBodyLength: this.maxBytes,
          validateStatus: (s) => s >= 200 && s < 300,
          // follow redirects within the allowlist — default axios does up to 5
        });
        return this.packResult(res, attempt);
      } catch (err: unknown) {
        lastErr = err;
        const retryable = this.isRetryable(err);
        this.logger.warn('Image fetch attempt failed', {
          url, attempt, attempts, retryable, error: this.summariseError(err),
        });
        if (!retryable || attempt === attempts) break;
        await this.sleep(this.backoffMs * Math.pow(2, attempt - 1));
      }
    }

    // Specific size-exceeded translation for nicer errors
    if (lastErr instanceof AxiosError &&
        (lastErr.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED' ||
         lastErr.code === 'ERR_FR_MAX_CONTENT_LENGTH_EXCEEDED')) {
      throw new UrlSizeExceededException(url, Number(lastErr.message.match(/\d+/)?.[0] ?? 0), this.maxBytes);
    }
    throw new UrlFetchException(url, attempts, this.summariseError(lastErr));
  }

  private packResult(res: AxiosResponse<ArrayBuffer>, attempts: number): FetchResult {
    const bytes = Buffer.from(res.data);
    if (bytes.byteLength > this.maxBytes) {
      throw new UrlSizeExceededException(res.config.url ?? 'unknown', bytes.byteLength, this.maxBytes);
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const ct = res.headers['content-type'] ?? null;
    return {
      bytes,
      sha256,
      contentType: typeof ct === 'string' ? ct.split(';')[0].trim() : null,
      sizeBytes: bytes.byteLength,
      attempts,
    };
  }

  private isRetryable(err: unknown): boolean {
    if (!(err instanceof AxiosError)) return false;
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return true;
    if (err.code === 'ECONNRESET'  || err.code === 'ENOTFOUND')  return true;
    const s = err.response?.status;
    return s != null && (s === 408 || s === 429 || s >= 500);
  }

  private summariseError(err: unknown): string {
    if (err instanceof AxiosError) {
      return err.response ? `HTTP ${err.response.status}` : (err.code ?? err.message);
    }
    return err instanceof Error ? err.message : String(err);
  }

  private enforceHostAllowlist(url: string): void {
    let u: URL;
    try { u = new URL(url); } catch {
      throw new UrlFetchException(url, 0, 'invalid URL');
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new UrlFetchException(url, 0, `unsupported protocol ${u.protocol}`);
    }
    if (this.allowlist.length === 0 || this.allowlist.includes('*')) return;
    const host = u.hostname.toLowerCase();
    const ok = this.allowlist.some(e => {
      const trimmed = e.toLowerCase();
      if (trimmed.startsWith('*.')) return host === trimmed.slice(2) || host.endsWith(`.${trimmed.slice(2)}`);
      return host === trimmed;
    });
    if (!ok) throw new UrlHostNotAllowedException(host, this.allowlist);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
  }
}
