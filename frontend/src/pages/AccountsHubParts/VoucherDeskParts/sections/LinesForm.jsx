import { Field, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { BalanceStrip, Badge, Box, Grid, Money, fmtDate, inr } from '../../ui';
import { num } from '../amounts';
import { useLinesForm } from '../hooks/useLinesForm';
import { editColumns } from './editColumns';
import { FormActions } from './FormActions';
import { LineEntryBox } from './LineEntryBox';
import { LinesHeaderBox } from './LinesHeaderBox';

function AccountNameCell({ line, form }) {
  return (
    <div className={cn(line._parent && 'tw:pl-3.5')}>
      <b>{form.nameOf(line.ledgerId)}</b>{' '}
      {line.isTds && <Badge tone="warn">TDS {form.tdsNature(line.tdsNatureId)?.section}</Badge>}
      {line.isGst && !line._parent && <Badge tone="brand">GST {line.gstRate}%</Badge>}
      {line._parent && <span className="tw:text-[10px] tw:text-muted-foreground"> (GST of the line above)</span>}
    </div>
  );
}

function LinesGrid({ form, cfg }) {
  const { header, inrOf } = form;
  const lineNarration = (line) => (line._parent
    ? line.remarks
    : [line.isTds && form.tdsNature(line.tdsNatureId) && 'on ' + inr(num(line.tdsBase)), line.remarks].filter(Boolean).join(' - '));
  return (
    <Grid title="Accounts Information" maxHeight={300} empty="Enter an account and amount above, then Add. The next line starts with the difference." rows={form.lines}
      cols={[
        ...editColumns({ onEdit: form.editLine, onDelete: (_, index) => form.removeLine(index), hidden: (line) => !!line._parent }),
        { label: 'Account Name', wrap: true, render: (line) => <AccountNameCell line={line} form={form} /> },
        { label: 'Debit', right: true, render: (line) => (line.dc === 'Dr' ? <Money v={inrOf(line)} side="Dr" /> : '') },
        { label: 'Credit', right: true, render: (line) => (line.dc === 'Cr' ? <Money v={inrOf(line)} side="Cr" /> : '') },
        ...(form.foreign ? [
          { label: 'Curr', render: () => header.currency },
          { label: 'Ex Rate', right: true, render: () => header.roe },
          { label: 'FC Amount', right: true, render: (line) => inr(line.amount) },
        ] : []),
        { label: 'Ref No', render: (line) => line.refNo },
        ...(!cfg.banksOnly ? [
          { label: 'Ref Date', render: (line) => fmtDate(line.refDate) },
          { label: 'Ref Amt', right: true, render: (line) => (num(line.refAmt) ? inr(num(line.refAmt)) : '') },
        ] : []),
        { label: 'Docket No', render: (line) => line.jobNo },
        { label: 'Cost Center', render: (line) => form.costCentreName(line.costCentreId) },
        { label: 'Narration', wrap: true, render: lineNarration },
      ]}
      foot={['', '', 'Total', <Money key="dr" v={form.dr} side="Dr" strong />, <Money key="cr" v={form.cr} side="Cr" strong />]} />
  );
}

function LinesTotals({ form }) {
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-2 tw:lg:grid-cols-[minmax(0,3fr)_repeat(2,minmax(120px,1fr))]">
        <Field label="Narration" layout="col" className="tw:sm:col-span-2 tw:lg:col-span-1">
          <Input data-allow-text value={form.header.narration} onChange={(event) => form.setHeaderField('narration')(event.target.value)} />
        </Field>
        <Field label="Dr." layout="col"><Input readOnly className="tw:text-right tw:font-extrabold tw:text-destructive" value={inr(form.dr)} /></Field>
        <Field label="Cr." layout="col"><Input readOnly className="tw:text-right tw:font-extrabold tw:text-success" value={inr(form.cr)} /></Field>
      </div>
    </Box>
  );
}

// journal / contra / inter branch
export function LinesForm({ cfg, typeId, onSaved, onClear, initial, editId, actions }) {
  const form = useLinesForm({ cfg, typeId, initial, editId, onSaved });
  return (
    <>
      <LinesHeaderBox form={form} cfg={cfg} initial={initial} editId={editId} />
      <LineEntryBox form={form} cfg={cfg} />
      <LinesGrid form={form} cfg={cfg} />
      <LinesTotals form={form} />
      <BalanceStrip dr={form.dr} cr={form.cr} />
      <FormActions editId={editId} saving={form.saving} onSave={form.save} onClear={onClear} actions={actions} message={form.message} />
    </>
  );
}
