import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

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
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
}
