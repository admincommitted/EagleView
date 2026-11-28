import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Download, FileText, IndianRupee, Mail, PieChart, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, DataTable, Input, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { SummaryCard } from './LedgerReportParts/ReportLayout';
import { formatAmount, todayIso } from './LedgerReportParts/format';
import { assertSuccess, emptyOnFailure, exportSheet } from './LedgerReportParts/reportData';

const NO_BUCKETS = { notDue: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

const REPORT_TYPES = {
  receivable: { title: 'Accounts Receivable (A/R)', sheet: 'Receivable', icon: 'tw:bg-success', text: 'tw:text-success' },
  payable: { title: 'Accounts Payable (A/P)', sheet: 'Payable', icon: 'tw:bg-warning', text: 'tw:text-warning' },
};

const BUCKET_CARDS = [
  { key: 'notDue', label: 'Not Due Yet', tone: 'success' },
  { key: 'days30', label: '0 - 30 Days', tone: 'caution' },
  { key: 'days60', label: '31 - 60 Days', tone: 'warning' },
  { key: 'over90', label: '> 90 Days (Critical)', tone: 'danger' },
];

const amountText = (amount) => amount.toLocaleString();

const ageingBucket = (overdueDays) => {
  if (overdueDays <= 0) return 'Not due';
  if (overdueDays <= 30) return '1-30';
  if (overdueDays <= 60) return '31-60';
  return overdueDays <= 90 ? '61-90' : 'Over 90';
};

const htmlTag = (tag, content, attributes = '') => `<${tag}${attributes}>${content}</${tag}>`;

function reminderHtml(bill) {
  const rupees = (amount) => `₹ ${formatAmount(amount)}`;
  const header = ['Reference', 'Date', 'Due date', 'Amount', 'Pending'].map((heading) => htmlTag('th', heading)).join('');
  const values = [bill.refNo, bill.date || '-', bill.dueDate || '-', rupees(bill.amount), rupees(bill.pending)].map((value) => htmlTag('td', value)).join('');
  return `<p>Dear ${bill.party},</p><p>Our records show the following amount outstanding:</p>`
    + htmlTag('table', htmlTag('tr', header) + htmlTag('tr', values), ' border="1" cellpadding="6" cellspacing="0"')
    + `<p>${bill.overdueDays > 0 ? `It is overdue by ${bill.overdueDays} day(s).` : ''} Please arrange payment.</p>`;
}

async function sendReminder(bill) {
  const toastId = toast.loading('Sending reminder...');
  try {
    const ledger = await emptyOnFailure(accountsApi.ledgerReportLedger(bill.ledgerId));
    const to = ledger.email || ledger.data?.email || '';
    if (!to) {
      toast.error(`No e-mail on the ledger "${bill.party}" - add one in Masters > Ledgers`, { id: toastId });
      return;
    }
    assertSuccess(await accountsApi.ledgerReportSendEmail({ to, subject: `Payment reminder - ${bill.refNo}`, html: reminderHtml(bill) }));
    toast.success(`Reminder e-mailed to ${to}`, { id: toastId });
  } catch (error) {
    toast.error(`Could not send: ${errorMessage(error)}`, { id: toastId });
  }
}

function AgeingBadge({ overdueDays }) {
  if (overdueDays <= 0) return <Badge variant="success"><CheckCircle /> Not Due</Badge>;
  return <Badge variant={overdueDays > 90 ? 'danger' : 'warning'}><AlertTriangle /> Overdue by {overdueDays} days</Badge>;
}

const billColumns = ({ reportType, openInvoice }) => [
  { key: 'party', header: 'Party Name', className: 'tw:font-bold tw:text-foreground' },
  {
    key: 'refNo',
    header: 'Bill Ref No.',
    cell: (bill) => (
      <>
        <div>{bill.refNo}</div>
        {bill.gst && bill.voucherId && (
          <Button size="sm" variant="secondary" className="tw:mt-1" title={`Open GST invoice ${bill.gst.invoiceNo}`} onClick={() => openInvoice(bill)}>
            <FileText className="tw:size-3" /> Invoice{bill.gst.irn ? ' · IRN' : ''}
          </Button>
        )}
      </>
    ),
  },
  {
    key: 'date',
    header: 'Date & Due Date',
    cell: (bill) => (
      <>
        <div>{bill.date}</div>
        <div className="tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">Due: {bill.dueDate}</div>
      </>
    ),
  },
  { key: 'amount', header: 'Bill Amount (₹)', align: 'right', cell: (bill) => amountText(bill.amount) },
  { key: 'pending', header: 'Pending (₹)', align: 'right', className: cn('tw:font-bold', REPORT_TYPES[reportType].text), cell: (bill) => amountText(bill.pending) },
  { key: 'ageing', header: 'Ageing (Status)', align: 'center', cell: (bill) => <AgeingBadge overdueDays={bill.overdueDays} /> },
  {
    key: 'actions',
    header: 'Actions',
    align: 'center',
    cell: (bill) => reportType === 'receivable' && bill.overdueDays > 0 && (
      <Button size="sm" variant="success" onClick={() => sendReminder(bill)}><Mail className="tw:size-3" /> Send Reminder</Button>
    ),
  },
];

export default function OutstandingReports() {
  const navigate = useNavigate();
  const [reportType, setReportType] = useState('receivable');
  const [loading, setLoading] = useState(false);
  const [bills, setBills] = useState([]);
  const [buckets, setBuckets] = useState(NO_BUCKETS);
  const [basis, setBasis] = useState('');
  const today = todayIso();

  useEffect(() => {
    const loadOutstanding = async () => {
      setLoading(true);
      try {
        const body = assertSuccess(await accountsApi.controlOutstanding(reportType, todayIso()));
        setBills(Array.isArray(body.data) ? body.data : []);
        setBuckets(body.buckets || NO_BUCKETS);
        setBasis(body.note || body.basis || '');
      } catch (error) {
        setBills([]);
        setBuckets(NO_BUCKETS);
        toast.error(`Could not load outstanding: ${errorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    };
    loadOutstanding();
  }, [reportType]);

  const exportExcel = async () => {
    if (!bills.length) return toast.error('Nothing to export');
    const rows = bills.map((bill) => ({
      Party: bill.party,
      Reference: bill.refNo,
      Narration: bill.narration || '',
      Date: bill.date || '',
      'Due date': bill.dueDate || '',
      Amount: bill.amount,
      Pending: bill.pending,
      'Overdue days': bill.overdueDays > 0 ? bill.overdueDays : 0,
      Bucket: ageingBucket(bill.overdueDays),
    }));
    await exportSheet({ rows, sheetName: REPORT_TYPES[reportType].sheet, fileName: `outstanding-${reportType}-${today}.xlsx` });
    toast.success(`${rows.length} row(s) exported`);
  };

  const openInvoice = (bill) => navigate(`/accounts-hub?item=gst${bill.gst.kind}&voucher=${bill.voucherId}`);
  const totalPending = bills.reduce((sum, bill) => sum + bill.pending, 0);
  const type = REPORT_TYPES[reportType];

  return (
    <div className="tw:mx-auto tw:flex tw:w-full tw:max-w-[1400px] tw:min-w-0 tw:flex-col tw:gap-6 tw:p-3 tw:md:p-6">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className={cn('tw:flex tw:rounded-lg tw:p-3 tw:text-primary-foreground', type.icon)}><IndianRupee className="tw:size-6" /></div>
          <div>
            <h2 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-foreground">{type.title}</h2>
            <div className="tw:mt-1 tw:text-[13px] tw:text-muted-foreground">Bill-by-Bill Outstanding & Ageing Analysis</div>
          </div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <Tabs value={reportType} onValueChange={setReportType}>
            <TabsList variant="pill">
              <TabsTrigger value="receivable" className="tw:font-bold">Receivables</TabsTrigger>
              <TabsTrigger value="payable" className="tw:font-bold">Payables</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="lg" onClick={exportExcel}><Download /> Export Excel</Button>
        </div>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-6">
        <SummaryCard tone="dark" label="Total Outstanding" value={`₹ ${amountText(totalPending)}`} className="tw:sm:col-span-2">
          {basis ? <div className="tw:text-[10px] tw:opacity-85" title="How the open items were worked out">{basis}</div> : null}
          <div className="tw:mt-1 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:opacity-80"><PieChart className="tw:size-3.5" /> Across {bills.length} pending bills</div>
        </SummaryCard>
        {BUCKET_CARDS.map((card) => (
          <SummaryCard key={card.key} tone={card.tone} label={card.label} value={`₹ ${amountText(buckets[card.key])}`} />
        ))}
      </div>

      <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-card">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-t-lg tw:border-b tw:border-border tw:bg-page tw:px-5 tw:py-4 tw:md:flex-row tw:md:items-center tw:md:justify-between">
          <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-[15px] tw:text-foreground">
            <FileText className={cn('tw:size-[18px]', type.text)} /> Bill-wise Outstanding Details
          </h3>
          <Input data-allow-text="" leftIcon={Search} placeholder="Search Party or Inv No..." className="tw:w-full tw:md:w-[250px]" />
        </div>
        <DataTable
          columns={billColumns({ reportType, openInvoice })}
          rows={loading ? [] : bills}
          emptyText={loading ? 'Loading Advanced Outstanding Data...' : 'No pending bills.'}
          stickyHeader={false}
        />
      </div>
    </div>
  );
}
