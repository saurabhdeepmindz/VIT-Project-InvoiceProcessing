/**
 * @file   invoice.validator.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Pure-function CSV + URL validation. No DB, no storage, no DI — trivially
 * unit-testable.
 *
 * Scope for Phase 1:
 *  - File size / MIME
 *  - CSV header normalisation + detection of the URL column
 *  - URL parsing, host allowlist (v3.1 SSRF guard)
 *  - Max row cap
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  FileValidationException,
  UrlHostNotAllowedException,
} from '../common/exceptions';
import {
  ACCEPTED_CSV_MIMETYPES,
  CSV_URL_HEADER_ALIASES,
  DEFAULT_MAX_CSV_SIZE_MB,
  MAX_CSV_ROWS,
  REQUIRED_CSV_HEADER,
} from './constants';

export interface ParsedRow {
  rowNumber: number;          // 1-based (excludes header row)
  rawData: Record<string, string>;
  url: string;
}

export interface ValidationResult {
  rows: ParsedRow[];
  detectedHeader: string;     // the actual header string found in the CSV
}

@Injectable()
export class InvoiceValidator {
  validateFile(file: { originalname: string; mimetype: string; size: number } | undefined, maxSizeMb: number = DEFAULT_MAX_CSV_SIZE_MB): void {
    if (!file) {
      throw new FileValidationException('(none)', 'No CSV file provided');
    }
    if (!ACCEPTED_CSV_MIMETYPES.includes(file.mimetype) && !file.originalname.toLowerCase().endsWith('.csv')) {
      throw new FileValidationException(
        file.originalname, `Unsupported MIME type '${file.mimetype}'`, ACCEPTED_CSV_MIMETYPES.join(', '),
      );
    }
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new FileValidationException(
        file.originalname, `File size ${file.size} bytes exceeds cap ${maxBytes} bytes (${maxSizeMb} MB)`,
      );
    }
  }

  /**
   * Parse the CSV and extract the URL column rows.
   * Strips trailing ':' and whitespace from headers (the sample file uses "Invoice Links:" with a colon).
   */
  parseAndExtractUrls(buffer: Buffer, hostAllowlist: string[]): ValidationResult {
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');  // strip BOM if present

    let rows: Record<string, string>[];
    try {
      rows = parseCsv(text, {
        columns: (header: string[]) => header.map(h => this.normaliseHeader(h)),
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as Record<string, string>[];
    } catch (err: unknown) {
      throw new FileValidationException('csv', `CSV parse error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (rows.length === 0) {
      throw new FileValidationException('csv', 'CSV has no data rows');
    }
    if (rows.length > MAX_CSV_ROWS) {
      throw new FileValidationException('csv', `CSV has ${rows.length} rows, exceeding max ${MAX_CSV_ROWS}`);
    }

    // Find the URL column — first header matching an alias.
    const firstRow = rows[0];
    const headers = Object.keys(firstRow);
    const urlHeader = headers.find(h => CSV_URL_HEADER_ALIASES.includes(h.toLowerCase()));
    if (!urlHeader) {
      throw new FileValidationException(
        'csv',
        `Required header not found. Expected one of: ${CSV_URL_HEADER_ALIASES.join(', ')}. Got: ${headers.join(', ')}`,
        REQUIRED_CSV_HEADER,
      );
    }

    const parsed: ParsedRow[] = [];
    rows.forEach((rawData, idx) => {
      const rowNumber = idx + 1;
      const rawUrl = (rawData[urlHeader] ?? '').trim();
      if (!rawUrl) {
        throw new FileValidationException('csv', `Row ${rowNumber}: empty URL in '${urlHeader}' column`);
      }
      const parsedUrl = this.parseAndValidateUrl(rawUrl, rowNumber, hostAllowlist);
      parsed.push({ rowNumber, rawData, url: parsedUrl });
    });

    return { rows: parsed, detectedHeader: urlHeader };
  }

  parseAndValidateUrl(rawUrl: string, rowNumber: number, hostAllowlist: string[]): string {
    let u: URL;
    try {
      u = new URL(rawUrl);
    } catch {
      throw new FileValidationException('csv', `Row ${rowNumber}: invalid URL '${rawUrl}'`);
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new FileValidationException('csv', `Row ${rowNumber}: unsupported protocol '${u.protocol}'`);
    }
    this.enforceHostAllowlist(u.hostname, hostAllowlist);
    return u.toString();
  }

  enforceHostAllowlist(host: string, allowlist: string[]): void {
    // '*' or empty allowlist means disabled (demo mode).
    if (allowlist.length === 0 || allowlist.includes('*')) return;
    const matched = allowlist.some(entry => this.hostMatches(host, entry));
    if (!matched) {
      throw new UrlHostNotAllowedException(host, allowlist);
    }
  }

  private hostMatches(host: string, entry: string): boolean {
    const h = host.toLowerCase();
    const e = entry.trim().toLowerCase();
    if (!e) return false;
    if (e.startsWith('*.')) return h === e.slice(2) || h.endsWith(`.${e.slice(2)}`);
    return h === e;
  }

  private normaliseHeader(header: string): string {
    // Sample file uses "Invoice Links:" — strip trailing ':' and whitespace for parsing.
    return header.replace(/:$/, '').trim();
  }
}
