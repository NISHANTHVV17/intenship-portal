function cell(value) {
  if (value === null || value === undefined) return '';
  let s = Array.isArray(value) ? value.join('; ') : String(value);
  // Neutralise spreadsheet formula injection for text cells.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [{ label, key } | { label, value: (row) => any }] */
export function toCsv(columns, rows) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => cell(c.value ? c.value(row) : row[c.key])).join(','),
  );
  // BOM so Excel detects UTF-8.
  return `﻿${[header, ...lines].join('\r\n')}\r\n`;
}

export function sendCsv(res, filename, columns, rows) {
  const stamp = new Date().toISOString().slice(0, 10);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}-${stamp}.csv"`);
  res.send(toCsv(columns, rows));
}
