import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { Button, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { ActionBar, Box, Btn, Grid, LedgerPicker, Money, inr } from '../../ui';
import { DR_CR } from '../../VoucherDeskParts/voucherConfig';
import { useIbRaise } from '../hooks/useIbRaise';
import { IB_TYPES } from '../otherConfig';

const debitCreditColumns = (amountOf) => [
  { label: 'Debit', right: true, render: (line) => (line.dc === 'Dr' ? <Money v={amountOf(line)} side="Dr" /> : '') },
  { label: 'Credit', right: true, render: (line) => (line.dc === 'Cr' ? <Money v={amountOf(line)} side="Cr" /> : '') },
];

function TransferBox({ raise, branches }) {
  const { transfer, setField, journal, look } = raise;
  const branchOptions = (list) => list.map((branch) => ({ value: branch.code, label: branch.code + ' - ' + branch.name }));
  const fromLabel = journal ? 'Your Account (other side)' : transfer.type === 'cash' ? 'From Cash' : 'From Bank';
  const fromPlaceholder = journal ? 'Account in your branch' : transfer.type === 'cash' ? 'Cash in hand' : 'Bank account';
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="From Branch" required layout="col">
          <SelectBox options={branchOptions(branches)} value={transfer.fromBranch} onValueChange={setField('fromBranch')} placeholder="Select" required={!transfer.fromBranch} />
        </Field>
        <Field label="To Branch" required layout="col">
          <SelectBox options={branchOptions(branches.filter((branch) => branch.code !== transfer.fromBranch))} value={transfer.toBranch} onValueChange={setField('toBranch')} placeholder="Select" required={!transfer.toBranch} />
        </Field>
        <Field label="Date" required layout="col"><DateInput value={transfer.date} onValueChange={setField('date')} /></Field>
        <Field label={fromLabel} required layout="col" className="tw:sm:col-span-2">
          <LedgerPicker id="ibfrom" list={raise.fromList.length ? raise.fromList : look.all} value={transfer.fromLedgerId} onChange={setField('fromLedgerId')} placeholder={fromPlaceholder} mandatory />
        </Field>
        {journal
          ? <Field label="Amount" layout="col"><Input readOnly className="tw:text-right tw:font-extrabold" value={inr(raise.amount)} /></Field>
          : <Field label="Amount" required layout="col"><NumberInput align="right" required={!(Number(transfer.amount) > 0)} value={transfer.amount} onValueChange={setField('amount')} /></Field>}
        <Field label={transfer.type === 'bank' ? 'UTR / Chq No' : 'Ref No'} layout="col">
          <Input data-allow-text value={transfer.refNo} onChange={(event) => setField('refNo')(event.target.value)} />
        </Field>
        <Field label="Narration" layout="col" className="tw:sm:col-span-2">
          <Input data-allow-text value={transfer.narration} onChange={(event) => setField('narration')(event.target.value)} placeholder="Leave blank to write it from the type and branch" />
        </Field>
      </div>
    </Box>
  );
}

function OtherBranchEntries({ raise }) {
  const { transfer, entry, setEntryField, net } = raise;
  return (
    <>
      <Box title={'Entries ' + (transfer.toBranch || 'the other branch') + ' should book'}>
        <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:items-end tw:gap-2.5">
          <Field label="Account" required layout="col" className="tw:sm:col-span-2">
            <LedgerPicker id="ibto" list={raise.look.all} value={entry.ledgerId} onChange={setEntryField('ledgerId')} placeholder="Expense, income, party ..." mandatory />
          </Field>
          <Field label="Dr / Cr" layout="col"><SelectBox options={DR_CR} value={entry.dc} onValueChange={setEntryField('dc')} /></Field>
          <Field label="Amount" required layout="col">
            <NumberInput align="right" value={entry.amount} onValueChange={setEntryField('amount')} onKeyDown={(event) => event.key === 'Enter' && raise.add()} />
          </Field>
          <Field label="Remarks" layout="col" className="tw:sm:col-span-2">
            <Input data-allow-text value={entry.remarks} onChange={(event) => setEntryField('remarks')(event.target.value)} />
          </Field>
          <div className="tw:flex tw:justify-end"><Btn kind="primary" onClick={raise.add}><Plus size={13} /> Add</Btn></div>
        </div>
      </Box>
      <Grid title="Other branch entries" maxHeight={220} rows={raise.lines} empty="Add what the other branch should book - e.g. their expense, paid by you"
        cols={[
          { label: 'Delete', w: 48, render: (_, index) => <Button variant="ghost" size="icon-sm" title="Delete" className="tw:text-destructive" onClick={() => raise.removeLine(index)}><Trash2 /></Button> },
          { label: 'Account', wrap: true, render: (line) => <b>{raise.nameOf(line.ledgerId)}</b> },
          ...debitCreditColumns((line) => line.amount),
          { label: 'Remarks', wrap: true, render: (line) => line.remarks },
        ]}
        foot={['', 'BRANCH A/C - ' + (transfer.fromBranch || '?') + ' (their side)', net < 0 ? <Money key="dr" v={-net} side="Dr" strong /> : '', net > 0 ? <Money key="cr" v={net} side="Cr" strong /> : '', '']} />
    </>
  );
}

// Raise transfer - Bank Transfer / Journal / Cash Transfer
export function IbRaise({ branches, myBranch, onDone }) {
  const raise = useIbRaise({ myBranch, onDone });
  const { transfer } = raise;
  return (
    <>
      <div className="tw:inline-flex tw:self-start tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-background">
        {IB_TYPES.map(([type, label]) => (
          <Button key={type} variant={transfer.type === type ? 'default' : 'ghost'} className="tw:rounded-none tw:font-extrabold" onClick={() => raise.pickType(type)}>{label}</Button>
        ))}
      </div>
      <TransferBox raise={raise} branches={branches} />
      {raise.journal && <OtherBranchEntries raise={raise} />}
      {raise.preview.length > 0 && (
        <Grid title={'Your branch (' + (transfer.fromBranch || '?') + ') will post now'} maxHeight={140} rows={raise.preview}
          cols={[{ label: 'Account', render: (line) => <b>{line.ledgerName}</b> }, ...debitCreditColumns((line) => line.amount)]} />
      )}
      <ActionBar note={raise.message}>
        <Btn kind="save" onClick={raise.save} disabled={raise.saving}><Save size={13} /> {raise.saving ? 'Saving' : 'Raise transfer'}</Btn>
        <Btn kind="clear" onClick={raise.clear}><RotateCcw size={13} /> Clear</Btn>
      </ActionBar>
    </>
  );
}
