import { useEffect, useState } from 'react';
import { Download, Eye, FileText, Mail, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, Separator, TableRow } from '@/components/ui';
import { accountsApi } from './AccountsHubParts/accountsApi';
import { ReportFrame, ReportMessage, ReportPage, ReportSheet } from './LedgerReportParts/ReportLayout';
import { LedgerPicker, PeriodFilter } from './LedgerReportParts/ReportFilters';
import { MessageRow, ReportCell, ReportTable, TotalsRow } from './LedgerReportParts/ReportTable';
import { dayFirst, formatAmount, monthStartIso, periodText, todayIso } from './LedgerReportParts/format';
import { flattenLedgers } from './LedgerReportParts/reportData';

const COLUMNS = [
  { key: 'date', header: 'Date', className: 'tw:w-[90px]' },
  { key: 'particulars', header: 'Particulars' },
  { key: 'voucherType', header: 'Vch Type', className: 'tw:w-[110px]' },
  { key: 'voucherNumber', header: 'Vch No.', className: 'tw:w-[110px]' },
  { key: 'debit', header: 'Debit (₹)', align: 'right', className: 'tw:w-[140px]' },
  { key: 'credit', header: 'Credit (₹)', align: 'right', className: 'tw:w-[140px]' },
  { key: 'balance', header: 'Balance (₹)', align: 'right', className: 'tw:w-[140px]' },
];

const ledgerIdFromUrl = () => new URLSearchParams(window.location.search).get('ledgerId') || '';

function TransactionRow({ transaction, selected, onSelect }) {
  const isDebit = transaction.dc === 'Dr';
  return (
    <TableRow data-state={selected ? 'selected' : undefined} className="tw:cursor-pointer" onClick={onSelect}>
      <ReportCell className="tw:font-medium">{dayFirst(transaction.date)}</ReportCell>
      <ReportCell className="tw:font-bold tw:whitespace-normal tw:text-foreground">
        {transaction.voucherType}
        {transaction.narration && <div className="tw:mt-1 tw:text-[11px] tw:font-normal tw:text-muted-foreground tw:italic">{transaction.narration}</div>}
      </ReportCell>
      <ReportCell>{transaction.voucherType}</ReportCell>
      <ReportCell className="tw:font-semibold">{transaction.voucherNumber}</ReportCell>
      <ReportCell align="right" className={cn('tw:text-primary', isDebit && 'tw:font-semibold', isDebit && !selected && 'tw:bg-primary/5')}>
        {isDebit ? formatAmount(transaction.amount) : ''}
      </ReportCell>
      <ReportCell align="right" className={cn('tw:text-destructive', !isDebit && 'tw:font-semibold', !isDebit && !selected && 'tw:bg-destructive/5')}>
        {isDebit ? '' : formatAmount(transaction.amount)}
      </ReportCell>
      <ReportCell align="right" className="tw:font-bold">
        {formatAmount(transaction.runningBalance)} {transaction.runningBalanceType}
      </ReportCell>
    </TableRow>
  );
}

function StatementTable({ statement, selectedVoucherId, onSelect }) {
  const opening = formatAmount(statement.openingBalance);
  return (
    <ReportTable columns={COLUMNS}>
      <TotalsRow
        label="Opening Balance"
        span={4}
        className="tw:bg-muted"
        cells={[
          { value: statement.openingBalanceType === 'Dr' ? opening : '', className: 'tw:text-primary' },
          { value: statement.openingBalanceType === 'Cr' ? opening : '', className: 'tw:text-destructive' },
          { value: `${opening} ${statement.openingBalanceType}` },
        ]}
      />
      {statement.transactions.length === 0 && <MessageRow span={COLUMNS.length}>No transactions in this period.</MessageRow>}
      {statement.transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          selected={selectedVoucherId === transaction.voucherId}
          onSelect={() => onSelect(transaction.voucherId)}
        />
      ))}
      <TotalsRow
        label="Closing Balance"
        span={4}
        className="tw:border-t-2 tw:border-t-head tw:bg-accent tw:text-head"
        labelClassName="tw:py-3 tw:text-sm"
        cells={[
          { value: '' },
          { value: '' },
          { value: `${formatAmount(statement.closingBalance)} ${statement.closingBalanceType}`, className: 'tw:py-3 tw:text-base' },
        ]}
      />
    </ReportTable>
  );
}

export default function LedgerStatement() {
  const [ledgers, setLedgers] = useState([]);
  const [ledgerId, setLedgerId] = useState(ledgerIdFromUrl);
  const [startDate, setStartDate] = useState(monthStartIso);
  const [endDate, setEndDate] = useState(todayIso);
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(null);

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

  useEffect(() => {
    if (!ledgerId) return;
    const loadStatement = async () => {
      setLoading(true);
      try {
        const body = await accountsApi.ledgerReportStatement(ledgerId, { startDate, endDate });
        setStatement(body.data);
        setSelectedVoucherId(null);
      } catch (error) {
        console.error('Error fetching statement', errorMessage(error));
      } finally {
        setLoading(false);
      }
    };
    loadStatement();
  }, [ledgerId, startDate, endDate]);

  const viewVoucher = () => {
    if (!selectedVoucherId) return toast.error('Please select a transaction to view');
    toast(`Opening Voucher View for ID: ${selectedVoucherId}`);
  };

  const actions = (
    <>
      <Button variant="default" onClick={viewVoucher}><Eye /> View</Button>
      <Separator orientation="vertical" className="tw:mx-1 tw:data-[orientation=vertical]:h-5" />
      <Button onClick={() => window.print()}><Printer /> Print</Button>
      <Button onClick={() => toast('Email module will open here to send this statement directly to the party.')}><Mail /> Email</Button>
      <Button onClick={() => toast('Exporting to Excel/PDF...')}><Download /> Export</Button>
    </>
  );

  const filters = (
    <>
      <LedgerPicker label="Account Ledger:" ledgers={ledgers} value={ledgerId} onValueChange={setLedgerId} placeholder="-- Type or Select Ledger --" />
      <PeriodFilter label="Period:" from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} />
    </>
  );

  return (
    <ReportPage icon={FileText} title="Ledger Statement" subtitle="Advanced Accounting Report" actions={actions}>
      <ReportFrame filters={filters}>
        {!ledgerId && (
          <ReportMessage icon={FileText} title="No Ledger Selected">
            Please select a ledger from the top bar to generate the statement.
          </ReportMessage>
        )}
        {ledgerId && loading && <ReportMessage tone="loading">Loading Statement...</ReportMessage>}
        {ledgerId && !loading && statement && (
          <ReportSheet title={statement.ledger.name} subtitle="Ledger Account Statement" period={periodText(startDate, endDate)}>
            <StatementTable statement={statement} selectedVoucherId={selectedVoucherId} onSelect={setSelectedVoucherId} />
          </ReportSheet>
        )}
      </ReportFrame>
    </ReportPage>
  );
}
