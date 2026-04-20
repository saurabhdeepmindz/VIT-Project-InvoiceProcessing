/**
 * @file   RolesGuard-and-Exceptions.ts
 * @module Common / Guards / Exceptions
 *
 * @description
 * DEPRECATED — split in v3.1. Content has been moved to:
 *   - common/guards/RolesGuard.ts
 *   - common/guards/JwtAuthGuard.ts
 *   - common/exceptions/index.ts
 *
 * This file is kept as a re-export barrel for backwards compatibility
 * with any imports that still reference the original combined location.
 * New code should import from the split files directly.
 *
 * @since 1.0.0
 * @deprecated since 3.1.0
 */

export { RolesGuard } from './RolesGuard';
export { JwtAuthGuard } from './JwtAuthGuard';
export {
  FileValidationException, StorageException, LlmProviderException,
  ExtractionFailureException, OcrException,
  UrlFetchException, UrlSizeExceededException, UrlHostNotAllowedException,
  PdfConversionException, DuplicateCsvException, DeadLetteredException,
} from '../exceptions';
