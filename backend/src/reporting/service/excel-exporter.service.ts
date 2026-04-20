/**
 * @file   excel-exporter.service.ts
 * @module Reporting
 *
 * Generates .xlsx with a single worksheet. Bold header. For SINGLE_FILE
 * reports, colour-codes the confidence_score cell: red <30, amber 30-70, green ≥70.
 */

import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExcelExportOptions {
  sheetName?: string;
  confidenceColumnKey?: string;
}

@Injectable()
export class ExcelExporter {
  async export<T extends Record<string, unknown>>(
    rows: T[],
    columns: readonly string[],
    options: ExcelExportOptions = {},
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Invoice Processing Platform';
    wb.created = new Date();
    const ws = wb.addWorksheet(options.sheetName ?? 'Report');

    ws.columns = columns.map(c => ({ header: this.toHeader(c), key: c, width: Math.max(14, c.length + 2) }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: 'middle' };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F35' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of rows) {
      ws.addRow(row);
    }

    if (options.confidenceColumnKey) {
      const col = ws.getColumn(options.confidenceColumnKey);
      col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber === 1) return;
        const raw = cell.value;
        const v = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
        if (!Number.isFinite(v)) return;
        const fg =
          v < 30 ? 'FFFFCDD2' :
          v < 70 ? 'FFFFE0B2' : 'FFC8E6C9';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fg } };
      });
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }];

    const arrayBuf = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuf);
  }

  /** snake_case → Title Case for readable headers. */
  private toHeader(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
}
