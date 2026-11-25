import { cn } from '@/lib/utils';
import { DataTable } from '@/components/ui';
import { lineAmounts, rupees } from './purchaseFormat';

// The PO sheet is turned into a PDF by html2canvas, which cannot read color-mix() colours: the grid keeps to the
// plain theme colours (no tinted even rows, no tinted header border).
const PLAIN_CELL = 'tw:border-border';
const plainRow = () => 'tw:even:bg-background tw:hover:bg-background';

/** totals: [{ label, value }] on one right-aligned line under a grid. */
export function TotalsBar({ totals, className }) {
  return (
    <div className={cn('tw:flex tw:flex-wrap tw:items-baseline tw:justify-end tw:gap-x-6 tw:gap-y-1 tw:border tw:border-t-0 tw:border-border tw:bg-background tw:px-2 tw:py-2 tw:font-extrabold tw:uppercase tw:text-foreground', className)}>
      {totals.map((total) => (
        <span key={total.label} className="tw:flex tw:items-baseline tw:gap-2">
          <span className="tw:text-entry">{total.label}</span>
          <span className="tw:text-base tw:tabular-nums">{total.value}</span>
        </span>
      ))}
    </div>
  );
}

function itemColumns(itemHeader, showReceived) {
  return [
    {
      key: 'itemName', header: itemHeader, className: cn(PLAIN_CELL, 'tw:whitespace-normal'),
      cell: (item) => (
        <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <b>{item.itemName}</b>
          {showReceived && item.isReceived && (
            <span className="tw:rounded-full tw:border tw:border-success tw:px-1.5 tw:text-[10px] tw:font-bold tw:text-success">RECEIVED</span>
          )}
        </span>
      ),
    },
    { key: 'quantity', header: 'Qty', align: 'center', className: PLAIN_CELL },
    { key: 'unitPrice', header: 'Unit Price', align: 'right', className: PLAIN_CELL, cell: (item) => rupees(item.unitPrice) },
    { key: 'gstRate', header: 'GST %', align: 'center', className: PLAIN_CELL, cell: (item) => `${item.gstRate}%` },
    { key: 'gst', header: 'GST Amt', align: 'right', className: PLAIN_CELL, cell: (item) => rupees(lineAmounts(item).gst) },
    { key: 'total', header: 'Total', align: 'right', className: cn(PLAIN_CELL, 'tw:font-bold'), cell: (item) => rupees(lineAmounts(item).total) },
  ];
}

/** The items of a saved PO with their GST and the PO's grand total. */
export default function POItemsTable({ items, grandTotal, itemHeader = 'Item Name', showReceived = false, className }) {
  return (
    <div className={cn('tw:text-entry', className)}>
      <DataTable columns={itemColumns(itemHeader, showReceived)} rows={items} rowClassName={plainRow} stickyHeader={false}
        emptyText="No items" className="tw:text-entry" />
      <TotalsBar totals={[{ label: 'Grand Total:', value: rupees(grandTotal) }]} />
    </div>
  );
}
