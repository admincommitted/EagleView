import { ListChecks, Plus, Wand2 } from 'lucide-react';
import { Field, Input, NumberInput } from '@/components/ui';
import { Badge, Box, Btn, Grid, LedgerPicker, Money, fmtDate, inr } from '../../ui';
import { ExcelButtons } from '../../extras';
import { num } from '../amounts';

function DueBills({ form }) {
  const { bills, entry, allocTotal } = form;
  const overAllocated = allocTotal - num(entry.amount) > 0.01;
  return (
    <div className="tw:mt-2.5">
      <Grid title={'Due bills of ' + form.nameOf(entry.ledgerId)} maxHeight={220} empty="No open bills - the amount stays on account"
        rows={bills} rowKey={(bill) => bill.voucherId || bill.refNo}
        right={(
          <>
            {bills.length > 0 && <Btn small kind="ghost" onClick={form.autoAllocate}><Wand2 size={11} /> Oldest first</Btn>}
            <span className={overAllocated ? 'tw:text-destructive' : 'tw:text-head'}>Set off {inr(allocTotal)} of {inr(num(entry.amount))}</span>
          </>
        )}
        cols={[
          { label: 'Bill No', render: (bill) => bill.billNo || bill.refNo },
          { label: 'Date', render: (bill) => fmtDate(bill.date) },
          { label: 'Job', render: (bill) => bill.jobNo || '' },
          { label: 'Bill Amount', right: true, render: (bill) => <Money v={bill.amount} muted /> },
          { label: 'Pending', right: true, render: (bill) => <Money v={bill.pending} strong /> },
          { label: 'Days', right: true, render: (bill) => <span className={bill.overdueDays > 0 ? 'tw:text-destructive' : 'tw:text-muted-foreground'}>{bill.overdueDays || 0}</span> },
          { label: 'Set Off', right: true, w: 130, render: (bill) => (bill.held
            ? <span title={bill.held}><Badge tone="warn">On hold</Badge></span>
            : <NumberInput align="right" value={entry.allocs[bill.voucherId || bill.refNo] || ''} onValueChange={(value) => form.setAllocation(bill, value)} />) },
        ]} />
    </div>
  );
}

// docket, TDS, bank charge and remarks of the account being added, with Add and the due bills to set off
export function CashEntryStrip({ form, cfg }) {
  const { entry, setEntryField, look, pay } = form;
  const ledgerField = (key, label, placeholder, id) => (
    <Field label={label} layout="col" className="tw:sm:col-span-2">
      <LedgerPicker id={id} list={look.all} value={entry[key]} onChange={setEntryField(key)} placeholder={placeholder} />
    </Field>
  );
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="Docket / Job No" layout="col"><Input data-allow-text value={entry.jobNo} onChange={(event) => setEntryField('jobNo')(event.target.value)} placeholder="Optional" /></Field>
        {ledgerField('tdsLedger', 'TDS Account', pay ? 'TDS payable' : 'TDS receivable', 'tds')}
        <Field label="TDS Amt" layout="col"><NumberInput align="right" value={entry.tdsAmt} onValueChange={setEntryField('tdsAmt')} /></Field>
        {ledgerField('chgLedger', 'Bank Chg. A/c', 'Bank charges', 'chg')}
        <Field label="Bank Charge" layout="col"><NumberInput align="right" value={entry.chgAmt} onValueChange={setEntryField('chgAmt')} /></Field>
        <Field label="Bank Name (drawee)" layout="col"><Input data-allow-text value={form.header.drawee} onChange={(event) => form.setHeaderField('drawee')(event.target.value)} /></Field>
        <Field label="Remarks" layout="col" className="tw:sm:col-span-2"><Input data-allow-text value={entry.remarks} onChange={(event) => setEntryField('remarks')(event.target.value)} /></Field>
        <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:justify-end tw:gap-2 tw:md:col-span-3">
          <ExcelButtons onFile={form.readXl} onSample={form.downloadSample} />
          {!cfg.onAccount && <Btn kind="primary" onClick={form.fetchBills}><ListChecks size={13} /> Fetch Due Bills</Btn>}
          <Btn kind="primary" onClick={form.add}><Plus size={13} /> {form.editAt >= 0 ? 'Update' : 'Add'}</Btn>
        </div>
      </div>
      {form.bills && <DueBills form={form} />}
    </Box>
  );
}
