import { Edit, Trash2 } from 'lucide-react';
import { Button, DataTable } from '@/components/ui';
import { invoiceNoOf } from '../invoiceRules';

const showDate = (value) => {
  const parts = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || '').trim());
  if (!parts) return String(value || '').trim();
  const date = new Date(+parts[1], +parts[2] - 1, +parts[3]);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
};

const showRupees = (value) => (value ? Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// data-nodirty: a click in the list is not a change of the invoice form
export default function InvoiceListSection({ ctx }) {
  const { invoices, selectedId, openInvoice, deleteListedInvoice } = ctx;

  const columns = [
    {
      key: 'actions', header: 'Actions', align: 'center', width: 60,
      cell: (invoice, index) => (
        <span className="tw:inline-flex tw:items-center tw:gap-2">
          <Edit className="tw:size-3.5 tw:text-foreground" />
          <Button variant="ghost" size="icon-sm" title="Delete this invoice" aria-label="Delete this invoice" className="tw:text-destructive"
            onClick={(event) => { event.stopPropagation(); deleteListedInvoice(invoice, index); }}>
            <Trash2 />
          </Button>
        </span>
      ),
    },
    { key: 'serial', header: 'Inv Sr No.', cell: (invoice, index) => index + 1 },
    { key: 'no', header: 'Invoice No.', cell: invoiceNoOf },
    { key: 'date', header: 'Invoice Date', cell: (invoice) => showDate(invoice.date || invoice.invoiceDate) },
    { key: 'currency', header: 'Curr' },
    { key: 'value', header: 'Invoice Value', cell: (invoice) => invoice.value || invoice.invoiceValue },
    { key: 'invFobInr', header: 'FOB (INR)', align: 'right', cell: (invoice) => showRupees(invoice.invFobInr) },
    { key: 'contract', header: 'Nature of Contract', cell: (invoice) => invoice.contractType || invoice.natureOfContract },
    { key: 'buyer', header: 'Buyer Name', cell: (invoice) => invoice.buyer || invoice.buyerName },
  ];

  return (
    <div className="glass-panel tw:mb-0 tw:flex-none tw:p-1.5" data-nodirty="1">
      <DataTable
        columns={columns}
        rows={invoices}
        selectedKey={selectedId}
        onRowClick={openInvoice}
        rowTitle="Click to open this invoice"
        emptyText="No invoice yet - fill Invoice Details below and click Save"
        containerClassName="tw:h-[120px] tw:rounded-sm tw:border tw:border-border"
      />
    </div>
  );
}
