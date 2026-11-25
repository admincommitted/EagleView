import { DataTable } from '@/components/ui';
import { dayFirst } from '../AdvancedReportsParts/reportFormat';

const inr = (amount) => amount.toLocaleString('en-IN', { minimumFractionDigits: 2 });

const amountOf = (value) => parseFloat(value) || 0;

const amountColumn = (key, header, width, className) => ({
  key, header, width, align: 'right', className, cell: (voucher) => inr(amountOf(voucher[key])),
});

const REGISTER_COLUMNS = [
  { key: 'date', header: 'Date', width: '90px', cell: (voucher) => dayFirst(voucher.date) },
  {
    key: 'voucherNumber',
    header: 'Vch No.',
    width: '120px',
    className: 'tw:font-bold',
    cell: (voucher) => {
      const noTax = !(amountOf(voucher.cgst) || amountOf(voucher.sgst) || amountOf(voucher.igst));
      return (
        <>
          {voucher.voucherNumber}
          {noTax && (
            <span title="This voucher has no CGST / SGST / IGST line - nothing is assumed" className="tw:ml-1.5 tw:text-[10px] tw:font-normal tw:text-warning">
              no tax line
            </span>
          )}
        </>
      );
    },
  },
  { key: 'partyName', header: 'Party / Particulars', className: 'tw:font-semibold tw:whitespace-normal', cell: (voucher) => voucher.partyName || '-' },
  {
    key: 'gstin',
    header: 'GSTIN/UIN',
    width: '130px',
    cell: (voucher) => voucher.gstin || <span className="tw:text-muted-foreground">Unregistered</span>,
  },
  amountColumn('taxable', 'Taxable Value', '120px', 'tw:font-medium'),
  amountColumn('cgst', 'CGST', '100px', 'tw:text-primary'),
  amountColumn('sgst', 'SGST', '100px', 'tw:text-primary'),
  amountColumn('igst', 'IGST', '100px', 'tw:text-primary'),
  amountColumn('total', 'Total Amount', '120px', 'tw:font-bold'),
];

export default function GstRegisterTable({ vouchers, returnType }) {
  return (
    <DataTable
      columns={REGISTER_COLUMNS}
      rows={vouchers}
      stickyHeader={false}
      emptyText={`No records found for ${returnType}.`}
    />
  );
}
