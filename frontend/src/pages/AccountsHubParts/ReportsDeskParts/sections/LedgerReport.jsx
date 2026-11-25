import { useNavigate } from 'react-router-dom';
import { BookUser, Download, Printer, RefreshCw } from 'lucide-react';
import { Field, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui';
import { ActionBar, Box, Btn, Empty, LedgerPicker, Money, fmtDate, inr } from '../../ui';
import VoucherDrawer from '../../VoucherDrawer';
import { CheckLabel } from '../../VoucherDeskParts/sections/CheckLabel';
import { Stat, StatStrip } from '../../OtherDeskParts/sections/StatStrip';
import { SearchInput, ToolbarDivider } from '../../OtherDeskParts/sections/ToolbarBits';
import { useLedgerReport } from '../hooks/useLedgerReport';
import { PeriodPicker } from './PeriodPicker';

const HEADINGS = ['Date', 'Voucher', 'Particulars', 'Ref / Chq', 'Job', 'Debit', 'Credit', 'Balance'];
const signed = (value) => (value ? inr(Math.abs(value)) + (value < 0 ? ' Cr' : ' Dr') : '0.00');
const monthName = (month) => new Date(month + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const AMOUNT = 'tw:text-right tw:tabular-nums';
const BOLD_AMOUNT = 'tw:text-right tw:font-extrabold tw:tabular-nums';

function MonthTotalRow({ month, totals }) {
  return (
    <TableRow className="tw:bg-primary/10 tw:even:bg-primary/10">
      <TableCell colSpan={5} className="tw:font-extrabold tw:text-head">{monthName(month)} - {totals.n} entries</TableCell>
      <TableCell className={BOLD_AMOUNT}>{inr(totals.dr)}</TableCell>
      <TableCell className={BOLD_AMOUNT}>{inr(totals.cr)}</TableCell>
      <TableCell className={BOLD_AMOUNT}>{signed(totals.last)}</TableCell>
    </TableRow>
  );
}

function EntryRow({ row, active, showNarration, onOpen }) {
  const narration = [row.narration, row.remarks].filter(Boolean).join(' - ');
  return (
    <TableRow data-state={active ? 'selected' : undefined} title="Show this voucher's details" onClick={() => onOpen(row.id)} className="tw:cursor-pointer">
      <TableCell>{fmtDate(row.date)}</TableCell>
      <TableCell>
        <b className="tw:text-head">{row.voucherNumber}</b>
        <div className="tw:text-[10px] tw:text-muted-foreground">{row.typeName}{row.status && !/approv/i.test(row.status) ? ' - ' + row.status : ''}</div>
      </TableCell>
      <TableCell className="tw:max-w-[420px] tw:whitespace-normal">
        <div className="tw:font-semibold">{row.dc === 'Cr' ? 'By ' : 'To '}{row.contra || '-'}</div>
        {showNarration && narration && <div className="tw:text-[10.5px] tw:text-muted-foreground">{narration}</div>}
        {row.currency && row.currency !== 'INR' && row.amountFcy ? <div className="tw:text-[10px] tw:text-muted-foreground">{row.currency} {inr(row.amountFcy)}</div> : null}
      </TableCell>
      <TableCell>{row.refNo || ''}</TableCell>
      <TableCell>{row.jobNo || ''}</TableCell>
      <TableCell className={AMOUNT}>{row.debit ? <Money v={row.debit} side="Dr" /> : ''}</TableCell>
      <TableCell className={AMOUNT}>{row.credit ? <Money v={row.credit} side="Cr" /> : ''}</TableCell>
      <TableCell className="tw:text-right tw:font-bold tw:tabular-nums">{signed(row.balance)}</TableCell>
    </TableRow>
  );
}

function LedgerTable({ ledger }) {
  const { data, lines, rows, months } = ledger;
  return (
    <Box pad={0}>
      <Table containerClassName="tw:max-h-[calc(100vh-430px)]">
        <TableHeader sticky>
          <TableRow>{HEADINGS.map((heading, index) => <TableHead key={heading} className={index >= 5 ? 'tw:text-right' : undefined}>{heading}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="tw:bg-page">
            <TableCell>{fmtDate(data.from)}</TableCell><TableCell /><TableCell className="tw:font-extrabold">Opening balance</TableCell><TableCell /><TableCell />
            <TableCell className={AMOUNT}>{data.opening > 0 ? inr(data.opening) : ''}</TableCell>
            <TableCell className={AMOUNT}>{data.opening < 0 ? inr(-data.opening) : ''}</TableCell>
            <TableCell className={BOLD_AMOUNT}>{signed(data.opening)}</TableCell>
          </TableRow>
          {lines.map((line, index) => (line.month
            ? <MonthTotalRow key={'m' + index} month={line.month} totals={months.get(line.month)} />
            : <EntryRow key={index} row={line} active={String(ledger.drawerVoucher) === String(line.id)} showNarration={ledger.showNarration} onOpen={ledger.setDrawerVoucher} />))}
          {!rows.length && <TableRow><TableCell colSpan={8} className="tw:py-5 tw:text-center tw:text-muted-foreground">No entries in this period</TableCell></TableRow>}
        </TableBody>
        <TableFooter className="tw:sticky tw:bottom-0">
          <TableRow className="tw:bg-primary/10 tw:even:bg-primary/10">
            <TableCell>{fmtDate(data.to)}</TableCell><TableCell /><TableCell className="tw:font-extrabold">Closing balance</TableCell><TableCell /><TableCell />
            <TableCell className={BOLD_AMOUNT}>{inr(data.debit)}</TableCell>
            <TableCell className={BOLD_AMOUNT}>{inr(data.credit)}</TableCell>
            <TableCell className={BOLD_AMOUNT}>{signed(data.closing)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Box>
  );
}

function LedgerSummary({ ledger }) {
  const { data } = ledger;
  const account = data.ledger;
  return (
    <StatStrip className="tw:gap-x-[30px] tw:py-3">
      <div className="tw:min-w-[220px]">
        <div className="tw:text-[15px] tw:font-extrabold tw:text-foreground">{account.name}</div>
        <div className="tw:text-[11px] tw:text-muted-foreground">{[account.groupName, account.gstin, account.state].filter(Boolean).join(' | ')}</div>
        <div className="tw:text-[11px] tw:text-muted-foreground">{fmtDate(data.from)} to {fmtDate(data.to)}</div>
      </div>
      <Stat size="sm" label="Opening" value={signed(data.opening)} />
      <Stat size="sm" label="Debit" value={inr(data.debit)} tone="danger" />
      <Stat size="sm" label="Credit" value={inr(data.credit)} tone="success" />
      <Stat size="sm" label="Closing" value={signed(data.closing)} tone={data.closing < 0 ? 'success' : data.closing > 0 ? 'danger' : null} />
      <Stat size="sm" label="Entries" value={ledger.rows.length} />
    </StatStrip>
  );
}

// Ledger - statement of one account with running balance. Backend: /accounts-hub/ledger-report
export function LedgerReport() {
  const navigate = useNavigate();
  const ledger = useLedgerReport();
  const { data, busy, params } = ledger;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <Box title="Ledger" right={<span className="tw:text-[10.5px] tw:font-semibold tw:text-muted-foreground tw:normal-case">Statement of one account with running balance</span>}>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-3 tw:lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <Field label="Account Name" required layout="col" className="tw:sm:col-span-3 tw:lg:col-span-1">
            <LedgerPicker id="ledrep" list={ledger.ledgers} value={params.ledgerId} onChange={ledger.pickLedger} mandatory />
          </Field>
          <PeriodPicker from={params.from} to={params.to} onChange={ledger.setPeriod} />
        </div>
      </Box>
      <ActionBar note={ledger.error}>
        <Btn kind="primary" onClick={() => ledger.run()} disabled={busy}><RefreshCw size={13} /> {busy ? 'Loading' : 'Show'}</Btn>
        <Btn kind="save" onClick={ledger.exportCsv} disabled={!data}><Download size={13} /> Excel</Btn>
        <Btn kind="plain" onClick={() => window.print()} disabled={!data}><Printer size={13} /> Print</Btn>
        {data && (
          <>
            <ToolbarDivider />
            <SearchInput className="tw:sm:w-[200px]" value={ledger.query} onChange={ledger.setQuery} placeholder="Voucher, party, ref, job" />
            <CheckLabel checked={ledger.monthly} onChange={ledger.setMonthly}>Month totals</CheckLabel>
            <CheckLabel checked={ledger.showNarration} onChange={ledger.setShowNarration}>Narration</CheckLabel>
            <Btn kind="ghost" onClick={() => navigate('/accounts-hub?item=ledgers&ledger=' + data.ledger.id)}><BookUser size={12} /> Account master</Btn>
          </>
        )}
      </ActionBar>
      {!data && !busy && <Empty title="Choose an account to see its ledger">Type the name in Account Name; the statement opens for the period chosen.</Empty>}
      {data && (
        <>
          <LedgerSummary ledger={ledger} />
          <LedgerTable ledger={ledger} />
        </>
      )}
      {ledger.drawerVoucher && (
        <VoucherDrawer id={ledger.drawerVoucher} ids={ledger.rows.map((row) => row.id)} onMove={ledger.setDrawerVoucher} onClose={() => ledger.setDrawerVoucher(null)} />
      )}
    </div>
  );
}
