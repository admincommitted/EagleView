import { cn } from '@/lib/utils';
import { Badge, Grid, Money, inr } from '../../ui';
import { editColumns } from '../../VoucherDeskParts/sections/editColumns';

export function ChargesGrid({ form }) {
  const { lineGst, noTax, nameOf } = form;
  return (
    <Grid title="Charge Information" maxHeight={260} rows={form.totals.L}
      empty={form.creditNote ? 'Choose the bill and copy its charges, or enter them above' : 'Enter a charge and rate above, then Add'}
      cols={[
        ...editColumns({ onEdit: (_, index) => form.editLine(index), onDelete: (_, index) => form.removeLine(index) }),
        { label: 'Docket Number', render: (line) => line.jobNo },
        { label: 'Pay/Rec', render: (line) => <Badge tone={line.pr === 'Rec' ? 'warn' : 'brand'}>{line.pr || 'Pay'}</Badge> },
        { label: 'SAC', render: (line) => line.sac },
        { label: 'Charge Name', wrap: true, render: (line) => (
          <div>
            <b>{line.charge}</b>
            <div className={cn('tw:text-[10px]', line.ledgerId ? 'tw:text-muted-foreground' : 'tw:font-extrabold tw:text-destructive')}>
              {line.ledgerId ? nameOf(line.ledgerId) : 'Choose the expense ledger (Edit)'}
            </div>
          </div>
        ) },
        { label: 'Qty', right: true, render: (line) => line.qty },
        { label: 'Rate', right: true, render: (line) => inr(line.rate) },
        { label: 'Cur', render: (line) => (line.currency !== 'INR' ? line.currency + ' @ ' + line.roe : 'INR') },
        { label: 'Amount', right: true, render: (line) => <Money v={line.tx} /> },
        { label: 'GST %', right: true, render: (line) => (noTax ? '0%' : line.gstRate + '%') },
        { label: 'SGST', right: true, render: (line) => inr(lineGst(line).sgst) },
        { label: 'CGST', right: true, render: (line) => inr(lineGst(line).cgst) },
        { label: 'IGST', right: true, render: (line) => inr(lineGst(line).igst) },
        { label: 'Narration', wrap: true, render: (line) => line.remarks },
      ]} />
  );
}
