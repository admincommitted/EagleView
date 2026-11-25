import { Button } from '@/components/ui';
import FormFields from './FormFields';
import Notice from './Notice';
import { money } from './fleetFormat';

const toOptions = (rows) => rows.map((row) => ({ value: row.id, label: row.name }));

function advanceFields(masters) {
  const ledgerOptions = toOptions(masters.ledgers);
  return [
    {
      name: 'voucherTypeId', label: 'Voucher type', kind: 'select', clearLabel: '-- pick --', options: toOptions(masters.paymentVoucherTypes),
      note: masters.paymentVoucherTypes.length ? undefined : <span className="tw:text-warning">No Payment voucher type exists - create one in Accounting Masters.</span>,
    },
    { name: 'debitLedgerId', label: 'Debit (driver / transporter advance)', kind: 'select', clearLabel: '-- pick --', options: ledgerOptions },
    { name: 'creditLedgerId', label: 'Credit (bank / cash)', kind: 'select', clearLabel: '-- pick --', options: ledgerOptions },
  ];
}

/** Posting a driver advance writes a real payment voucher, so the ledgers are picked here rather than guessed. */
export default function PostAdvancePanel({ trip, masters, ledgers, onLedgersChange, posting, onPost, onCancel }) {
  return (
    <Notice tone="warning" title={`Post the driver advance of ${money(trip.advanceToDriver)} on ${trip.lrNo}`}>
      <span className="tw:text-[11px]">This writes a real payment voucher, so the ledgers are picked rather than guessed.</span>
      <FormFields fields={advanceFields(masters)} values={ledgers} className="tw:gap-3 tw:text-foreground tw:md:grid-cols-3"
        onChange={(name, value) => onLedgersChange({ ...ledgers, [name]: value })} />
      <div className="tw:flex tw:flex-wrap tw:gap-3">
        <Button variant="success" disabled={posting} onClick={onPost}>{posting ? 'Posting...' : 'Post the voucher'}</Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </Notice>
  );
}
