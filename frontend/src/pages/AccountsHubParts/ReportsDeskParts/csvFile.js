import { downloadBlob } from '@/lib/download';

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

// the BOM makes Excel read the file as UTF-8
export function saveCsv(fileName, headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
  downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }), fileName + '.csv');
}

// columns: [[key or (row) => value, header], ...]
export const saveCsvColumns = (fileName, columns, rows) => saveCsv(
  fileName,
  columns.map(([, header]) => header),
  rows.map((row) => columns.map(([key]) => (typeof key === 'function' ? key(row) : row[key]))),
);
