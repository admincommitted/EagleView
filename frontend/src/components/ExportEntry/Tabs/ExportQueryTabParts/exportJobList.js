import { toDisplayDate } from '@/lib/dates';

export const AFTER_LEO = ['LEO', 'GATE_PASS', 'DEPARTED', 'DELIVERED'];

export const STAGE_TEXT = {
  DRAFT: 'DRAFT', SUBMITTED: 'SB FILED', TD_DONE: 'TD DONE', XRAY_DONE: 'X-RAY DONE', LEO: 'LEO', GATE_PASS: 'GATE PASS',
  DEPARTED: 'DEPARTED', DELIVERED: 'DELIVERED', CANCELLED: 'VOID',
};

export const UNREGISTERED_DOCKET = 'UN-REGISTERED';

export const MODE_OPTIONS = ['ALL', 'AIR', 'SEA', 'LAND'];

export const SEARCH_FIELD_OPTIONS = [
  { value: 'ALL', label: 'ALL FIELDS' },
  { value: 'JOB_NO', label: 'JOB NO' },
  { value: 'SB_NO', label: 'SB NO' },
  { value: 'EXPORTER', label: 'EXPORTER' },
  { value: 'CONSIGNEE', label: 'CONSIGNEE' },
  { value: 'SUB_AGENT', label: 'SUB AGENT' },
  { value: 'INVOICE', label: 'INVOICE' },
  { value: 'MAWB', label: 'MAWB/MBL' },
  { value: 'HAWB', label: 'HAWB/HBL' },
];

export const STATUS_OPTIONS = [
  { value: 'All', label: 'ALL JOBS' },
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'SUBMITTED', label: 'SB FILED' },
  { value: 'TD_DONE', label: 'TD DONE' },
  { value: 'XRAY_DONE', label: 'X-RAY DONE' },
  { value: 'LEO', label: 'LEO / CLEARED' },
  { value: 'CANCELLED', label: 'VOID' },
];

export const NO_FILTERS = { searchTerm: '', searchType: 'ALL', fromDate: '', toDate: '', status: 'All', mode: 'ALL' };

// the SB Header keeps MAWB / HAWB in autoField_22 / autoField_24
const SEARCH_KEYS = {
  JOB_NO: ['jobNo'], SB_NO: ['sbNo', 'sbNumber'], EXPORTER: ['exporter', 'shipperName'], CONSIGNEE: ['consignee', 'consigneeName'],
  SUB_AGENT: ['subAgentName'], INVOICE: ['invNo'], MAWB: ['mawbNo', 'autoField_22', 'AirWayBillNo'], HAWB: ['hawbNo', 'autoField_24'],
};
const TYPE_AHEAD_KEYS = ['jobNo', 'sbNo', 'autoField_24', 'subAgentName', 'autoField_22', 'exporter', 'consignee'];
const ALL_FIELDS_KEYS = [...TYPE_AHEAD_KEYS, 'invNo'];

const twoDigits = (number) => String(number).padStart(2, '0');

function isoDay(value) {
  if (!value) return '';
  const text = String(value).trim();
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

export const toListRow = (job) => ({
  ...job,
  docketNo: job.docketNo || UNREGISTERED_DOCKET,
  jobDateIso: isoDay(job.jobDate || job.createdAt),
  jobDate: toDisplayDate(job.jobDate || job.createdAt),
  enteredAt: job.createdAt,
  exporter: job.exporter || job.shipperName,
  consignee: job.consignee || job.consigneeName,
  origin: job.origin || job.customsPort || job.customsPortCode,
  destination: job.destination || job.destPortCode || job.destCountryCode || job.destCountry || job.DestinationCountry || '',
  stage: job.stage || 'DRAFT',
});

export const sbNoOf = (job) => job.sbNo || job.sbNumber || '';

export const jobState = (job) => ({
  isLocked: AFTER_LEO.includes(job.stage),
  isVoid: job.stage === 'CANCELLED',
  hasSb: Boolean(sbNoOf(job)),
  isFiled: Boolean(sbNoOf(job) || job.icegateStatus),
});

export const finalDocUrl = (job, docType) => job.finalDocs?.find((doc) => doc.docType === docType)?.fileUrl;

const hasText = (value, term) => Boolean(value) && String(value).toLowerCase().includes(term);

export const matchesTypeAhead = (job, searchTerm) => TYPE_AHEAD_KEYS.some((key) => hasText(job[key], searchTerm.toLowerCase()));

const matchesSearch = (job, searchTerm, searchType) => {
  if (!searchTerm) return true;
  const term = searchTerm.toLowerCase();
  const keys = searchType === 'ALL' ? ALL_FIELDS_KEYS : SEARCH_KEYS[searchType] || [];
  return keys.some((key) => hasText(job[key], term));
};

const modeOf = (job) => {
  const mode = String(job.shipmentMode || '').toUpperCase();
  if (mode.startsWith('S')) return 'SEA';
  return mode.startsWith('L') ? 'LAND' : 'AIR';
};

const matchesStatus = (job, status) => {
  if (status === 'LEO') return AFTER_LEO.includes(job.stage);
  return status === 'All' || job.stage === status;
};

export const filterJobs = (jobs, filters) => jobs.filter((job) =>
  !(filters.fromDate && job.jobDateIso < filters.fromDate)
  && !(filters.toDate && job.jobDateIso > filters.toDate)
  && (filters.mode === 'ALL' || modeOf(job) === filters.mode)
  && matchesStatus(job, filters.status)
  && matchesSearch(job, filters.searchTerm, filters.searchType));

// first SB number / date found anywhere in an ICEGATE acknowledgement
export function findSb(answer) {
  let sbNo = '';
  let sbDate = '';
  const walk = (node) => {
    if (!node || typeof node !== 'object' || (sbNo && sbDate)) return;
    for (const [key, value] of Object.entries(node)) {
      const plainKey = key.toLowerCase().replace(/[^a-z]/g, '');
      if (value && typeof value === 'object') walk(value);
      else if (!sbNo && /^(sbno|sbnumber|shippingbillno|shippingbillnumber)$/.test(plainKey) && /^\d{5,10}$/.test(String(value).trim())) sbNo = String(value).trim();
      else if (!sbDate && /^(sbdate|shippingbilldate)$/.test(plainKey) && value) sbDate = String(value).trim();
    }
  };
  walk(answer);
  return { sbNo, sbDate };
}
