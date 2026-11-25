import { Plus } from 'lucide-react';
import { ComboInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { Box, Btn, LedgerPicker, inr } from '../../ui';
import { ExcelButtons } from '../../extras';
import { num } from '../../VoucherDeskParts/amounts';
import { CURRENCIES } from '../../VoucherDeskParts/voucherConfig';
import { GST_SLAB_OPTIONS, PAY_REC_OPTIONS } from '../purchaseConfig';

const chargeSub = (charge) => [charge.sacCode, charge.gstRate != null && charge.gstRate + '%'].filter(Boolean).join(' - ');
// every word typed, anywhere in the charge name
const chargeMatches = (charge, query) => {
  const name = String(charge.chargeName || '').toUpperCase();
  return query.toUpperCase().split(/\s+/).filter(Boolean).every((word) => name.includes(word));
};

const ReadOnlyAmount = ({ label, value, className = 'tw:text-right' }) => (
  <Field label={label} layout="col"><Input readOnly className={className} value={value} /></Field>
);

// one charge: what it is, the expense ledger, currency, rate and GST - with Add
export function ChargeEntryBox({ form }) {
  const { charge, setChargeField, chargeTotals, chargeGst, look, header, noTax, cfg } = form;
  const inRupees = charge.currency === 'INR';
  const addOnEnter = (event) => event.key === 'Enter' && form.add();
  const textInput = (key, extra) => <Input data-allow-text value={charge[key]} onChange={(event) => setChargeField(key)(event.target.value)} {...extra} />;
  return (
    <Box>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="Charge" required layout="col" className="tw:sm:col-span-2">
          <ComboInput options={look.charges} value={charge.charge || ''} onValueChange={form.pickCharge} onSelect={(picked) => form.pickCharge(picked.chargeName)}
            getValue={(item) => item.chargeName} getLabel={chargeSub} filter={chargeMatches} limit={80} required={!charge.charge} placeholder="Air freight, THC, CHA ..."
            renderOption={(item) => (
              <div className="tw:flex tw:min-w-0 tw:flex-col">
                <span className="tw:font-bold">{item.chargeName}</span>
                {chargeSub(item) && <span className="tw:text-[10px] tw:text-muted-foreground">{chargeSub(item)}</span>}
              </div>
            )} />
        </Field>
        <Field label="SAC" layout="col">{textInput('sac')}</Field>
        <Field label="Pay / Rec" layout="col"><SelectBox options={PAY_REC_OPTIONS} value={charge.pr} onValueChange={setChargeField('pr')} /></Field>
        <Field label="Expense Ledger" required layout="col" className="tw:sm:col-span-2">
          <LedgerPicker id="pl" list={look.expenses.length ? look.expenses : look.all} value={charge.ledgerId} onChange={setChargeField('ledgerId')} placeholder="Expense ledger" mandatory />
        </Field>
        <Field label="Currency" layout="col"><SelectBox options={CURRENCIES} value={charge.currency} onValueChange={form.setChargeCurrency} /></Field>
        <Field label="Ex.Rate" layout="col"><NumberInput readOnly={inRupees} value={charge.roe} onValueChange={setChargeField('roe')} /></Field>
        <Field label="Quantity" layout="col"><NumberInput align="right" value={charge.qty} onValueChange={setChargeField('qty')} /></Field>
        <Field label="Rate" required layout="col">
          <NumberInput align="right" required={!num(charge.rate)} value={charge.rate} onValueChange={setChargeField('rate')} onKeyDown={addOnEnter} />
        </Field>
        <ReadOnlyAmount label="Amt. (FC)" value={inRupees ? '' : inr(chargeTotals.fcAmt)} />
        <ReadOnlyAmount label="Amount (INR)" value={inr(chargeTotals.tx)} className="tw:text-right tw:font-extrabold" />
        <Field label="GST %" layout="col"><SelectBox options={GST_SLAB_OPTIONS} value={charge.gstRate} onValueChange={setChargeField('gstRate')} disabled={noTax} /></Field>
        <ReadOnlyAmount label="SGST Amt" value={inr(chargeGst.sgst)} />
        <ReadOnlyAmount label="CGST Amt" value={inr(chargeGst.cgst)} />
        <ReadOnlyAmount label="IGST Amt" value={inr(chargeGst.igst)} />
        <Field label="Docket No" layout="col">{textInput('jobNo', { placeholder: header.jobNo || 'Same as bill' })}</Field>
        <Field label="Charge Narration" layout="col" className="tw:sm:col-span-2">{textInput('remarks')}</Field>
        <ReadOnlyAmount label="Invoice Amount" value={inr(cfg.rcm ? chargeTotals.tx : chargeTotals.tx + chargeTotals.gst)} />
        <div className="tw:flex tw:justify-end"><Btn kind="primary" onClick={form.add}><Plus size={13} /> {form.editAt >= 0 ? 'Update' : 'Add'}</Btn></div>
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <ExcelButtons label="Read charges from Excel" onFile={form.readXl} onSample={form.downloadSample} />
      </div>
    </Box>
  );
}
