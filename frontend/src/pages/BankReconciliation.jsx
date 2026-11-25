import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Printer, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, DateInput } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { ReportFrame, ReportMessage, ReportPage } from './LedgerReportParts/ReportLayout';
import { LedgerPicker } from './LedgerReportParts/ReportFilters';
import { dayFirst, formatAmount } from './LedgerReportParts/format';
import { flattenLedgers } from './LedgerReportParts/reportData';

const reconciliationColumns = (onClearanceDate) => [
  { key: 'date', header: 'Date', width: 90, cell: (entry) => dayFirst(entry.date) },
  {
    key: 'particulars',
    header: 'Particulars',
    className: 'tw:font-bold tw:whitespace-normal tw:text-foreground',
    cell: (entry) => (
      <>
        {entry.voucherType}
        {entry.narration && <div className="tw:mt-0.5 tw:text-[10px] tw:font-normal tw:text-muted-foreground">{entry.narration}</div>}
      </>
    ),
  },
  { key: 'voucherType', header: 'Vch Type', width: 110 },
  { key: 'voucherNumber', header: 'Vch No.', width: 100 },
  { key: 'debit', header: 'Debit (₹)', align: 'right', width: 120, className: 'tw:text-primary', cell: (entry) => (entry.dc === 'Dr' ? formatAmount(entry.amount) : '') },
  { key: 'credit', header: 'Credit (₹)', align: 'right', width: 120, className: 'tw:text-destructive', cell: (entry) => (entry.dc === 'Cr' ? formatAmount(entry.amount) : '') },
  {
    key: 'clearanceDate',
    header: 'Bank Date',
    align: 'center',
    width: 140,
    className: 'tw:p-0.5',
    cell: (entry) => (
      <div className={cn('tw:rounded-sm tw:p-0.5', entry.clearanceDate ? 'tw:bg-success/15' : 'tw:bg-warning/15')}>
        <DateInput value={entry.clearanceDate || ''} onValueChange={(value) => onClearanceDate(entry.id, value)} />
      </div>
    ),
  },
];

// Bank balance = book balance + cheques issued but not presented (uncleared Cr) - deposits not yet credited (uncleared Dr).
function reconcile(brs) {
  const openingBalance = parseFloat(brs.ledger.openingBalance || 0);
  let totalDr = brs.ledger.balanceType === 'Dr' ? openingBalance : 0;
  let totalCr = brs.ledger.balanceType === 'Cr' ? openingBalance : 0;
  let unreconciledDr = 0;
  let unreconciledCr = 0;

  brs.transactions.forEach((entry) => {
    if (entry.dc === 'Dr') {
      totalDr += entry.amount;
      if (!entry.clearanceDate) unreconciledDr += entry.amount;
    } else {
      totalCr += entry.amount;
      if (!entry.clearanceDate) unreconciledCr += entry.amount;
    }
  });

  const bookNet = totalDr - totalCr;
  const bankNet = bookNet + unreconciledCr - unreconciledDr;
  return {
    companyBal: Math.abs(bookNet),
    companyBalType: bookNet >= 0 ? 'Dr' : 'Cr',
    unreconciledDr,
    unreconciledCr,
    bankBal: Math.abs(bankNet),
    bankBalType: bankNet >= 0 ? 'Dr' : 'Cr',
  };
}

function SummaryLine({ label, value, className }) {
  return (
    <div className={cn('tw:flex tw:justify-between tw:gap-3 tw:text-entry', className)}>
      <div>{label}</div>
      <div className="tw:font-bold tw:tabular-nums">{value}</div>
    </div>
  );
}

