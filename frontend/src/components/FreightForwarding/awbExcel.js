import * as XLSX from 'xlsx';

const MAX_COLUMN_WIDTH = 40;
const ROWS_SAMPLED_FOR_WIDTH = 200;

const pad2 = (number) => String(number).padStart(2, '0');

const fileStamp = (date = new Date()) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}`;

// Numbers stay numbers so Excel can add them up; long digit strings and leading zeros (codes, AWB numbers) stay text.
function excelCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  const text = String(value);
  return /^-?\d+(\.\d+)?$/.test(text) && text.length < 12 && !/^0\d/.test(text) ? Number(text) : text;
}

const columnWidth = (header, body, columnIndex) => Math.min(
  MAX_COLUMN_WIDTH,
  Math.max(String(header).length, ...body.slice(0, ROWS_SAMPLED_FOR_WIDTH).map((row) => String(row[columnIndex] ?? '').length)) + 2,
);

// columns: [[key, header, (row) => value?], ...]
export function exportRowsToExcel(fileBase, sheetName, columns, rows) {
  const headers = columns.map((column) => column[1]);
  const body = rows.map((row) => columns.map(([key, , readValue]) => excelCell(readValue ? readValue(row) : row[key])));
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
  sheet['!cols'] = headers.map((header, columnIndex) => ({ wch: columnWidth(header, body, columnIndex) }));
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: headers.length - 1 } }) };
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${fileBase}_${fileStamp()}.xlsx`);
}
