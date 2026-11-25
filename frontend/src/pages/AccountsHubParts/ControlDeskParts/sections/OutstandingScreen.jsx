import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronRight, Download, FileText, Mail, MessageCircle, Printer, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DateInput, Input, SelectBox, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui';
import { ActionBar, Grid, Money, Sheet, fmtDate, inr } from '../../ui';
import { InvoiceSend, openInvoicePdf } from '../../GstInvoiceDesk';
import VoucherDrawer from '../../VoucherDrawer';
import { CheckField } from '../../GstInvoiceDeskParts/sections/formParts';
import { AGE, AGE_TONE, round2 } from '../controlUtils';
import useOutstanding from '../hooks/useOutstanding';
import Tiles from './Tiles';

const TYPES = [['receivable', 'Receivable (debtors)'], ['payable', 'Payable (creditors)']];
const VIEWS = [{ value: 'party', label: 'Party-wise' }, { value: 'bill', label: 'Bill-wise' }];
const pendingSum = (bills) => round2(bills.reduce((total, bill) => total + bill.pending, 0));

function IconButton({ title, onClick, children }) {
  return (
    <Button size="icon-sm" title={title} aria-label={title} className="tw:size-[18px]" onClick={(event) => { event.stopPropagation(); onClick(); }}>{children}</Button>
  );
}

// the bill no: PDF / mail / WhatsApp buttons for a GST invoice; a click on the no shows the voucher in a side panel
function BillNo({ bill, openVoucherId, actions }) {
  const link = bill.voucherId && (
    <Button variant="link" size="sm" title={'Show the details of ' + bill.refNo} onClick={(event) => { event.stopPropagation(); actions.showVoucher(bill.voucherId); }}
      className={cn('tw:h-auto tw:font-semibold tw:text-blue-700 tw:underline', String(openVoucherId) === String(bill.voucherId) && 'tw:bg-primary/10')}>{bill.refNo}</Button>
  );
  if (bill.gst && bill.voucherId) {
    return (
      <span className="tw:inline-flex tw:items-center tw:gap-0.5 tw:whitespace-nowrap">
        <IconButton title="Download PDF" onClick={() => actions.pdf(bill, true)}><Download className="tw:size-3 tw:text-slate-700" /></IconButton>
        <IconButton title={'Open the PDF of ' + bill.gst.invoiceNo + ' in a new tab'} onClick={() => actions.pdf(bill, false)}><FileText className="tw:size-3 tw:text-red-700" /></IconButton>
        <IconButton title="E-mail with PDF" onClick={() => actions.send(bill.voucherId, 'mail')}><Mail className="tw:size-3 tw:text-blue-700" /></IconButton>
        <IconButton title="WhatsApp with PDF" onClick={() => actions.send(bill.voucherId, 'whatsapp')}><MessageCircle className="tw:size-3 tw:text-green-600" /></IconButton>
        <span className="tw:ml-1">{link}</span>
        {bill.gst.irn && <span className="tw:ml-1 tw:text-[9px] tw:font-extrabold tw:text-success">IRN</span>}
      </span>
    );
  }
  return <span className="tw:whitespace-nowrap">{link || bill.refNo}</span>;
}

