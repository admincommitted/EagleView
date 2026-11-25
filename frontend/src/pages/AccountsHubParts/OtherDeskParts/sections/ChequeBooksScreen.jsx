import { useNavigate } from 'react-router-dom';
import { Ban, Download, Pencil, RotateCcw, Save, Trash2, Undo2, X } from 'lucide-react';
import { Button, DateInput, Field, Input, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ActionBar, Badge, Box, Btn, Empty, Grid, LedgerPicker, Money, fmtDate } from '../../ui';
import { saveCsvColumns } from '../../ReportsDeskParts/csvFile';
import { useChequeBooks } from '../hooks/useChequeBooks';
import { StatStrip } from './StatStrip';

const BOOK_STATUSES = ['IN USE', 'FINISHED', 'CANCELLED'];
const LEAF_FILTERS = ['', 'UNUSED', 'ISSUED', 'CANCELLED'];
const LEAF_TONES = { ISSUED: 'ok', CANCELLED: 'bad' };
const BOOK_TONES = { 'IN USE': 'ok', CANCELLED: 'bad' };
const LEAF_CSV = [['chequeNo', 'Cheque No'], ['status', 'Status'], ['date', 'Date'], ['voucherNumber', 'Voucher'], ['party', 'Party'], ['amount', 'Amount'], ['reason', 'Reason']];

function BookList({ books, activeId, onOpen }) {
  return (
    <div className="tw:max-h-[calc(100vh-260px)] tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-background">
      <div className="tw:border-b tw:border-border tw:px-2.5 tw:py-2 tw:text-[11px] tw:font-extrabold tw:text-head tw:uppercase">Cheque books</div>
      {books.map((book) => {
        const active = String(activeId) === String(book.id);
        const usedPercent = book.total ? Math.round((book.issued + book.cancelled) / book.total * 100) : 0;
        return (
          <Button key={book.id} variant="ghost" size="block" onClick={() => onOpen(book)}
            className={cn('tw:flex-col tw:items-stretch tw:gap-0 tw:rounded-none tw:border-0 tw:border-b tw:border-l-[3px] tw:border-b-border tw:border-l-transparent', active && 'tw:border-l-primary tw:bg-primary/10')}>
            <div className="tw:flex tw:justify-between tw:gap-1.5">
              <b className="tw:text-[11.5px]">{book.bankName || 'Bank #' + book.bankLedgerId}</b>
              <Badge tone={BOOK_TONES[book.status] || 'muted'}>{book.status || 'IN USE'}</Badge>
            </div>
            <div className="tw:mt-0.5 tw:mb-1 tw:text-[10.5px] tw:text-muted-foreground">{book.bookNo ? 'Book ' + book.bookNo + ', ' : ''}{book.fromNo} to {book.toNo}</div>
            <div className="tw:h-1.5 tw:overflow-hidden tw:rounded-sm tw:bg-muted">
              <div className="tw:h-full tw:w-(--used) tw:bg-primary" style={{ '--used': usedPercent + '%' }} />
            </div>
            <div className="tw:mt-0.5 tw:flex tw:justify-between tw:text-[10px] tw:text-muted-foreground">
              <span>{book.issued} issued, {book.unused} left</span>
              <span>Next <b className="tw:text-foreground">{book.nextNo || '-'}</b></span>
            </div>
          </Button>
        );
      })}
      {!books.length && <div className="tw:p-5 tw:text-center tw:text-[11.5px] tw:text-muted-foreground">No cheque books yet</div>}
    </div>
  );
}

function BookForm({ cheques }) {
  const { form, setField, banks } = cheques;
  const textField = (key, label, extra) => (
    <Field label={label} required={extra?.required} layout="col">
      <Input data-allow-text value={form[key] || ''} onChange={(event) => setField(key)(event.target.value)} required={extra?.required && !form[key]} placeholder={extra?.placeholder} />
    </Field>
  );
  return (
    <Box title={form.id ? 'Cheque book - ' + (form.bankName || '') : 'New cheque book'}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-2.5 tw:sm:grid-cols-3 tw:xl:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
        <Field label="Bank" required layout="col" className="tw:sm:col-span-3 tw:xl:col-span-1">
          <LedgerPicker id="cbbank" list={banks} value={form.bankLedgerId} onChange={setField('bankLedgerId')} placeholder="Bank ledger" mandatory />
        </Field>
        {textField('bookNo', 'Book No')}
        {textField('fromNo', 'From Cheque', { required: true, placeholder: '000101' })}
        {textField('toNo', 'To Cheque', { required: true, placeholder: '000150' })}
        <Field label="Received On" layout="col"><DateInput value={form.issuedOn ? String(form.issuedOn).slice(0, 10) : ''} onValueChange={setField('issuedOn')} /></Field>
        <Field label="Status" layout="col"><SelectBox options={BOOK_STATUSES} value={form.status || 'IN USE'} onValueChange={setField('status')} /></Field>
      </div>
    </Box>
  );
}

