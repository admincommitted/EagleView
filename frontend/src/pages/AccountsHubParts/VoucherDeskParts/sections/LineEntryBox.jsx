import { Plus } from 'lucide-react';
import { DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { cn } from '@/lib/utils';
import { Box, Btn, LedgerPicker, inr } from '../../ui';
import { ExcelButtons } from '../../extras';
import { num } from '../amounts';
import { DR_CR } from '../voucherConfig';
import { CheckLabel } from './CheckLabel';

const GST_RATE_OPTIONS = ['5', '12', '18', '28'].map((rate) => ({ value: rate, label: rate + '%' }));
const GST_KIND_OPTIONS = [{ value: 'input', label: 'Input (purchase)' }, { value: 'output', label: 'Output (sale)' }];
const GST_PLACE_OPTIONS = [{ value: 'intra', label: 'Same state (CGST + SGST)' }, { value: 'inter', label: 'Other state (IGST)' }];

const textInput = (value, onChange, extra) => <Input data-allow-text value={value} onChange={(event) => onChange(event.target.value)} {...extra} />;

function TdsFields({ form }) {
  const { line, look } = form;
  const nature = form.tdsNature(line.tdsNatureId);
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-[minmax(180px,2fr)_minmax(110px,1fr)_minmax(90px,0.8fr)]">
      <Field label="TDS Section" required layout="col">
        <SelectBox placeholder="Select" required={!line.tdsNatureId} value={line.tdsNatureId} onValueChange={(value) => form.setTds({ tdsNatureId: value })}
          options={look.tds.map((item) => ({ value: item.id, label: `${item.section} - ${item.name} (${item.rate}%)` }))} />
      </Field>
      <Field label="TDS On Amount" required layout="col">
        <NumberInput align="right" required={!num(line.tdsBase)} value={line.tdsBase} onValueChange={(value) => form.setTds({ tdsBase: value })} />
      </Field>
      <Field label="Rate" layout="col"><Input readOnly className="tw:text-right" value={nature ? nature.rate + '%' : ''} /></Field>
    </div>
  );
}

function GstFields({ form }) {
  const { line, setLineField } = form;
  const madeLines = form.gstPreview.map(([kind, amount]) => kind.toUpperCase() + ' ' + inr(form.foreign ? amount * num(form.header.roe) : amount)).join(' + ');
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-2 tw:xl:grid-cols-[80px_minmax(110px,1fr)_minmax(150px,1.3fr)_minmax(90px,0.8fr)_minmax(140px,1.4fr)]">
      <Field label="GST %" layout="col"><SelectBox options={GST_RATE_OPTIONS} value={line.gstRate} onValueChange={setLineField('gstRate')} /></Field>
      <Field label="Input / Output" layout="col"><SelectBox options={GST_KIND_OPTIONS} value={line.gstKind} onValueChange={setLineField('gstKind')} /></Field>
      <Field label="Place Of Supply" layout="col"><SelectBox options={GST_PLACE_OPTIONS} value={line.gstPlace} onValueChange={setLineField('gstPlace')} /></Field>
      <Field label="SAC" layout="col">{textInput(line.sac, setLineField('sac'))}</Field>
      <Field label="GST Lines Made" layout="col"><Input readOnly className="tw:text-right" value={madeLines} /></Field>
    </div>
  );
}

