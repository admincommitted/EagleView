import { Field, Input } from '@/components/ui';

/** voucherNumber: what useVoucherNumber returns; the box is read-only while the type numbers itself. */
export default function VoucherNumberField({ voucherNumber, autoSuffix = '', baseType, hasType, className }) {
  const { number, setNumber, isAuto } = voucherNumber;
  return (
    <Field layout="col" label={`Voucher No.${isAuto ? autoSuffix : ' (manual)'}`} className={className}>
      <Input data-allow-text="" value={number} readOnly={isAuto} placeholder={hasType ? '' : `No ${baseType} voucher type yet`}
        onChange={(event) => setNumber(event.target.value)} />
    </Field>
  );
}
