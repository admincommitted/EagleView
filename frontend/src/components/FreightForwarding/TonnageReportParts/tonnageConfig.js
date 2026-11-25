import { oneDecimal } from '../AirExportParts/airExport';
import { escapeHtml, printHtml } from '../AirExportParts/printHtml';

const twoDigits = (number) => String(number).padStart(2, '0');
export const toYmd = (date) => `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;

export const GROUPS = [
  { value: 'airline', label: 'Airline' },
  { value: 'agent', label: 'IATA agent (forwarder)' },
  { value: 'destination', label: 'Destination' },
  { value: 'origin', label: 'Origin' },
  { value: 'customer', label: 'Customer (shipper)' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
];

export const DATE_BASIS_OPTIONS = [{ value: 'AWB', label: 'AWB date' }, { value: 'FLIGHT', label: 'Flight date' }];
export const AWB_TYPE_OPTIONS = [{ value: 'ALL', label: 'Direct + MAWB' }, { value: 'AWB', label: 'Direct AWB' }, { value: 'MAWB', label: 'MAWB' }];

export const groupLabel = (groupBy) => GROUPS.find((group) => group.value === groupBy)?.label;
export const docsLabel = (groupBy) => (groupBy === 'customer' ? 'Shipments' : 'AWBs');

// Indian financial year starts on 1 April.
export function quickRanges(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  return [
    { label: 'This month', from: new Date(year, month, 1), to: today },
    { label: 'Last month', from: new Date(year, month - 1, 1), to: new Date(year, month, 0) },
    { label: 'This FY', from: new Date(month >= 3 ? year : year - 1, 3, 1), to: today },
  ];
}

export const initialFilters = () => {
  const today = new Date();
  return { from: toYmd(new Date(today.getFullYear(), today.getMonth(), 1)), to: toYmd(today), groupBy: 'airline', dateBasis: 'AWB', airline: '', agent: '', type: 'ALL' };
};

export const summaryExcelColumns = (report) => [
  ['label', groupLabel(report.groupBy)], ['docs', docsLabel(report.groupBy)], ['pieces', 'Pieces'], ['grossWeight', 'Gross Wt (kg)'],
  ['chargeableWeight', 'Chargeable Wt (kg)'], ['volume', 'Volume (CBM)'], ['share', 'Share %'],
];

export const detailExcelColumns = (report) => [
  ['day', 'Date'], ['agent', 'IATA agent'], ['kind', 'Type'], ['no', 'AWB / MAWB'], ['hawb', 'HAWB'], ['customer', 'Shipper'], ['origin', 'Origin'],
  ['destination', 'Destination'], ['flight', 'Flight'], ['pieces', 'Pieces'], ['gross', 'Gross Wt'], ['chargeable', 'Chargeable Wt'], ['group', groupLabel(report.groupBy)],
];

const PRINT_CSS = 'body{font-family:Arial,sans-serif;font-size:11px;margin:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}.r{text-align:right}tfoot td{font-weight:bold;background:#f5f5f5}';

export function printTonnage(report) {
  const groupName = escapeHtml(groupLabel(report.groupBy));
  const rows = report.groups
    .map((group) => `<tr><td>${escapeHtml(group.label)}</td><td class=r>${group.docs}</td><td class=r>${group.pieces}</td><td class=r>${oneDecimal(group.grossWeight)}</td><td class=r>${oneDecimal(group.chargeableWeight)}</td><td class=r>${group.share}%</td></tr>`)
    .join('');
  const { totals } = report;
  const period = `${escapeHtml(report.from)} to ${escapeHtml(report.to)} (${report.dateBasis === 'FLIGHT' ? 'flight date' : 'AWB date'}) · printed ${escapeHtml(new Date().toLocaleString())}`;
  const head = `<tr><th>${groupName}</th><th class=r>${docsLabel(report.groupBy)}</th><th class=r>Pieces</th><th class=r>Gross Wt (kg)</th><th class=r>Chargeable Wt (kg)</th><th class=r>Share</th></tr>`;
  const foot = `<tr><td>TOTAL (${totals.tonnes} tonnes chargeable)</td><td class=r>${totals.docs}</td><td class=r>${totals.pieces}</td><td class=r>${oneDecimal(totals.grossWeight)}</td><td class=r>${oneDecimal(totals.chargeableWeight)}</td><td class=r>100%</td></tr>`;
  printHtml(`<!doctype html><html><head><title>Tonnage Report</title><style>${PRINT_CSS}</style></head><body><h3 style="margin:0">Air Export Tonnage Report - by ${groupName}</h3><div style="margin:4px 0 8px">${period}</div><table><thead>${head}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></body></html>`);
}
