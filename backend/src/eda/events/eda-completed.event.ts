export type EdaOutcome = 'DONE' | 'PARTIAL' | 'FAILED';

export class EdaCompletedEvent {
  constructor(
    public readonly batchId: string,
    public readonly outcome: EdaOutcome,
    public readonly totalRecords: number,
    public readonly extractedRecords: number,
    public readonly failedRecords: number,
    public readonly avgConfidence: number | null,
    public readonly outputCsvPath: string | null,
    public readonly emittedAt: Date = new Date(),
  ) {}
}
