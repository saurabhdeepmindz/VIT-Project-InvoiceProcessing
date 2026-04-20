/**
 * @file   csv-exporter.service.ts
 * @module Reporting
 */

import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class CsvExporter {
  export<T extends Record<string, unknown>>(rows: T[], columns: readonly string[]): Buffer {
    const csv = stringify(rows, {
      header: true,
      columns: Array.from(columns),
      quoted: true,
      eof: true,
    });
    return Buffer.from(csv, 'utf-8');
  }
}
