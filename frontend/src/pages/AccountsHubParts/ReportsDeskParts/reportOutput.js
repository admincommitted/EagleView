import { accountsApi } from '../accountsApi';
import { fmtDate, inr } from '../ui';
import { saveCsv } from './csvFile';

export const isNumberColumn = (column) => ['money', 'int'].includes(column.type);
export const plainValue = (column, value) => (column.type === 'money' ? inr(value) : column.type === 'date' ? fmtDate(value) : (value ?? ''));

// header rows: a band row for columns that carry a group (Closing Balance > Debit / Credit), like iCAFFE
export const hasBands = (columns) => columns.some((column) => column.group);
export const bandsOf = (columns) => {
  const bands = [];
  for (const column of columns) {
    const group = column.group || '';
    const last = bands[bands.length - 1];
    if (last && last.group === group && group) last.span++;
    else bands.push({ group, span: 1, column });
  }
  return bands;
};

export const periodText = (data, filters, params) => {
  if (filters.includes('from') && data.from) return 'From ' + fmtDate(data.from) + ' To ' + fmtDate(data.to);
  return filters.includes('asOn') ? 'As On ' + fmtDate(params.asOn) : '';
};

export const exportReportCsv = (name, columns, rows) => saveCsv(
  name.replace(/[^\w]+/g, '_'),
  columns.map((column) => column.label),
  rows.map((row) => columns.map((column) => (column.type === 'date' ? fmtDate(row[column.key]) : row[column.key]))),
);

// iCAFFE prints and exports every report under the company block - name, address, report title, scope, period
let companyHeadPromise = null;
const loadCompanyHead = async () => {
  try {
    return await accountsApi.companyHead();
  } catch {
    companyHeadPromise = null;
    return { name: '', address: '' };
  }
};
const companyHead = () => (companyHeadPromise = companyHeadPromise || loadCompanyHead());

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

const printFrame = (html) => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      // the frame was closed before printing
    }
    setTimeout(() => frame.remove(), 1500);
  }, 250);
};

