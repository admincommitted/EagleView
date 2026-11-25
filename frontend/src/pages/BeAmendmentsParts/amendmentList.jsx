import { dmy, MODE_LABEL } from '@/components/BeAmendment/beAmendApi';
import StatusChip from '@/components/BeAmendment/StatusChip';

export const LIST_TABS = [
  { value: 'open', label: 'Not sent' },
  { value: 'submitted', label: 'Sent' },
  { value: 'all', label: 'All' },
  { value: 'void', label: 'Void' },
];

export function tabCount(tab, counts) {
  const count = (status) => counts[status] || 0;
  if (tab === 'open') return count('Draft') + count('Ready');
  if (tab === 'submitted') return count('Submitted') + count('Accepted') + count('Rejected');
  if (tab === 'void') return count('Void');
  return Object.entries(counts).filter(([status]) => status !== 'Void').reduce((total, [, value]) => total + value, 0);
}

const TRANSFER_SHORT = { MAIL: 'mail', DOWNLOAD: 'signed', DOWNLOAD_UNSIGNED: 'unsigned' };

const sentText = (row) => {
  if (!row.submittedAt) return '';
  return `${dmy(String(row.submittedAt).slice(0, 10))} · ${MODE_LABEL[row.transferMode] ? TRANSFER_SHORT[row.transferMode] : ''}`;
};

const clipped = (text, widthClass) => <span title={text} className={`tw:block tw:truncate ${widthClass}`}>{text}</span>;

const ALL_COLUMNS = [
  { key: 'amendNo', header: 'Amend No', className: 'tw:font-bold' },
  { key: 'amendDate', header: 'Date', cell: (row) => dmy(row.amendDate) },
  { key: 'beNo', header: 'BE No / Date', cell: (row) => <>{row.beNo} <span className="tw:text-muted-foreground">{dmy(row.beDate)}</span></> },
  { key: 'parentJobNo', header: 'BE Job' },
  { key: 'importer', header: 'Importer', wide: true, cell: (row) => clipped(row.importer, 'tw:max-w-[220px]') },
  { key: 'codes', header: 'Codes', cell: (row) => (row.codes || []).join(', ') || '-' },
  { key: 'reason', header: 'Reason', wide: true, cell: (row) => clipped(row.reason, 'tw:max-w-[200px]') },
  { key: 'status', header: 'Status', cell: (row) => <StatusChip status={row.status} /> },
  { key: 'sent', header: 'Sent', wide: true, className: 'tw:text-muted-foreground', cell: sentText },
];

// with an amendment open beside the list, the wide columns are left out
export const listColumns = (compact) => ALL_COLUMNS.filter((column) => !(compact && column.wide));

export function emptyListText(loading, tab) {
  if (loading) return 'Loading…';
  if (tab === 'open') return 'Nothing waiting. A new amendment is made from the BE job: Job Entry > open the job > BE Amendment.';
  return 'No amendment here.';
}
