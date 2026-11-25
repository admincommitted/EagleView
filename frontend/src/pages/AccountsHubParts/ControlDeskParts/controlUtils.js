export const num = (value) => { const parsed = parseFloat(String(value ?? '').replace(/,/g, '')); return isFinite(parsed) ? parsed : 0; };
export const round2 = (value) => Math.round(value * 100) / 100;
export const daysBetween = (from, to) => Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000);
export const digitsOf = (text) => String(text || '').replace(/\D/g, '').replace(/^0+/, '');
export const sumOf = (rows, key) => round2(rows.reduce((total, row) => total + row[key], 0));

export const AGE = [['notDue', 'Not due'], ['d30', '1-30 days'], ['d60', '31-60 days'], ['d90', '61-90 days'], ['d90p', 'Over 90 days']];
export const AGE_TONE = { notDue: 'tw:text-success', d30: 'tw:text-warning', d60: 'tw:text-orange-700', d90: 'tw:text-red-700', d90p: 'tw:text-red-900' };
export const ageKey = (days) => (days <= 0 ? 'notDue' : days <= 30 ? 'd30' : days <= 60 ? 'd60' : days <= 90 ? 'd90' : 'd90p');
export const ageLabel = (key) => (AGE.find(([ageId]) => ageId === key) || [])[1];

// cols: [[key or (row) => value, header]]
export async function toExcel(name, cols, rows) {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([cols.map((col) => col[1]), ...rows.map((row) => cols.map(([field]) => (typeof field === 'function' ? field(row) : row[field])))]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
  XLSX.writeFile(book, name + '.xlsx');
}

export const escapeHtml = (text) => String(text ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

// a printable page in a new window; false when pop-ups are blocked
export function printHtml(title, body) {
  const page = window.open('', '_blank', 'width=900,height=1000');
  if (!page) return false;
  page.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111}
  h1{font-size:17px;margin:0}h2{font-size:13px;margin:4px 0 12px;font-weight:600}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #777;padding:5px 7px}th{background:#eee;text-align:left}
  .n{text-align:right;white-space:nowrap}.tot td{font-weight:800}.sub{color:#555;font-size:11px}</style></head><body>${body}<script>window.onload=function(){window.print()}</script></body></html>`);
  page.document.close();
  return true;
}
