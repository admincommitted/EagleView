import { Field, NumberInput } from '@/components/ui';
import LedgerPicker from './LedgerPicker';
import { amountOf } from './billingData';

/**
 * deductions: [{ amountKey, ledgerKey, label, placeholder, ledgerPlaceholder, negative }]. Once an amount is typed the
 * ledger it posts to has to be picked, so nothing is routed to a head the user did not choose.
 */
export default function DeductionFields({ deductions, form, onChange, ledgers }) {
  return deductions.map((deduction) => (
    <Field key={deduction.amountKey} layout="col" label={deduction.label}>
      <div className="tw:flex tw:w-full tw:flex-col tw:gap-1.5">
        <NumberInput negative={deduction.negative} className="tw:border-destructive/40" placeholder={deduction.placeholder || '0.00'}
          value={form[deduction.amountKey]} onValueChange={(value) => onChange(deduction.amountKey, value)} />
        {amountOf(form[deduction.amountKey]) !== 0 && (
          <LedgerPicker ledgers={ledgers} value={form[deduction.ledgerKey]} placeholder={deduction.ledgerPlaceholder}
            onChange={(value) => onChange(deduction.ledgerKey, value)} />
        )}
      </div>
    </Field>
  ));
}
