import { useNavigate } from 'react-router-dom';

export const STAGES = {
  SAVED: { label: 'Saved', className: 'tw:text-muted-foreground' },
  SUBMITTED: { label: 'Submitted', className: 'tw:text-primary' },
  REJECTED: { label: 'Rejected', className: 'tw:text-destructive' },
  READY_FOR_CARRIAGE: { label: 'Ready for carriage', short: 'Ready (RCS)', className: 'tw:text-success' },
  DEPARTED: { label: 'Departed', className: 'tw:text-head' },
  DELIVERED: { label: 'Delivered', className: 'tw:text-success' },
};

export const stageLabel = (stage, { short = false } = {}) => {
  const known = STAGES[stage];
  if (!known) return stage;
  return short && known.short ? known.short : known.label;
};

export const MILESTONES = ['fna', 'fma', 'foh', 'rcs', 'dep', 'arr', 'tfd', 'rcf', 'nfd', 'dlv'];

const EDIT_PAGES = { HAWB: '/freight/create-hawb', HOUSE: '/freight/create-hawb', MAWB: '/freight/create-mawb', MASTER: '/freight/create-mawb' };

export function useOpenAwb() {
  const navigate = useNavigate();
  return (type, loadAwbNumber, extraState) => {
    const page = EDIT_PAGES[String(type || '').toUpperCase()] || '/freight/create-awb';
    navigate(page, { state: { loadAwbNumber, ...extraState } });
  };
}

export const shortDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const oneDecimal = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
export const twoDecimals = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const pageSlice = (rows, page, pageSize) => rows.slice((page - 1) * pageSize, page * pageSize);
export const pageCountOf = (rowCount, pageSize) => Math.max(1, Math.ceil(rowCount / pageSize));

export const showingText = (page, pageSize, total) =>
  total ? `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, total)} of ${total} entries` : 'Showing 0 entries';