function PartyBills({ party, billNo }) {
  const headers = [['Bill No'], ['Bill Date'], ['Due Date'], ['Pending', true], ['Overdue Days', true]];
  return (
    <Table className="tw:mt-1.5">
      <TableHeader>
        <TableRow>{headers.map(([label, right]) => <TableHead key={label} className={right ? 'tw:text-right' : ''}>{label}</TableHead>)}</TableRow>
      </TableHeader>
      <TableBody>
        {party.bills.map((bill) => (
          <TableRow key={bill.id}>
            <TableCell>{billNo(bill)}</TableCell>
            <TableCell>{fmtDate(bill.date)}</TableCell>
            <TableCell>{fmtDate(bill.dueDate)}</TableCell>
            <TableCell className="tw:text-right">{inr(bill.pending)}</TableCell>
            <TableCell className={cn('tw:text-right tw:font-bold', AGE_TONE[bill.age])}>{bill.overdueDays > 0 ? bill.overdueDays : 'Not due'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function partyColumns({ outstanding, billNo, navigate }) {
  const { open, toggleParty, printStatement } = outstanding;
  return [
    { label: '', w: 24, render: (party) => <Button variant="ghost" size="icon-sm" aria-label="Show bills" onClick={() => toggleParty(party.ledgerId)}>{open[party.ledgerId] ? <ChevronDown /> : <ChevronRight />}</Button> },
    { label: 'Party', wrap: true, render: (party) => (
      <div>
        <b className="tw:cursor-pointer" onClick={() => toggleParty(party.ledgerId)}>{party.party}</b>
        {open[party.ledgerId] && <PartyBills party={party} billNo={billNo} />}
      </div>
    ) },
    { label: 'Bills', right: true, render: (party) => party.bills.length },
    { label: 'Outstanding', right: true, render: (party) => <Money v={party.total} strong /> },
    ...AGE.map(([key, label]) => ({ label, right: true, render: (party) => (party[key] ? <span className={cn('tw:font-bold', AGE_TONE[key])}>{inr(party[key])}</span> : '') })),
    { label: 'Oldest', right: true, render: (party) => (party.oldest > 0 ? party.oldest + ' d' : '') },
    { label: '', render: (party) => (
      <span className="tw:inline-flex tw:gap-1">
        <Button variant="ghost" title="Print statement" aria-label="Print statement" onClick={() => printStatement(party)}><Printer /></Button>
        <Button variant="ghost" title="Ledger" aria-label="Ledger" onClick={() => navigate('/accounts-hub?item=ledger&ledger=' + party.ledgerId)}><BookOpen /></Button>
      </span>
    ) },
  ];
}

const billColumns = (billNo) => [
  { label: 'Party', wrap: true, render: (bill) => <b>{bill.party}</b> },
  { label: 'Bill', render: billNo },
  { label: 'Date', render: (bill) => fmtDate(bill.date) },
  { label: 'Due', render: (bill) => fmtDate(bill.dueDate) },
  { label: 'Bill amount', right: true, render: (bill) => <Money v={bill.amount} muted /> },
  { label: 'Pending', right: true, render: (bill) => <Money v={bill.pending} strong /> },
  { label: 'Overdue', right: true, render: (bill) => <span className={cn('tw:font-bold', AGE_TONE[bill.age])}>{bill.overdueDays > 0 ? bill.overdueDays + ' days' : 'not due'}</span> },
  { label: 'Narration', wrap: true, render: (bill) => bill.narration },
];

function OutstandingToolbar({ outstanding }) {
  const { filter, setFilter, setFilterField, msg } = outstanding;
  return (
    <ActionBar note={msg}>
      <span className="tw:inline-flex tw:overflow-hidden tw:rounded-md tw:border tw:border-primary/30">
        {TYPES.map(([type, label]) => (
          <Button key={type} variant={filter.type === type ? 'default' : 'outline'} className="tw:rounded-none tw:border-0 tw:font-extrabold" onClick={() => setFilter((old) => ({ ...old, type, age: '' }))}>{label}</Button>
        ))}
      </span>
      <span className="tw:text-[11px] tw:text-muted-foreground">As on</span>
      <DateInput value={filter.asOn} onValueChange={(value) => setFilterField('asOn', value)} wrapperClassName="tw:w-[140px]" />
      <Input data-allow-text leftIcon={Search} className="tw:w-full tw:sm:w-[210px]" value={filter.q} onChange={(event) => setFilterField('q', event.target.value)} placeholder="Party, bill or narration" />
      <CheckField label="Overdue only" checked={filter.overdue} onCheckedChange={(value) => setFilterField('overdue', value)} />
      <SelectBox className="tw:w-[120px]" value={filter.view} onValueChange={(value) => setFilterField('view', value)} options={VIEWS} />
      <Button variant="default" size="lg" onClick={outstanding.load}><RefreshCw /> Refresh</Button>
      <Button variant="secondary" size="lg" onClick={outstanding.exportExcel}><Download /> Excel</Button>
    </ActionBar>
  );
}

// receivable / payable open bills (FIFO + bill-wise set-offs), ageing tiles that filter, the party view with its bills
export function OutstandingScreen() {
  const navigate = useNavigate();
  const outstanding = useOutstanding();
  const { filter, setFilterField, data, msg, setMsg, bills, shown, parties, totalOf, receivable } = outstanding;
  const [send, setSend] = useState(null);
  const [voucherId, setVoucherId] = useState(null);

  // a bill that is a GST invoice opens as a PDF (Print, Download, Mail, WhatsApp)
  const pdf = async (bill, download) => {
    try { await openInvoicePdf(bill.voucherId, download); } catch (error) { setMsg('Invoice ' + bill.refNo + ': ' + errorMessage(error)); }
  };
  const billActions = { pdf, send: (id, mode) => setSend({ voucherId: id, mode }), showVoucher: setVoucherId };
  const billNo = (bill) => <BillNo bill={bill} openVoucherId={voucherId} actions={billActions} />;
  const tiles = [
    { key: '', label: receivable ? 'Total receivable' : 'Total payable', value: '₹ ' + inr(totalOf(''), 0), sub: bills.length + ' bills, ' + new Set(bills.map((bill) => bill.ledgerId)).size + ' parties' },
    ...AGE.map(([key, label]) => ({ key, label, value: '₹ ' + inr(totalOf(key), 0), tone: AGE_TONE[key], sub: bills.filter((bill) => bill.age === key).length + ' bills' })),
  ];

  return (
    <>
      {send && <InvoiceSend voucherId={send.voucherId} mode={send.mode} onClose={() => setSend(null)} />}
      {voucherId && <VoucherDrawer id={voucherId} ids={shown.map((bill) => bill.voucherId)} onMove={setVoucherId} onClose={() => setVoucherId(null)} />}
      <Sheet tabs={[{ id: 'o', label: 'Outstanding' }]} tab="o" onTab={() => {}}>
        <OutstandingToolbar outstanding={outstanding} />
        {!data && !msg && <div className="tw:p-3 tw:text-entry tw:text-muted-foreground">Loading</div>}
        {data && (
          <>
            <Tiles active={filter.age} onPick={(age) => setFilterField('age', age)} items={tiles} />
            {data.basis && <div className="tw:text-[10.5px] tw:text-muted-foreground">{data.basis}{data.note ? ' - ' + data.note : ''}. Click an ageing box to show only those bills.</div>}
            {filter.view === 'party' ? (
              <Grid title={'Parties (' + parties.length + ')'} maxHeight="calc(100vh - 420px)" rows={parties} rowKey={(party) => party.ledgerId}
                empty={bills.length ? 'Nothing matches the filter' : 'Nothing outstanding on this date'} cols={partyColumns({ outstanding, billNo, navigate })}
                foot={['', 'Total', shown.length, <Money key="total" v={pendingSum(shown)} strong />, ...AGE.map(([key]) => inr(pendingSum(shown.filter((bill) => bill.age === key)))), '', '']} />
            ) : (
              <Grid title={'Bills (' + shown.length + ')'} maxHeight="calc(100vh - 420px)" rows={shown} rowKey={(bill) => bill.id} empty="Nothing matches the filter"
                cols={billColumns(billNo)} foot={['Total', '', '', '', '', <Money key="total" v={pendingSum(shown)} strong />, '', '']} />
            )}
          </>
        )}
      </Sheet>
    </>
  );
}