// Ref date / amount, IS TDS (section + the amount it is on; the line posts to TDS Payable) and IS GST
function LineExtras({ form }) {
  const { line, setLineField } = form;
  return (
    <div className="tw:mt-2 tw:grid tw:grid-cols-1 tw:items-end tw:gap-2.5 tw:sm:grid-cols-2 tw:xl:grid-cols-[minmax(120px,1fr)_minmax(110px,1fr)_auto_minmax(0,3fr)]">
      <Field label="Ref Date" layout="col"><DateInput value={line.refDate} onValueChange={setLineField('refDate')} /></Field>
      <Field label="Ref Amount" layout="col"><NumberInput align="right" value={line.refAmt} onValueChange={setLineField('refAmt')} /></Field>
      <div className="tw:flex tw:gap-3 tw:pb-1">
        <CheckLabel checked={line.isTds} onChange={form.toggleTds}>IS TDS</CheckLabel>
        <CheckLabel checked={line.isGst} onChange={form.toggleGst}>IS GST</CheckLabel>
      </div>
      <div className="tw:min-w-0 tw:sm:col-span-2 tw:xl:col-span-1">
        {line.isTds && <TdsFields form={form} />}
        {line.isGst && <GstFields form={form} />}
        {!line.isTds && !line.isGst && (
          <div className="tw:pb-2 tw:text-[10.5px] tw:text-muted-foreground tw:normal-case">
            Tick IS TDS for a TDS line (section and the amount it is on), or IS GST to add the GST lines for this amount.
          </div>
        )}
      </div>
    </div>
  );
}

// the Account - Amount - Dr/Cr strip with Add
export function LineEntryBox({ form, cfg }) {
  const { line, setLineField, header, foreign, balance } = form;
  const addOnEnter = (event) => event.key === 'Enter' && form.add();
  const inrAmount = foreign ? num(line.amount) * num(header.roe) : num(line.amount);
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] tw:items-start tw:gap-2.5 tw:xl:grid-cols-[minmax(220px,2.4fr)_minmax(110px,1fr)_minmax(100px,0.9fr)_80px_minmax(110px,1fr)_minmax(110px,1fr)_minmax(130px,1.2fr)]">
        <Field label="Account Name" required layout="col" note={balance ? `Balance ${inr(balance.balance)} ${balance.side}${balance.groupName ? ' - ' + balance.groupName : ''}` : undefined}>
          <LedgerPicker id="jl" list={form.ledgerList} value={line.ledgerId} onChange={setLineField('ledgerId')} mandatory placeholder={cfg.banksOnly ? 'Bank / cash' : 'Party / ledger'} />
        </Field>
        <Field label={foreign ? 'Amount (' + header.currency + ')' : 'Amount'} required layout="col" note={foreign && num(line.amount) ? 'INR ' + inr(inrAmount) : undefined}>
          <NumberInput align="right" className="tw:font-extrabold" required={!num(line.amount)} value={line.amount} onValueChange={setLineField('amount')} onKeyDown={addOnEnter} />
        </Field>
        <Field label="INR Amount" layout="col"><Input readOnly className="tw:text-right" value={inr(inrAmount)} /></Field>
        <Field label="Dr/Cr" layout="col">
          <SelectBox options={DR_CR} value={line.dc} onValueChange={setLineField('dc')} className={cn('tw:font-extrabold', line.dc === 'Dr' ? 'tw:text-destructive' : 'tw:text-success')} />
        </Field>
        <Field label="Ref No" layout="col">{textInput(line.refNo, setLineField('refNo'))}</Field>
        <Field label="Docket No" layout="col">{textInput(line.jobNo, setLineField('jobNo'))}</Field>
        <Field label="Cost Center" layout="col">
          <SelectBox options={form.look.cc.map((centre) => ({ value: centre.id, label: centre.name }))} value={line.costCentreId} onValueChange={setLineField('costCentreId')} placeholder="Select" clearable clearLabel="Select" />
        </Field>
      </div>
      {!cfg.banksOnly && <LineExtras form={form} />}
      <div className="tw:mt-2 tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-end">
        <Field label="Line Narration" layout="col" className="tw:flex-1">{textInput(line.remarks, setLineField('remarks'), { onKeyDown: addOnEnter })}</Field>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <ExcelButtons onFile={form.readXl} onSample={form.downloadSample} />
          <Btn kind="primary" onClick={form.add}><Plus size={13} /> {form.editAt >= 0 ? 'Update' : 'Add'}</Btn>
        </div>
      </div>
    </Box>
  );
}
