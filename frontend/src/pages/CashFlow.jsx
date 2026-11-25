import { useCallback, useEffect, useState } from 'react';
import { Activity, Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { ReportFrame, ReportMessage, ReportPage, ReportSheet } from './LedgerReportParts/ReportLayout';
import { PeriodFilter } from './LedgerReportParts/ReportFilters';
import { financialYearStart, formatAmount, formatInr, periodText, todayIso } from './LedgerReportParts/format';
import { assertSuccess, exportSheet } from './LedgerReportParts/reportData';

const amountTone = (amount) => (amount < 0 ? 'tw:text-destructive' : 'tw:text-success');

const COLUMNS = [
  {
    key: 'name',
    header: 'Particulars',
    cell: (row) => <span className={row.isGroup ? 'tw:font-bold tw:text-foreground' : 'tw:pl-5 tw:text-muted-foreground'}>{row.name}</span>,
  },
  {
    key: 'amount',
    header: 'Amount (₹)',
    align: 'right',
    width: 180,
    cell: (row) => <span className={cn(amountTone(row.amount), row.isGroup && 'tw:font-bold')}>{formatAmount(row.amount)}</span>,
  },
];

const activityRows = (groups) => groups.flatMap((group) => [
  { ...group, key: `group-${group.id}`, isGroup: true },
  ...group.children.map((item) => ({ ...item, key: `${group.id}-${item.id}` })),
]);

function ReconciliationNote({ meta }) {
  const balances = meta.check?.balances;
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5 tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-3 tw:text-entry tw:text-muted-foreground">
      <div className="tw:flex tw:flex-wrap tw:gap-x-6 tw:gap-y-1">
        <span>Opening cash &amp; bank: <b>{formatAmount(meta.opening)}</b></span>
        <span>Net movement: <b>{formatAmount(meta.net)}</b></span>
        <span>Closing cash &amp; bank: <b>{formatAmount(meta.closing)}</b></span>
        <span className={cn('tw:font-bold', balances ? 'tw:text-success' : 'tw:text-destructive')}>
          {balances ? 'Opening + net = closing ✓' : 'Opening + net does NOT equal closing - do not file this'}
        </span>
      </div>
      {meta.cashLedgers?.length > 0 && <div>From {meta.cashLedgers.length} cash / bank ledger(s): {meta.cashLedgers.join(', ')}</div>}
      {meta.unclassified ? (
        <div className="tw:text-warning">{formatInr(meta.unclassified)} could not be attributed to an activity - those vouchers have no contra ledger.</div>
      ) : null}
      {!meta.cashLedgers?.length && <div>{meta.note}</div>}
    </div>
  );
}

export default function CashFlow() {
  const [groups, setGroups] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(financialYearStart);
  const [to, setTo] = useState(todayIso);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const body = assertSuccess(await accountsApi.ledgerReportCashFlow({ from, to }));
      setGroups(body.data || []);
      setMeta(body);
    } catch (loadError) {
      setGroups([]);
      setMeta(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const netCashFlow = meta ? meta.net : groups.reduce((sum, group) => sum + group.amount, 0);

  const exportExcel = async () => {
    if (!groups.length) return toast.error('Nothing to export');
    const rows = groups.flatMap((group) => [
      { Particulars: group.name, 'Amount (INR)': group.amount },
      ...(group.children || []).map((item) => ({ Particulars: `    ${item.name}`, 'Amount (INR)': item.amount })),
    ]);
    rows.push({ Particulars: 'Net Cash Flow', 'Amount (INR)': meta ? meta.net : 0 });
    if (meta) {
      rows.push({ Particulars: 'Opening cash / bank', 'Amount (INR)': meta.opening });
      rows.push({ Particulars: 'Closing cash / bank', 'Amount (INR)': meta.closing });
    }
    await exportSheet({ rows, sheetName: 'Cash Flow', fileName: `cash-flow-${from}-to-${to}.xlsx`, columnWidths: [52, 18] });
  };

  const actions = (
    <>
      <PeriodFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} separator="to" />
      <Button onClick={() => window.print()}><Printer /> Print</Button>
      <Button onClick={exportExcel}><Download /> Export</Button>
    </>
  );

  return (
    <ReportPage icon={Activity} title="Cash Flow Statement" subtitle="Inflows & Outflows" actions={actions}>
      <ReportFrame>
        {loading && <ReportMessage tone="loading">Loading Cash Flow...</ReportMessage>}
        {!loading && error && <ReportMessage tone="error">Could not build the statement: {error}</ReportMessage>}
        {!loading && !error && (
          <ReportSheet title="Cash Flow Statement" subtitle={`For the period ${periodText(from, to)}`}>
            <DataTable
              columns={COLUMNS}
              rows={activityRows(groups)}
              rowKey="key"
              rowClassName={(row) => row.isGroup && 'tw:bg-muted tw:even:bg-muted'}
              emptyText={`No cash or bank movement in this period.${meta?.note ? ` ${meta.note}` : ''}`}
              stickyHeader={false}
            />
            <div className="tw:flex tw:border-t-2 tw:border-head tw:bg-accent tw:text-head">
              <div className="tw:flex-1 tw:p-3 tw:text-right tw:text-sm tw:font-extrabold tw:uppercase">Net Cash Flow :</div>
              <div className={cn('tw:w-[180px] tw:p-3 tw:text-right tw:text-[15px] tw:font-bold tw:tabular-nums', netCashFlow < 0 ? 'tw:text-destructive' : 'tw:text-foreground')}>
                {formatAmount(netCashFlow)}
              </div>
            </div>
            {meta && <ReconciliationNote meta={meta} />}
          </ReportSheet>
        )}
      </ReportFrame>
    </ReportPage>
  );
}
