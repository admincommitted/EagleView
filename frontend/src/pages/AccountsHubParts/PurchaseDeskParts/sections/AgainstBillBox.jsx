import { Copy } from 'lucide-react';
import { Field, Input, SelectBox } from '@/components/ui';
import { Box, Btn, fmtDate, inr } from '../../ui';

const billLabel = (bill) => (bill.billNo || '-') + ' / ' + bill.voucherNumber + ' / ' + fmtDate(bill.date) + ' / ' + inr(bill.amount) + (bill.credited ? ' (credited ' + inr(bill.credited) + ')' : '');

// the vendor bill a credit note is set against
export function AgainstBillBox({ form }) {
  const { bill, bills, header, setHeaderField, vendor } = form;
  const placeholder = vendor ? (bills.length ? 'Choose the bill' : 'No bills of this vendor') : 'Choose the party first';
  // a bill with nothing left to credit can't be picked (unless it is the one already chosen)
  const options = bills
    .filter((item) => item.left > 0 || String(item.id) === String(header.against))
    .map((item) => ({ value: item.id, label: billLabel(item) }));
  const amountField = (label, value, className = 'tw:text-right') => (
    <Field label={label} layout="col"><Input readOnly className={className} value={bill ? inr(value) : ''} /></Field>
  );
  return (
    <Box title="Against Bill" right={bill ? <Btn small kind="ghost" onClick={form.copyFromBill}><Copy size={11} /> Copy charges from this bill</Btn> : null}>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] tw:items-end tw:gap-2.5">
        <Field label="Bill" required layout="col" className="tw:sm:col-span-2">
          <SelectBox options={options} value={header.against} onValueChange={setHeaderField('against')} disabled={!vendor} required={!bill} placeholder={placeholder} />
        </Field>
        {amountField('Bill Amount', bill?.amount)}
        {amountField('Already Credited', bill?.credited)}
        {amountField('Can Still Credit', bill?.left, 'tw:text-right tw:font-extrabold')}
        <Field label="Reason" layout="col" className="tw:sm:col-span-2">
          <Input data-allow-text value={header.cnReason} onChange={(event) => setHeaderField('cnReason')(event.target.value)} placeholder="Rate difference, short shipment, discount ..." />
        </Field>
      </div>
    </Box>
  );
}
