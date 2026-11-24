import * as XLSX from 'xlsx';

// Excel export for the Air Export grids (Search, Track Shipments) - 29-Oct-2026.
// columns: [[key, header, (row) => value?], ...]; numbers stay numbers so Excel can add them up.
export function exportRowsToExcel(fileBase, sheetName, columns, rows) {
  const head = columns.map((c) => c[1]);
  const body = rows.map((r) => columns.map(([key, , fn]) => {
    const v = fn ? fn(r) : r[key];
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v;
    const s = String(v);
    return /^-?\d+(\.\d+)?$/.test(s) && s.length < 12 && !/^0\d/.test(s) ? Number(s) : s;
  }));
  const ws = XLSX.utils.aoa_to_sheet([head, ...body]);
  ws['!cols'] = head.map((h, i) => ({ wch: Math.min(40, Math.max(String(h).length, ...body.slice(0, 200).map((r) => String(r[i] ?? '').length)) + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: head.length - 1 } }) };
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `${fileBase}_${stamp}.xlsx`);
}
