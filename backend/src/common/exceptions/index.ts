/**
 * @file   exceptions/index.ts
 * @module Common / Exceptions
 *
 * @description
 * Custom HTTP exceptions across all Epics.
 * All exceptions extend NestJS HttpException so they integrate with the
 * global HttpExceptionFilter.
 *
 * v3.0 exceptions: FileValidation, Storage, LlmProvider, ExtractionFailure, Ocr
 * v3.1 additions:  UrlFetch, UrlSizeExceeded, UrlHostNotAllowed,
 *                  PdfConversion, DuplicateCsv, DeadLettered
 *
 * @since 3.1.0
 */

import { HttpException, HttpStatus } from '@nestjs/common';

/* ────────────────────────────────────────────────────────────────
   v3.0 exceptions
   ──────────────────────────────────────────────────────────────── */

export class FileValidationException extends HttpException {
  constructor(fileName: string, reason: string, expected?: string) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: `File validation failed: ${fileName} — ${reason}`,
      expected: expected ?? 'unknown',
      received: fileName,
      error: 'FILE_VALIDATION_ERROR',
    }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class StorageException extends HttpException {
  constructor(operation: string, path: string, cause?: string) {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: `Storage operation '${operation}' failed for path: ${path}${cause ? ` — ${cause}` : ''}`,
      error: 'STORAGE_ERROR',
    }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class LlmProviderException extends HttpException {
  constructor(provider: string, providerStatus: number, message: string) {
    super({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: `LLM provider '${provider}' error (${providerStatus}): ${message}`,
      provider,
      error: 'LLM_PROVIDER_ERROR',
    }, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

export class ExtractionFailureException extends HttpException {
  constructor(recordId: string, reason: string) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: `Extraction failed for record ${recordId}: ${reason}`,
      recordId,
      error: 'EXTRACTION_FAILURE',
    }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class OcrException extends HttpException {
  constructor(imagePath: string, engine: string, message: string) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: `OCR failed (${engine}) for ${imagePath}: ${message}`,
      engine,
      error: 'OCR_ERROR',
    }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

/* ────────────────────────────────────────────────────────────────
   v3.1 additions — URL fetch, PDF, idempotency, DLQ
   ──────────────────────────────────────────────────────────────── */

export class UrlFetchException extends HttpException {
  constructor(url: string, attempts: number, cause?: string) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: `Failed to fetch ${url} after ${attempts} attempts${cause ? `: ${cause}` : ''}`,
      url, attempts,
      error: 'URL_FETCH_ERROR',
    }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class UrlSizeExceededException extends HttpException {
  constructor(url: string, sizeBytes: number, maxBytes: number) {
    super({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: `Downloaded file exceeds size cap: ${sizeBytes} > ${maxBytes} bytes (${url})`,
      url, sizeBytes, maxBytes,
      error: 'URL_SIZE_EXCEEDED',
    }, HttpStatus.PAYLOAD_TOO_LARGE);
  }
}

export class UrlHostNotAllowedException extends HttpException {
  constructor(host: string, allowlist: string[]) {
    super({
      statusCode: HttpStatus.BAD_REQUEST,
      message: `Host '${host}' is not in the allowlist`,
      host, allowlist,
      error: 'URL_HOST_NOT_ALLOWED',
    }, HttpStatus.BAD_REQUEST);
  }
}

export class PdfConversionException extends HttpException {
  constructor(detail: string, pages?: number) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      message: `PDF conversion failed: ${detail}`,
      pages,
      error: 'PDF_CONVERSION_ERROR',
    }, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class DuplicateCsvException extends HttpException {
  constructor(csvHash: string, existingBatchId: string) {
    super({
      statusCode: HttpStatus.CONFLICT,
      message: `CSV with this content has already been uploaded (batch: ${existingBatchId})`,
      csvHash, existingBatchId,
      error: 'DUPLICATE_CSV',
    }, HttpStatus.CONFLICT);
  }
}

export class DeadLetteredException extends HttpException {
  constructor(recordId: string, stage: string, lastError: string) {
    super({
      statusCode: HttpStatus.ACCEPTED,
      message: `Record ${recordId} moved to DLQ at stage '${stage}': ${lastError}`,
      recordId, stage, lastError,
      error: 'DEAD_LETTERED',
    }, HttpStatus.ACCEPTED);
  }
}
