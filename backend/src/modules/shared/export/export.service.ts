import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

/**
 * D9-F1 (CSV formula injection): a string cell is protected when its FIRST
 * character (raw, untrimmed) is a spreadsheet formula trigger, or when it
 * begins with a tab/CR/LF control character (spreadsheet apps skip these
 * before formula evaluation). Leading *space* is intentionally not treated as
 * a trigger: Excel does not evaluate " =1+1" as a formula, and trimming/
 * normalizing user text here would alter cell content.
 */
const FORMULA_TRIGGER = /^[=+\-@]/;
const LEADING_CONTROL = /^[\t\r\n]/;

/**
 * D9-F1: strict machine-number grammar for STRING cells. Exporters serialize
 * Prisma Decimal money via String(value) (e.g. amount: String(o.amount)), so
 * numeric machine data legitimately arrives as strings like "-12.50". Such
 * strings cannot execute as spreadsheet formulas (no function reference) and
 * MUST stay verbatim — prefixing them would corrupt numeric semantics.
 */
const MACHINE_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

@Injectable()
export class ExportService {
  /**
   * Generate CSV string from rows + columns.
   */
  toCsv(columns: ExportColumn[], rows: Record<string, any>[]): string {
    const header = columns.map(c => this.csvEscape(c.header)).join(',');
    const lines = rows.map(row =>
      columns.map(c => this.csvEscape(row[c.key])).join(','),
    );
    return '\uFEFF' + header + '\n' + lines.join('\n') + '\n';
  }

  /**
   * Generate XLSX buffer from rows + columns.
   */
  async toXlsx(
    columns: ExportColumn[],
    rows: Record<string, any>[],
    sheetName = 'Export',
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    ws.columns = columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width ?? 18,
    }));

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const row of rows) {
      ws.addRow(row);
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private csvEscape(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val);
    // D9-F1 formula-injection guard applies to string-typed (text) cells
    // only. Runtime machine scalars (number | boolean | Date) and strict
    // machine-number strings (Decimal String() contract, e.g. "-12.50",
    // "+1") are machine data, not formula payloads, and pass through
    // verbatim. Every other string whose first character is a formula
    // trigger (or that begins with a tab/CR/LF control character) is
    // escaped to text with a leading apostrophe; the cell content itself
    // is preserved unchanged after the apostrophe.
    if (
      typeof val === 'string' &&
      (FORMULA_TRIGGER.test(str) || LEADING_CONTROL.test(str)) &&
      !MACHINE_NUMBER.test(str)
    ) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
}
