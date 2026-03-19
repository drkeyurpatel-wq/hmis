// lib/reports/excel-export.ts
import * as XLSX from 'xlsx';

export interface ExcelColumn {
  key: string; label: string;
  type?: 'text' | 'number' | 'currency' | 'percent' | 'date';
  width?: number;
}

export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  data: Record<string, any>[];
  title?: string;  // Header row above column headers
}

export function exportToExcel(sheets: ExcelSheet[], filename: string) {
  const wb = XLSX.utils.book_new();

  sheets.forEach(sheet => {
    const rows: any[][] = [];

    // Title row
    if (sheet.title) {
      rows.push([sheet.title]);
      rows.push([]);
    }

    // Header row
    rows.push(sheet.columns.map(c => c.label));

    // Data rows
    sheet.data.forEach(row => {
      rows.push(sheet.columns.map(c => {
        const val = row[c.key];
        if (val === null || val === undefined) return '';
        if (c.type === 'currency') return parseFloat(val) || 0;
        if (c.type === 'number') return parseFloat(val) || 0;
        if (c.type === 'percent') return (parseFloat(val) || 0) / 100;
        return val;
      }));
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Column widths
    ws['!cols'] = sheet.columns.map(c => ({
      wch: c.width || Math.max(c.label.length + 2, 12),
    }));

    // Number formats
    const startRow = sheet.title ? 3 : 1;
    sheet.columns.forEach((col, colIdx) => {
      for (let rowIdx = startRow; rowIdx < startRow + sheet.data.length; rowIdx++) {
        const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })];
        if (!cell) continue;
        if (col.type === 'currency') cell.z = '#,##0';
        if (col.type === 'percent') cell.z = '0.0%';
        if (col.type === 'number') cell.z = '#,##0';
      }
    });

    // Title merge
    if (sheet.title) {
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: sheet.columns.length - 1 } }];
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
  });

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// Quick single-sheet export
export function exportSingleSheet(data: Record<string, any>[], columns: ExcelColumn[], filename: string, title?: string) {
  exportToExcel([{ name: 'Report', columns, data, title }], filename);
}