function ReconciliationSummary({ summary }) {
  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-card tw:p-4 tw:lg:sticky tw:lg:top-4 tw:lg:w-[320px] tw:lg:shrink-0">
      <h3 className="tw:m-0 tw:mb-2 tw:border-b tw:border-border tw:pb-2 tw:text-[15px] tw:font-bold tw:text-foreground">Reconciliation Summary</h3>
      <SummaryLine
        label="Balance as per Company Books"
        value={`${formatAmount(summary.companyBal)} ${summary.companyBalType}`}
        className="tw:mb-1 tw:font-semibold tw:text-muted-foreground"
      />
      <SummaryLine label="Amounts not reflected in Bank (Dr)" value={formatAmount(summary.unreconciledDr)} className="tw:text-destructive" />
      <SummaryLine label="Amounts not reflected in Bank (Cr)" value={formatAmount(summary.unreconciledCr)} className="tw:mb-2 tw:text-primary" />
      <SummaryLine
        label="Balance as per Bank"
        value={`${formatAmount(summary.bankBal)} ${summary.bankBalType}`}
        className="tw:border-t-2 tw:border-foreground tw:pt-3 tw:text-sm tw:font-bold tw:text-foreground"
      />
    </div>
  );
}

export default function BankReconciliation() {
  const [ledgers, setLedgers] = useState([]);
  const [ledgerId, setLedgerId] = useState('');
  const [brs, setBrs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changedDates, setChangedDates] = useState({});

  useEffect(() => {
    const loadLedgers = async () => {
      try {
        const tree = await accountsApi.ledgerTree();
        setLedgers(flattenLedgers(tree.data || []));
      } catch (error) {
        console.error('Error fetching ledgers', errorMessage(error));
      }
    };
    loadLedgers();
  }, []);

  const loadBrs = async (id) => {
    setLoading(true);
    try {
      const body = await accountsApi.ledgerReportBrs(id);
      setBrs(body.data);
      setChangedDates({});
    } catch (error) {
      console.error('Error fetching BRS', errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ledgerId) loadBrs(ledgerId);
  }, [ledgerId]);

  const setClearanceDate = (id, clearanceDate) => {
    setBrs((current) => ({
      ...current,
      transactions: current.transactions.map((entry) => (entry.id === id ? { ...entry, clearanceDate } : entry)),
    }));
    setChangedDates((current) => ({ ...current, [id]: clearanceDate }));
  };

  const hasChanges = Object.keys(changedDates).length > 0;

  const save = async () => {
    const updates = Object.entries(changedDates).map(([id, clearanceDate]) => ({ id: parseInt(id, 10), clearanceDate: clearanceDate || null }));
    if (!updates.length) return toast.error('No changes to save.');
    setSaving(true);
    try {
      await accountsApi.controlSaveBankReco(updates);
      toast.success('Reconciliation updated successfully!');
      loadBrs(ledgerId);
    } catch {
      toast.error('Error updating reconciliation');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => (brs ? reconcile(brs) : null), [brs]);
  const columns = reconciliationColumns(setClearanceDate);

  const actions = (
    <>
      <Button onClick={() => window.print()}><Printer /> Print</Button>
      <Button variant="default" onClick={save} disabled={saving || !hasChanges}>
        <Save /> {saving ? 'Saving...' : 'Update BRS'}
      </Button>
    </>
  );

  const filters = <LedgerPicker ledgers={ledgers} value={ledgerId} onValueChange={setLedgerId} placeholder="-- Select Bank Ledger --" />;

  return (
    <ReportPage icon={CheckCircle} title="Bank Reconciliation" subtitle="Reconcile Company Books with Bank Statement" actions={actions}>
      <ReportFrame filters={filters} filtersLabel="Select Bank :">
        {!ledgerId && (
          <ReportMessage icon={CheckCircle} title="No Bank Selected">Please select a bank ledger to start reconciliation.</ReportMessage>
        )}
        {ledgerId && loading && <ReportMessage tone="loading">Loading BRS Data...</ReportMessage>}
        {ledgerId && !loading && brs && (
          <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:flex-row tw:lg:items-start">
            <div className="tw:min-w-0 tw:flex-1 tw:rounded-sm tw:border tw:border-border tw:bg-card">
              <DataTable columns={columns} rows={brs.transactions} emptyText="No transactions to reconcile." stickyHeader={false} />
            </div>
            <ReconciliationSummary summary={summary} />
          </div>
        )}
      </ReportFrame>
    </ReportPage>
  );
}
