/**
 * @file   preprocessing-completed.event.ts
 * @module Preprocessing (EPIC-003, v3.1)
 *
 * Emitted on success (all records OK) or partial (some DLQ'd).
 * EPIC-004 EdaService listens for this to start extraction.
 */

export type PreprocessingOutcome = 'DONE' | 'PARTIAL' | 'FAILED';

export class PreprocessingCompletedEvent {
  constructor(
    public readonly batchId: string,
    public readonly outcome: PreprocessingOutcome,
    public readonly totalRecords: number,
    public readonly processedRecords: number,
    public readonly errorRecords: number,
    public readonly emittedAt: Date = new Date(),
  ) {}
}
