import { MILESTONES, stageLabel } from '../AirExportParts/airExport';

export const EMPTY_TRACK_FILTERS = {
  documentType: 'ALL', airline: '', awbNumber: '', shipper: '', status: 'ALL', origin: '', destination: '', dateType: 'ALL', fromDate: '', toDate: '',
};

export const REFRESH_EVERY_MS = 15000;
export const PAGE_SIZES = [10, 20, 50, 100];

export const DOCUMENT_TYPE_OPTIONS = ['ALL', 'AIR WAYBILL', 'MASTER', 'HOUSE'];

export const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'PENDING', label: 'PENDING (NOT DELIVERED)' },
  { value: 'FINISHED', label: 'FINISHED (DELIVERED)' },
  { value: 'SAVED', label: 'SAVED, NOT SUBMITTED' },
  { value: 'SUBMITTED', label: 'SUBMITTED, PENDING RCS' },
  { value: 'REJECTED', label: 'REJECTED (FNA)' },
  { value: 'READY_FOR_CARRIAGE', label: 'READY FOR CARRIAGE (RCS)' },
  { value: 'DEPARTED', label: 'DEPARTED' },
];

export const DATE_TYPE_OPTIONS = ['ALL', 'DEPARTURE', 'ARRIVAL'];

const excelDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const TRACK_EXCEL_COLUMNS = [
  ['documentType', 'Document'], ['awbNumber', 'AWB / MAWB'], ['hawbNumber', 'HAWB'], ['stage', 'Status', (row) => stageLabel(row.stage)],
  ['shipperName', 'Shipper'], ['consigneeName', 'Consignee'], ['origin', 'Origin'], ['destination', 'Destination'], ['flight', 'Flight'],
  ...MILESTONES.map((milestone) => [milestone, milestone.toUpperCase(), (row) => excelDateTime(row[milestone])]),
  ['totalPieces', 'Pieces'], ['grossWeight', 'Gross Wt'],
];

// The airline master keeps a tracking URL with {awb} {prefix} {serial} {awbdash} placeholders.
export function airlineTrackingLink(row, airlines) {
  const digits = String(row.awbNumber || '').replace(/\D/g, '');
  const prefix = digits.slice(0, 3);
  const airline = airlines.find((entry) => String(entry.prefix || '') === prefix);
  if (!airline?.trackingUrl || digits.length !== 11) return null;
  return String(airline.trackingUrl)
    .replace(/\{awb\}/gi, digits)
    .replace(/\{prefix\}/gi, prefix)
    .replace(/\{serial\}/gi, digits.slice(3))
    .replace(/\{awbdash\}/gi, `${prefix}-${digits.slice(3)}`);
}

export const historyTarget = (row) => ({ awbNumber: row.awbNumber, hawbNumber: row.documentType === 'HOUSE' ? row.hawbNumber : null, row });
