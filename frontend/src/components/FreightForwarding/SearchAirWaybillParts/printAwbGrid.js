import { escapeHtml, printHtml } from '../AirExportParts/printHtml';
import { PRINT_COLUMNS, totalsOf } from './searchConfig';

const PRINT_CSS = 'body{font-family:Arial,sans-serif;font-size:10px;margin:12px}h3{margin:0 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 4px;text-align:left}th{background:#eee}@page{size:landscape;margin:10mm}';

export function printAwbGrid(rows) {
  const totals = totalsOf(rows);
  const head = PRINT_COLUMNS.map(([, label]) => `<th>${label}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${PRINT_COLUMNS.map(([key, , valueOf]) => `<td>${escapeHtml(valueOf ? valueOf(row) : row[key])}</td>`).join('')}</tr>`)
    .join('');
  const summary = `Printed ${escapeHtml(new Date().toLocaleString())} · Pkgs ${totals.pkgs} · Gr.Wt ${totals.gr.toFixed(2)} · Chg.Wt ${totals.chg.toFixed(2)}`;
  printHtml(`<!doctype html><html><head><title>AWB Search</title><style>${PRINT_CSS}</style></head><body><h3>Airwaybill Query - ${rows.length} records</h3><div style="margin-bottom:6px">${summary}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
}
