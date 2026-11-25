import { Field, Input } from '@/components/ui';
import { BalanceStrip, Box, Grid, Money, PostingTable, inr } from '../../ui';
import { num } from '../amounts';
import { useCashForm } from '../hooks/useCashForm';
import { CashEntryStrip } from './CashEntryStrip';
import { CashHeaderBoxes } from './CashHeaderBoxes';
import { editColumns } from './editColumns';
import { FormActions } from './FormActions';
import { Notice } from './Notice';

function CashEntriesGrid({ form, cfg }) {
  const { nameOf } = form;
  return (
    <Grid title="Accounts Information" maxHeight={260} empty="Choose the account and amount above, then click Add" rows={form.entries}
      cols={[
        ...editColumns({ onEdit: (_, index) => form.editEntry(index), onDelete: (_, index) => form.removeEntry(index) }),
        { label: 'Account Name', wrap: true, render: (entry) => <b>{nameOf(entry.ledgerId)}</b> },
        { label: 'Debit', right: true, render: (entry) => (cfg.partySide === 'Dr' ? <Money v={entry.amount} side="Dr" /> : '') },
        { label: 'Credit', right: true, render: (entry) => (cfg.partySide === 'Cr' ? <Money v={entry.amount} side="Cr" /> : '') },
        { label: 'Currency', render: (entry) => (entry.currency !== 'INR' ? `${entry.currency} ${inr(entry.fcy)} @ ${entry.roe}` : 'INR') },
        { label: 'Docket No', render: (entry) => entry.jobNo },
        { label: 'TDS Account', render: (entry) => nameOf(entry.tdsLedger) },
        { label: 'TDS Amt', right: true, render: (entry) => (num(entry.tdsAmt) ? inr(entry.tdsAmt) : '') },
        { label: 'Bank Chg', right: true, render: (entry) => (num(entry.chgAmt) ? inr(entry.chgAmt) : '') },
        { label: 'Bills Set Off', right: true, render: (entry) => { const total = form.allocatedOf(entry); return total ? inr(total) : <span className="tw:text-muted-foreground">On account</span>; } },
      ]} />
  );
}

function CashTotals({ form }) {
  const readOnlyTotal = (label, value, className) => (
    <Field label={label} layout="col"><Input readOnly className={className} value={value} /></Field>
  );
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-3 tw:lg:grid-cols-[minmax(0,3fr)_repeat(3,minmax(120px,1fr))]">
        <Field label="Narration" layout="col" className="tw:sm:col-span-3 tw:lg:col-span-1">
          <Input data-allow-text value={form.header.narration} onChange={(event) => form.setHeaderField('narration')(event.target.value)} placeholder="Leave blank to write it from the accounts and cheque" />
        </Field>
        {readOnlyTotal('Book Total', inr(form.bookTotal), 'tw:text-right tw:font-extrabold')}
        {readOnlyTotal('Total TDS', inr(form.totalTds), 'tw:text-right')}
        {readOnlyTotal('Accounts', form.entries.length, 'tw:text-right')}
      </div>
    </Box>
  );
}

// receipt / payment / remittance
export function CashForm({ cfg, typeId, onSaved, onClear, initial, editId, actions }) {
  const form = useCashForm({ cfg, typeId, initial, editId, onSaved });
  return (
    <>
      <CashHeaderBoxes form={form} editId={editId} />
      <CashEntryStrip form={form} cfg={cfg} />
      <CashEntriesGrid form={form} cfg={cfg} />
      <CashTotals form={form} />
      {form.posting.length > 0 && <PostingTable title="This will post" lines={form.posting.map((line) => ({ ...line, ledgerName: form.nameOf(line.ledgerId) }))} />}
      <BalanceStrip dr={form.dr} cr={form.cr} />
      {editId && (
        <Notice>
          Modifying {cfg.title} {initial.voucherNumber}. Bills set off are shown as saved - Fetch Due Bills to set off more. After saving the voucher goes back for approval.
        </Notice>
      )}
      <FormActions editId={editId} saving={form.saving} onSave={form.save} onClear={onClear} actions={actions} message={form.message} />
    </>
  );
}