export async function printReport({ title, subtitle, period, scope, cols, groups, rows, totals, totalKeys, note }) {
  const head = await companyHead();
  const cell = (column, value, bold) => `<td style="text-align:${isNumberColumn(column) ? 'right' : 'left'};${bold ? 'font-weight:700' : ''}">${escapeHtml(plainValue(column, value))}</td>`;
  const totalCells = (sums, label) => cols.map((column, index) => (index === 0 ? `<td style="font-weight:700">${escapeHtml(label)}</td>` : totalKeys.includes(column.key) ? cell(column, sums[column.key], true) : '<td></td>')).join('');
  const rowHtml = (row) => '<tr>' + cols.map((column) => cell(column, row[column.key])).join('') + '</tr>';
  const headHtml = hasBands(cols)
    ? '<tr>' + bandsOf(cols).map((band) => (band.group ? `<th colspan="${band.span}">${escapeHtml(band.group)}</th>` : `<th rowspan="2">${escapeHtml(band.column.label)}</th>`)).join('') + '</tr>'
      + '<tr>' + cols.filter((column) => column.group).map((column) => `<th>${escapeHtml(column.label)}</th>`).join('') + '</tr>'
    : '<tr>' + cols.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('') + '</tr>';
  const body = groups
    ? groups.map((group) => `<tr class="g"><td colspan="${cols.length}">${escapeHtml(group.k)}</td></tr>` + group.list.map(rowHtml).join('') + (totalKeys.length ? `<tr class="st">${totalCells(group.t, 'Total')}</tr>` : '')).join('')
    : rows.map(rowHtml).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { size: ${cols.length > 9 ? 'A4 landscape' : 'A4'}; margin: 10mm }
    body { font-family: Arial, Helvetica, sans-serif; font-size: ${cols.length > 16 ? 8 : 10}px; color: #000 }
    .co { text-align: center; font-size: 15px; font-weight: 700 } .ad { text-align: center; font-size: 10px; margin-top: 2px } .ti { text-align: center; font-size: 12px; font-weight: 700; margin: 8px 0 2px; text-decoration: underline }
    .meta { display: flex; justify-content: space-between; font-size: 10px; margin: 6px 0 } table { border-collapse: collapse; width: 100% }
    th, td { border: 1px solid #555; padding: 2px 4px; vertical-align: top } th { background: #e9eef3 } tr.g td { font-weight: 700; background: #f4f6f8 } tr.st td, tfoot td { font-weight: 700; border-top: 1.5px solid #000 }
    .note { font-size: 9px; margin-top: 6px; color: #333 }</style></head><body>
    <div class="co">${escapeHtml(head.name)}</div>${head.address ? `<div class="ad">${escapeHtml(head.address)}</div>` : ''}${head.contact ? `<div class="ad">${escapeHtml(head.contact)}</div>` : ''}${head.gstin ? `<div class="ad">GSTIN: ${escapeHtml(head.gstin)}</div>` : ''}
    <div class="ti">${escapeHtml(subtitle || title)}</div>
    <div class="meta"><span>Scope : ${escapeHtml(scope)}</span><span>${escapeHtml(period)}</span><span>Printed on ${fmtDate(new Date().toISOString())}</span></div>
    <table><thead>${headHtml}</thead><tbody>${body}</tbody>${totalKeys.length ? `<tfoot><tr>${totalCells(totals, 'Grand Total')}</tr></tfoot>` : ''}</table>
    ${note ? `<div class="note">${escapeHtml(note)}</div>` : ''}</body></html>`;
  printFrame(html);
}

// real Excel: company block, title, period, the two header rows, rows (with group headings and sub-totals), grand total
export async function excelReport({ title, subtitle, period, scope, cols, groups, rows, totals, totalKeys }) {
  const [XLSX, head] = await Promise.all([import('xlsx'), companyHead()]);
  const cellValue = (column, value) => {
    if (isNumberColumn(column)) return value === '' || value == null ? '' : Number(value) || 0;
    return column.type === 'date' ? fmtDate(value) : (value ?? '');
  };
  const sheet = [[head.name], [head.address || ''], [subtitle || title], ['Scope : ' + scope + '    ' + period], []];
  const merges = [0, 1, 2, 3].map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: Math.max(0, cols.length - 1) } }));
  if (hasBands(cols)) {
    const bandRow = [];
    const labelRow = [];
    const top = sheet.length;
    let columnIndex = 0;
    for (const band of bandsOf(cols)) {
      if (band.group) {
        bandRow.push(band.group, ...Array(band.span - 1).fill(''));
        merges.push({ s: { r: top, c: columnIndex }, e: { r: top, c: columnIndex + band.span - 1 } });
        cols.slice(columnIndex, columnIndex + band.span).forEach((column) => labelRow.push(column.label));
      } else {
        bandRow.push(band.column.label);
        labelRow.push('');
        merges.push({ s: { r: top, c: columnIndex }, e: { r: top + 1, c: columnIndex } });
      }
      columnIndex += band.span;
    }
    sheet.push(bandRow, labelRow);
  } else {
    sheet.push(cols.map((column) => column.label));
  }
  const totalRow = (sums, label) => cols.map((column, index) => (index === 0 ? label : totalKeys.includes(column.key) ? Number(sums[column.key]) || 0 : ''));
  const dataRow = (row) => cols.map((column) => cellValue(column, row[column.key]));
  if (groups) {
    for (const group of groups) {
      sheet.push([group.k]);
      group.list.forEach((row) => sheet.push(dataRow(row)));
      if (totalKeys.length) sheet.push(totalRow(group.t, 'Total'));
    }
  } else {
    rows.forEach((row) => sheet.push(dataRow(row)));
  }
  if (totalKeys.length) sheet.push(totalRow(totals, 'Grand Total'));
  const worksheet = XLSX.utils.aoa_to_sheet(sheet);
  worksheet['!merges'] = merges;
  worksheet['!cols'] = cols.map((column) => ({ wch: Math.min(40, Math.max(10, String(column.label).length + 2, column.type === 'money' ? 14 : 0)) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, String(title).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  XLSX.writeFile(workbook, String(title).replace(/[^\w]+/g, '_') + '.xlsx');
}
