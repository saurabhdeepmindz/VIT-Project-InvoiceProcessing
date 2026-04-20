/**
 * @file   invoice-uploaded.event.ts
 * @module Invoice (EPIC-002)
 *
 * @description
 * Event emitted on successful batch creation. Consumed by EPIC-003
 * PreprocessingService to kick off URL download + validation + metadata extraction.
 *
 * @since 3.1.0
 */

export class InvoiceUploadedEvent {
  constructor(
    public readonly batchId: string,
    public readonly userId: string,
    public readonly recordCount: number,
    public readonly csvPath: string,
    public readonly emittedAt: Date = new Date(),
  ) {}
}
