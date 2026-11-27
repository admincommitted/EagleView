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

// one status per job for the Job No icon and the legend: locked > void > BE No received
export function jobStatusOf(job) {
  const { isLocked, isVoid, hasBe } = jobState(job);
  if (isLocked) return 'locked';
  if (isVoid) return 'void';
  return hasBe ? 'received' : 'open';
}

export const STATUS_TITLES = { locked: 'Locked job', void: 'Void job', received: 'BE No received' };

// BE type of a listed job (the list sends boeType HOME_CONSUMPTION / WAREHOUSE / EX_BOND) and its light row colour
const BE_TYPE_CODES = { HOME_CONSUMPTION: 'H', WAREHOUSE: 'W', EX_BOND: 'X' };
export const beTypeOf = (job) => BE_TYPE_CODES[String(job.boeType || '').toUpperCase()] || String(job.autoField_51 || 'H').charAt(0).toUpperCase();

// a tinted row plus a thick coloured edge on its first cell, so the type reads at a glance (class names written in
// full: Tailwind finds only whole names in the code)
export const BE_TYPE_LOOKS = [
  { value: 'H', label: 'Home (H)', title: 'Home consumption Bill of Entry', rowClassName: '', swatchClassName: 'tw:bg-background' },
  {
    value: 'W', label: 'In-Bond / Warehouse (W)', title: 'Warehouse (in-bond) Bill of Entry',
    rowClassName: 'tw:bg-sky-200 tw:even:bg-sky-200 tw:hover:bg-sky-300 tw:dark:bg-sky-900/70 tw:dark:even:bg-sky-900/70 tw:dark:hover:bg-sky-800 tw:[&>td:first-child]:border-l-4 tw:[&>td:first-child]:border-l-sky-600',
    swatchClassName: 'tw:bg-sky-200 tw:border-sky-600',
  },
  {
    value: 'X', label: 'Ex-Bond (X)', title: 'Ex-bond Bill of Entry (cleared from a warehouse)',
    rowClassName: 'tw:bg-violet-200 tw:even:bg-violet-200 tw:hover:bg-violet-300 tw:dark:bg-violet-900/70 tw:dark:even:bg-violet-900/70 tw:dark:hover:bg-violet-800 tw:[&>td:first-child]:border-l-4 tw:[&>td:first-child]:border-l-violet-600',
    swatchClassName: 'tw:bg-violet-200 tw:border-violet-600',
  },
];

export const finalDocUrl = (job, docType) => job.finalDocs?.find((doc) => doc.docType === docType)?.fileUrl;