function LeafAction({ leaf, cheques }) {
  if (leaf.status === 'CANCELLED') return <Btn small kind="ghost" onClick={() => cheques.markLeaf(leaf.chequeNo, 'restore')}><Undo2 size={11} /> Restore</Btn>;
  if (leaf.status !== 'UNUSED') return null;
  if (cheques.cancelAt !== leaf.chequeNo) return <Btn small kind="ghost" onClick={() => cheques.startCancel(leaf.chequeNo)}><Ban size={11} /> Cancel leaf</Btn>;
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1">
      <Input data-allow-text autoFocus className="tw:w-[150px]" value={cheques.reason} onChange={(event) => cheques.setReason(event.target.value)} placeholder="Reason" />
      <Btn small kind="danger" onClick={() => cheques.markLeaf(leaf.chequeNo, 'cancel')}>Cancel</Btn>
      <Btn small kind="ghost" onClick={() => cheques.setCancelAt(null)}><X size={11} /></Btn>
    </span>
  );
}

function LeavesGrid({ cheques }) {
  const navigate = useNavigate();
  const { form, shownLeaves, filter, setFilter } = cheques;
  return (
    <Grid title={'Cheque leaves (' + shownLeaves.length + ')'} maxHeight="calc(100vh - 470px)" rows={shownLeaves} rowKey={(leaf) => leaf.chequeNo}
      right={(
        <>
          {LEAF_FILTERS.map((status) => (
            <Button key={status} size="sm" variant={filter === status ? 'default' : 'ghost'} className="tw:rounded-full tw:text-[10.5px] tw:font-bold" onClick={() => setFilter(status)}>
              {status ? status[0] + status.slice(1).toLowerCase() : 'All'}
            </Button>
          ))}
          <Btn small kind="ghost" onClick={() => saveCsvColumns('Cheques_' + (form.bookNo || form.id), LEAF_CSV, shownLeaves)}><Download size={11} /> Excel</Btn>
        </>
      )}
      cols={[
        { label: 'Cheque No', render: (leaf) => <b>{leaf.chequeNo}</b> },
        { label: 'Status', render: (leaf) => <Badge tone={LEAF_TONES[leaf.status] || 'muted'}>{leaf.status}</Badge> },
        { label: 'Date', render: (leaf) => fmtDate(leaf.date) },
        { label: 'Voucher', render: (leaf) => (leaf.voucherId
          ? <Button variant="link" className="tw:font-bold tw:text-head" onClick={() => navigate('/accounts-hub?item=payment&voucher=' + leaf.voucherId)}>{leaf.voucherNumber}</Button>
          : '') },
        { label: 'Paid to', wrap: true, render: (leaf) => leaf.party || <span className="tw:text-muted-foreground">{leaf.reason}</span> },
        { label: 'Amount', right: true, render: (leaf) => (leaf.amount != null ? <Money v={leaf.amount} /> : '') },
        { label: '', render: (leaf) => <LeafAction leaf={leaf} cheques={cheques} /> },
      ]} />
  );
}

// Cheque Book Management - books per bank, every leaf (issued from payment vouchers, cancelled, unused), next cheque no
export function ChequeBooksScreen() {
  const cheques = useChequeBooks();
  const { form, totals } = cheques;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <StatStrip items={[
        ['Cheque books', cheques.books.length], ['Leaves', totals.total], ['Issued', totals.issued, 'success'],
        ['Cancelled', totals.cancelled, totals.cancelled ? 'danger' : null], ['Unused', totals.unused, 'primary'],
      ]} />
      <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-3 tw:lg:grid-cols-[minmax(270px,340px)_minmax(0,1fr)]">
        <BookList books={cheques.books} activeId={form.id} onOpen={cheques.openBook} />
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2.5">
          <BookForm cheques={cheques} />
          <ActionBar note={cheques.message}>
            <Btn kind="save" onClick={cheques.save} disabled={!!form.id}><Save size={13} /> Save</Btn>
            <Btn kind="save" onClick={cheques.save} disabled={!form.id}><Pencil size={13} /> Modify</Btn>
            <Btn kind="danger" onClick={cheques.remove} disabled={!form.id}><Trash2 size={13} /> Delete</Btn>
            <Btn kind="clear" onClick={cheques.clear}><RotateCcw size={13} /> Clear</Btn>
          </ActionBar>
          {form.id && <LeavesGrid cheques={cheques} />}
          {!form.id && <Empty title="Pick a cheque book on the left to see every leaf">Issued cheques are read from payment vouchers of that bank whose cheque no is in the book.</Empty>}
        </div>
      </div>
    </div>
  );
}
