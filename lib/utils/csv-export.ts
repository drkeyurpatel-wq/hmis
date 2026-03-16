// lib/utils/csv-export.ts
// Export data to CSV file for download

export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return;

  // Auto-detect columns if not specified
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

  // Header row
  const header = cols.map(c => `"${c.label}"`).join(',');

  // Data rows
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
