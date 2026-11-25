import { oneDecimal, twoDecimals } from '../AirExportParts/airExport';
import { escapeHtml, printHtml } from '../AirExportParts/printHtml';

export const CSR_COLUMNS = [
  { key: 'date', header: 'Date', text: true },
  { key: 'awbNumber', header: 'AWB No', text: true },
  { key: 'destination', header: 'Dest', text: true },
  { key: 'ppcc', header: 'P/C', text: true },
  { key: 'pieces', header: 'Pcs' },
  { key: 'chargeableWeight', header: 'Chg Wt' },
  { key: 'rate', header: 'Rate', money: true },
  { key: 'weightPP', header: 'Wt Chg PP', money: true },
  { key: 'weightCC', header: 'Wt Chg CC', money: true },
  { key: 'valuationPP', header: 'Val PP', money: true },
  { key: 'taxPP', header: 'Tax PP', money: true },
  { key: 'dueCarrierPP', header: 'Due Carr PP', money: true },
  { key: 'dueCarrierCC', header: 'Due Carr CC', money: true },
  { key: 'dueAgentPP', header: 'Due Agt PP', money: true },
  { key: 'dueAgentCC', header: 'Due Agt CC', money: true },
  { key: 'commission', header: 'Commission', money: true },
  { key: 'payable', header: 'Payable', money: true },
  { key: 'receivable', header: 'Receivable', money: true },
  { key: 'net', header: 'Net to Airline', money: true },
];

export const TOTAL_MONEY_KEYS = ['weightPP', 'weightCC', 'valuationPP', 'taxPP', 'dueCarrierPP', 'dueCarrierCC', 'dueAgentPP', 'dueAgentCC'];

export const itemValue = (item, key) => (key === 'commission' ? (item.commissionPP || 0) + (item.commissionCC || 0) : item[key]);

export const commissionOf = (summary) => summary.commissionPP + summary.commissionCC;

export const owesAirline = (summary) => summary.net >= 0;

export const statementKey = (summary) => summary.agentKey + summary.airlinePrefix + summary.currency;

// One statement per IATA agent code + airline + currency.
export const statementsOf = (report) => report.airlineSummary.map((summary) => ({
  ...summary,
  items: report.items.filter((item) => item.agentKey === summary.agentKey && item.airlinePrefix === summary.airlinePrefix && item.currency === summary.currency),
}));

export const CSR_EXCEL_COLUMNS = [
  ['agent', 'IATA Agent'], ['agentCode', 'IATA Code'], ['airline', 'Airline'], ['airlinePrefix', 'Prefix'], ['currency', 'Cur'],
  ...CSR_COLUMNS.map((column) => [column.key, column.header, (item) => itemValue(item, column.key)]),
  ['shipper', 'Shipper'], ['flight', 'Flight'], ['commRate', 'Comm %'],
];

const PRINT_CSS = 'body{font-family:Arial,sans-serif;font-size:9px;margin:10px}h2{margin:0}h3{margin:14px 0 4px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:2px 4px}th{background:#eee}.r{text-align:right}tfoot td{font-weight:bold;background:#f5f5f5}.net{margin-top:4px;font-size:11px}@page{size:landscape;margin:8mm}';

function statementHtml(statement) {
  const commissionNote = statement.commType === 'NET' ? 'NET - none' : `${statement.commRate}% of weight charge`;
  const head = CSR_COLUMNS.map((column) => `<th>${column.header}</th>`).join('');
  const body = statement.items
    .map((item) => `<tr>${CSR_COLUMNS.map((column) => `<td class="${column.money ? 'r' : ''}">${escapeHtml(column.money ? twoDecimals(itemValue(item, column.key)) : item[column.key])}</td>`).join('')}</tr>`)
    .join('');
  const moneyTotals = TOTAL_MONEY_KEYS.map((key) => `<td class=r>${twoDecimals(statement[key])}</td>`).join('');
  const foot = `<tr><td colspan=4>TOTAL ${statement.awbs} AWB</td><td>${statement.pieces}</td><td>${oneDecimal(statement.chargeableWeight)}</td><td></td>${moneyTotals}<td class=r>${twoDecimals(commissionOf(statement))}</td><td class=r>${twoDecimals(statement.payable)}</td><td class=r>${twoDecimals(statement.receivable)}</td><td class=r><b>${twoDecimals(statement.net)}</b></td></tr>`;
  const netLine = `${owesAirline(statement) ? 'Payable to airline' : 'Receivable from airline'}: <b>${escapeHtml(statement.currency)} ${twoDecimals(Math.abs(statement.net))}</b>`;
  return `<h3>${escapeHtml(statement.agent)} · ${escapeHtml(statement.airlinePrefix)} ${escapeHtml(statement.airline)} - ${escapeHtml(statement.currency)} <small>(commission ${commissionNote})</small></h3>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>
      <tfoot>${foot}</tfoot></table>
      <div class=net>${netLine}</div>`;
}

export function printCsr(report, statements) {
  const sections = statements.map(statementHtml).join('');
  const heading = `Period ${escapeHtml(report.label)} (${escapeHtml(report.from)} to ${escapeHtml(report.to)}) · Airline ${escapeHtml(report.airline)} · Agent ${escapeHtml(report.agent || 'ALL')} · printed ${escapeHtml(new Date().toLocaleString())}`;
  printHtml(`<!doctype html><html><head><title>CSR ${escapeHtml(report.label)}</title><style>${PRINT_CSS}</style></head><body><h2>Cargo Sales Report (CSR)</h2><div>${heading}</div>${sections || '<p>No AWB in this period.</p>'}<p style="margin-top:12px;color:#555">Figures are from the AWBs saved in the system. Check against the airline / CASS billing before payment.</p></body></html>`);
}
