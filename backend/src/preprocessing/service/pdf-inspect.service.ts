/**
 * @file   pdf-inspect.service.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * @description
 * PDF detection + page-count inspection (without full rendering).
 * Actual page → image conversion is deferred to the Python AI service in
 * Phase 3 (pypdfium2).
 *
 * @since 3.1.0
 */

import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../common/logger/AppLogger';
import { PdfConversionException } from '../../common/exceptions';
import { PDF_MAGIC } from '../constants';

export interface PdfInspectResult {
  isPdf: boolean;
  pageCount: number;
}

@Injectable()
export class PdfInspectService {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext('PdfInspectService');
  }

  async inspect(bytes: Buffer): Promise<PdfInspectResult> {
    if (!this.looksLikePdf(bytes)) return { isPdf: false, pageCount: 1 };
    try {
      const pageCount = await this.countPages(bytes);
      return { isPdf: true, pageCount };
    } catch (err: unknown) {
      throw new PdfConversionException(
        `PDF page-count failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private looksLikePdf(bytes: Buffer): boolean {
    // Magic header can be offset by up to a few bytes in malformed PDFs; check first 1 KiB.
    const head = bytes.subarray(0, Math.min(1024, bytes.byteLength));
    return head.indexOf(PDF_MAGIC) !== -1;
  }

  private async countPages(bytes: Buffer): Promise<number> {
    // Dynamic import of pdfjs-dist legacy build (ESM + Node-friendly).
    // Using a string literal would let webpack resolve statically;
    // we wrap with (() => ...) to keep NestJS CommonJS build happy.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Disable the worker — pdfjs will fall back to in-process parsing for metadata.
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: false,
      disableFontFace: true,
      isEvalSupported: false,
    });
    const doc = await loadingTask.promise;
    const pages = doc.numPages;
    await doc.destroy();
    return pages;
  }
}
