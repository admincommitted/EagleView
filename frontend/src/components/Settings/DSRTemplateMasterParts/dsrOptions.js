export const SMALL_LABEL = 'tw:text-[10px] tw:font-bold tw:uppercase tw:text-slate-600 tw:whitespace-normal';

export const SCHEDULE_OPTIONS = [
  { value: 'MANUAL', label: 'Manual Dispatch Only' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const GROUP_BY_OPTIONS = [
  { value: 'Job.customsPort', label: 'Group by Customs Port' },
  { value: 'Job.shipmentMode', label: 'Group by Mode (Air / Sea)' },
  { value: 'Job.status', label: 'Group by Job Status' },
  { value: 'Invoice.currency', label: 'Group by Currency' },
];

export const COLOR_RULE_STATUSES = [
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'QUERY', label: 'QUERY / CUSTOMS HOLD' },
  { value: 'OOC', label: 'OOC / CLEARED' },
  { value: 'LEO GENERATED', label: 'LEO GENERATED' },
];

// saved as the Excel row fill colour
export const ROW_COLORS = [
  { value: '#ffffff', label: 'White (Default)' },
  { value: '#fecaca', label: 'Red (Critical/Hold)' },
  { value: '#fef08a', label: 'Yellow (Pending)' },
  { value: '#bbf7d0', label: 'Green (Cleared/Done)' },
  { value: '#bfdbfe', label: 'Blue (Processing)' },
];

// onByDefault: an older template without the flag counts as ticked
export const FORMAT_FLAGS = [
  { key: 'formatExcel', label: 'Excel (.xlsx)', onByDefault: true },
  { key: 'formatPdf', label: 'PDF Report' },
  { key: 'formatHtml', label: 'Email Body Table' },
  { key: 'formatLink', label: '🔗 Live Web Portal Link', className: 'tw:font-semibold tw:text-green-600' },
];

export const CHART_FLAGS = [
  { key: 'chartTat', label: '📊 Clearance TAT (Bar Chart)' },
  { key: 'chartStatus', label: '🥧 Pipeline Status (Pie Chart)' },
  { key: 'chartVolume', label: '🍩 Volume by Port (Doughnut)' },
];

export const RECIPIENT_FIELDS = [
  { key: 'emailRecipients', label: '📧 Email Recipients (Comma separated)', placeholder: 'e.g. client1@example.com, client2@example.com' },
  {
    key: 'whatsappRecipients', label: '📱 WhatsApp Numbers (Comma separated)', placeholder: 'e.g. +919876543210, +919998887776',
    labelClassName: 'tw:text-green-600', inputClassName: 'tw:border-green-300 tw:bg-green-50',
  },
  {
    key: 'sftpHost', label: '📂 SFTP / FTP Auto-Push (Corporate)', placeholder: 'e.g. sftp://client-erp.com/upload',
    labelClassName: 'tw:text-amber-600', inputClassName: 'tw:border-amber-300 tw:bg-amber-50',
  },
];

export const partyOptions = (data) => {
  const parties = Array.isArray(data) ? data : data.data || [];
  return parties.map((party) => ({
    title: party.name,
    subtitle: [party.street, party.city, party.stateProvince, party.countryCode].filter(Boolean).join(', ') + (party.email ? ` | Email: ${party.email}` : ''),
    searchKey: party.name,
    original: party,
  }));
};
