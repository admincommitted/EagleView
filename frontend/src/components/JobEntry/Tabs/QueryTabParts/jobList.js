import { toDisplayDate } from '@/lib/dates';

export const LIST_LIMIT = 100;

export const MODE_OPTIONS = [
  { value: 'ALL', label: 'ALL' },
  { value: 'AIR', label: 'AIR' },
  { value: 'SEA', label: 'SEA' },
  { value: 'LAND', label: 'LAND' },
];

export const BE_TYPE_OPTIONS = [
  { value: 'ALL', label: 'ALL BE' },
  { value: 'H', label: 'HOME (H)' },
  { value: 'W', label: 'IN-BOND (W)' },
  { value: 'X', label: 'EX-BOND (X)' },
];

export const SEARCH_FIELD_OPTIONS = [
  { value: 'ALL', label: 'ALL FIELDS' },
  { value: 'JOB_NO', label: 'JOB NO' },
  { value: 'BE_NO', label: 'BE NO' },
  { value: 'IMPORTER', label: 'IMPORTER' },
  { value: 'SUB_AGENT', label: 'SUB AGENT' },
  { value: 'INVOICE', label: 'INVOICE' },
  { value: 'MAWB_MBL', label: 'MAWB/MBL' },
  { value: 'HAWB_HBL', label: 'HAWB/HBL' },
];


export const NO_FILTERS = { searchTerm: '', searchType: 'ALL', fromDate: '', toDate: '', status: 'All', mode: 'ALL', beType: 'ALL' };

export const UNREGISTERED_DOCKET = 'UN-REGISTERED';

const isChosen = (value, allValue) => value && value !== allValue;

export function serverFilters(filters) {
  const term = filters.searchTerm.trim();
  return {
    limit: LIST_LIMIT,
    ...(filters.fromDate && { from: filters.fromDate.slice(0, 10) }),
    ...(filters.toDate && { to: filters.toDate.slice(0, 10) }),
    ...(isChosen(filters.mode, 'ALL') && { mode: filters.mode }),
    ...(isChosen(filters.beType, 'ALL') && { beType: filters.beType }),
    ...(isChosen(filters.status, 'All') && { status: filters.status }),
    ...(term && { q: term, field: filters.searchType }),
  };
}

export const toListRow = (job) => ({
  ...job,
  docketNo: job.docketNo || UNREGISTERED_DOCKET,
  jobDate: toDisplayDate(job.jobDate || job.createdAt),
  jobDateRaw: job.jobDate || job.createdAt,
  importer: job.importer || job.importerName || job.nameOfImporter || job.autoField_4 || '',
  supplier: job.supplier || job.supplierName || '',
  beNo: job.beNo || '',
  beDate: toDisplayDate(job.beDate),
  invDt: toDisplayDate(job.invDt),
  enteredDate: new Date(job.createdAt).toLocaleString(),
  enteredBy: job.createdBy || job.updatedBy || '',
  origin: job.origin || '',
  destination: job.destination || job.portCode || job.autoField_2 || '',
});

export const jobState = (job) => ({
  isLocked: job.status === 'LOCKED' || Boolean(job.isLocked),
  isVoid: job.status === 'VOID' || job.status === 'CANCELLED' || Boolean(job.isVoid),
  hasBe: Boolean(job.beNo.trim()) && job.beNo !== 'N/A',
});

export const finalDocUrl = (job, docType) => job.finalDocs?.find((doc) => doc.docType === docType)?.fileUrl;
