import { stageLabel } from '../AirExportParts/airExport';

export const EMPTY_FILTERS = {
  awbType: 'ALL', awbNature: 'BOTH', routing: 'ALL', fromDate: '', toDate: '', dateBasis: 'AWB', shipper: '', airline: '',
  awbNo: '', flightNo: '', hawbNo: '', consignee: '', origin: '', destination: '', stage: 'ALL',
};

const TEXT_CRITERIA = ['fromDate', 'toDate', 'shipper', 'airline', 'awbNo', 'flightNo', 'hawbNo', 'consignee', 'origin', 'destination'];

// A type / nature / routing / status choice is a criteria on its own (e.g. all MAWBs with routing pending).
export const hasCriteria = (filters) =>
  filters.awbType !== 'ALL' || filters.awbNature !== 'BOTH' || filters.routing !== 'ALL' || filters.stage !== 'ALL'
  || TEXT_CRITERIA.some((key) => String(filters[key] || '').trim());

const STORE_KEY = 'awbSearch.last.v1';

export const readLastSearch = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  } catch {
    return null;
  }
};

export const writeLastSearch = (search) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(search));
  } catch {
    // private window: the search is just not remembered
  }
};

export const TYPE_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'NORMAL', label: 'DIRECT AWB' },
  { value: 'MASTER', label: 'MASTER (MAWB)' },
  { value: 'HOUSE', label: 'HOUSE (HAWB)' },
];

export const NATURE_OPTIONS = [
  { value: 'BOTH', label: 'BOTH' },
  { value: 'PREPAID', label: 'PREPAID' },
  { value: 'COLLECT', label: 'COLLECT' },
];

export const ROUTING_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'FINISHED', label: 'FINISHED', title: 'Flight number and date filled in' },
  { value: 'PENDING', label: 'PENDING', title: 'Flight not given yet' },
];

export const DATE_BASIS_OPTIONS = [
  { value: 'AWB', label: 'AWB DATE' },
  { value: 'FLIGHT', label: 'FLIGHT DATE' },
];

export const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'SAVED', label: 'SAVED, NOT SUBMITTED' },
  { value: 'SUBMITTED', label: 'SUBMITTED, PENDING RCS' },
  { value: 'REJECTED', label: 'REJECTED (FNA)' },
  { value: 'READY_FOR_CARRIAGE', label: 'READY (RCS)' },
  { value: 'DEPARTED', label: 'DEPARTED' },
  { value: 'DELIVERED', label: 'DELIVERED' },
];

export const PAGE_SIZES = [25, 50, 100, 250];

export const awbRowKey = (row) => `${row.type}:${row.id}`;
export const numberOf = (row) => (row.type === 'HAWB' ? row.hawbNo : row.awbNo);

export const totalsOf = (rows) => rows.reduce((sum, row) => ({
  pkgs: sum.pkgs + (parseInt(row.pkgs, 10) || 0),
  gr: sum.gr + (parseFloat(row.grWt) || 0),
  chg: sum.chg + (parseFloat(row.chgWt) || 0),
}), { pkgs: 0, gr: 0, chg: 0 });

const NUMERIC_KEYS = ['pkgs', 'grWt', 'chgWt', 'totalFreight'];
export const sortsDescendingFirst = (key) => NUMERIC_KEYS.includes(key) || key === 'createdAt';

const sortValue = (row, key) => {
  if (key === 'createdAt') return new Date(row.createdAt).getTime() || 0;
  if (NUMERIC_KEYS.includes(key)) return parseFloat(row[key]) || 0;
  return String(row[key] ?? '').toUpperCase();
};

export const sortRows = (rows, { key, dir }) => {
  const direction = dir === 'asc' ? 1 : -1;
  return [...rows].sort((first, second) => {
    const a = sortValue(first, key);
    const b = sortValue(second, key);
    return (a > b ? 1 : a < b ? -1 : 0) * direction;
  });
};

const stageColumn = ['stage', 'Status', (row) => stageLabel(row.stage, { short: true })];

export const EXCEL_COLUMNS = [
  ['type', 'Type'], stageColumn, ['flight', 'Flight'], ['flightDate', 'Flight Date', (row) => String(row.flightDate || '').slice(0, 10)],
  ['awbDate', 'AWB Dt.'], ['awbNo', 'AWB No'], ['hawbNo', 'HAWB No'], ['shipper', 'Shipper'], ['consignee', 'Consignee'],
  ['origin', 'Origin'], ['dstn', 'Dstn'], ['pc', 'P/C'], ['pkgs', 'Pkgs'], ['grWt', 'Gr.Wt'], ['chgWt', 'Chg.Wt'],
  ['totalFreight', 'Freight'], ['currency', 'Cur'], ['subagt', 'Sub Agt'], ['tieup', 'Tie-up'], ['routingStatus', 'Routing'],
  ['cargoType', 'Cargo'], ['remarks', 'Remarks'],
];

export const PRINT_COLUMNS = [
  ['type', 'Type'], stageColumn, ['flight', 'Flight'], ['awbDate', 'AWB Dt.'], ['awbNo', 'AWB No'], ['hawbNo', 'HAWB No'],
  ['shipper', 'Shipper'], ['consignee', 'Consignee'], ['dstn', 'Dstn'], ['pc', 'P/C'], ['pkgs', 'Pkgs'], ['grWt', 'Gr.Wt'],
  ['chgWt', 'Chg.Wt'], ['totalFreight', 'Freight', (row) => `${row.totalFreight} ${row.currency || ''}`], ['subagt', 'Sub Agt'],
  ['routingStatus', 'Routing'],
];
