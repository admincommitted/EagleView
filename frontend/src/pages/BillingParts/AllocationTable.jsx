import { cn } from '@/lib/utils';
import { DataTable, Input, NumberInput, SelectBox } from '@/components/ui';
import { TotalsBar } from '@/pages/PurchaseParts/POItemsTable';
import { removeColumn } from './lineColumns';
import { REF_TYPE_OPTIONS, isOverAllocated } from './paymentPostings';
import { amountOf, displayDate, inr } from './billingData';

const OVERDUE_HIGHLIGHT_DAYS = 60;

function RefNoCell({ row, onChange }) {
  const linkedBill = row.refType === 'AGAINST' && Boolean(row.againstVoucherId);
  return (
    <div className="tw:flex tw:min-w-[180px] tw:flex-col tw:gap-0.5">
      <Input data-allow-text="" value={row.refNo || ''} readOnly={linkedBill} placeholder={row.refType === 'AGAINST' ? '' : 'reference (optional)'}
        onChange={(event) => onChange(row.id, { refNo: event.target.value })} />
      <span className="tw:text-[10px] tw:text-muted-foreground">
        {row.date ? 'Bill date: ' + displayDate(row.date) : 'not against an existing bill'}
        {row.overdueDays > 0 ? ' · ' + row.overdueDays + ' days overdue' : ''}
      </span>
    </div>
  );
}

function AllocatedCell({ row, onChange }) {
  const over = isOverAllocated(row);
  return (
    <div className="tw:flex tw:min-w-[120px] tw:flex-col tw:gap-0.5">
      <NumberInput align="right" value={row.allocatedAmt} onValueChange={(allocatedAmt) => onChange(row.id, { allocatedAmt })}
        className={cn('tw:font-bold', over ? 'tw:border-destructive tw:text-destructive' : 'tw:border-success tw:text-success')} />
      {over && <span className="tw:text-[10px] tw:text-destructive">more than this bill&apos;s pending amount</span>}
    </div>
  );
}

/** The bill-by-bill knock-off grid; in forex mode the FCY box drives the INR allocation at the voucher's rate. */
export default function AllocationTable({ allocations, onAllocationsChange, enableForex, currency, roe, emptyText, totalAllocated }) {
  const changeRow = (id, changes) => onAllocationsChange(allocations.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const columns = [
    {
      key: 'refType', header: 'Type of Ref', className: 'tw:min-w-[120px]',
      cell: (row) => <SelectBox className="tw:w-full" options={REF_TYPE_OPTIONS} value={row.refType} onValueChange={(refType) => changeRow(row.id, { refType })} />,
    },
    { key: 'refNo', header: 'Name (Invoice No.)', cell: (row) => <RefNoCell row={row} onChange={changeRow} /> },
    {
      key: 'pendingAmt', header: 'Pending Amt', align: 'right', className: 'tw:font-bold tw:text-destructive',
      cell: (row) => (row.pendingAmt ? inr(row.pendingAmt) : '—'),
    },
    ...(enableForex ? [{
      key: 'fcyAmt', header: `Allocated (${currency})`, align: 'right',
      cell: (row) => (
        <NumberInput align="right" className="tw:min-w-[110px] tw:border-success tw:font-bold tw:text-success" value={row.fcyAmt}
          onValueChange={(fcyAmt) => changeRow(row.id, { fcyAmt, allocatedAmt: (amountOf(fcyAmt) * amountOf(roe)).toFixed(2) })} />
      ),
    }] : []),
    { key: 'allocatedAmt', header: 'Allocated (INR)', align: 'right', cell: (row) => <AllocatedCell row={row} onChange={changeRow} /> },
    removeColumn((id) => onAllocationsChange(allocations.filter((row) => row.id !== id))),
  ];

  return (
    <div>
      <DataTable columns={columns} rows={allocations} stickyHeader={false} emptyText={emptyText} className="tw:text-entry"
        rowClassName={(row) => row.overdueDays > OVERDUE_HIGHLIGHT_DAYS && 'tw:bg-destructive/5'} />
      <TotalsBar totals={[{ label: 'Total Allocated:', value: '₹ ' + inr(totalAllocated) }]} className="tw:normal-case tw:text-success" />
    </div>
  );
}
