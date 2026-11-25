import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { Grid, fmtDate, inr } from '../../ui';

// expenses booked on the docket, each can be billed with one click
export default function ExpensesSection({ jobNo, expenses, onBill, onClose }) {
  const columns = [
    { label: 'Voucher', render: (expense) => <b>{expense.voucherNumber}</b> },
    { label: 'Date', render: (expense) => fmtDate(expense.date) },
    { label: 'Type', key: 'baseType' },
    { label: 'Bill No', key: 'billNo' },
    { label: 'Charge', key: 'charge' },
    { label: 'Expense', right: true, render: (expense) => inr(expense.amount) },
    { label: 'Billed so far', right: true, render: (expense) => (expense.billed ? inr(expense.billed) : '') },
    { label: '', render: (expense) => <Button variant="secondary" onClick={() => onBill(expense)}><Plus /> Bill it</Button> },
  ];
  return (
    <Grid title={'Expenses booked on ' + jobNo} right={<Button variant="ghost" onClick={onClose}><X /> Close</Button>} maxHeight={200}
      empty="No expense booked on this docket yet" cols={columns} rows={expenses} />
  );
}
