import { DataTable } from '@/components/ui';

const inr = (amount) => amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 });

const taxColumns = (keys) => keys.map(([key, header]) => ({ key, header, align: 'right' }));

const TAX_HEADS = [['igst', 'Integrated Tax (IGST)'], ['cgst', 'Central Tax (CGST)'], ['sgst', 'State Tax (SGST)']];

const OUTWARD_COLUMNS = [
  { key: 'nature', header: 'Nature of Supplies', className: 'tw:whitespace-normal' },
  ...taxColumns([['taxable', 'Total Taxable Value'], ...TAX_HEADS]),
];

const ITC_COLUMNS = [
  { key: 'details', header: 'Details', className: 'tw:font-bold tw:whitespace-normal' },
  ...taxColumns(TAX_HEADS),
];

const amountsOf = (totals) => ({ taxable: inr(totals?.taxable), igst: inr(totals?.igst), cgst: inr(totals?.cgst), sgst: inr(totals?.sgst) });

function SummaryBlock({ title, columns, rows }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <h3 className="tw:m-0 tw:border-b-2 tw:border-border tw:pb-2 tw:text-[15px] tw:font-bold tw:normal-case tw:text-foreground">{title}</h3>
      <DataTable columns={columns} rows={rows} rowKey="key" stickyHeader={false} rowClassName={(row) => row.className} />
    </div>
  );
}

export default function Gstr3bSummary({ data }) {
  const outwardRows = [
    { key: 'a', nature: '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', ...amountsOf(data.outwardSupplies) },
    { key: 'b', nature: '(b) Outward taxable supplies (zero rated)', taxable: '0.00', igst: '0.00', cgst: '0.00', sgst: '0.00' },
  ];
  const itc = amountsOf(data.itcAvailable);
  const itcRows = [
    { key: 'A', details: '(A) ITC Available (whether in full or part)', ...itc },
    { key: 'C', details: '(C) Net ITC Available (A - B)', ...itc, className: 'tw:font-bold tw:text-success' },
  ];

  return (
    <div className="tw:flex tw:flex-col tw:gap-8 tw:bg-card tw:p-3 tw:md:p-6">
      <SummaryBlock title="3.1 Outward Supplies and Inward Supplies Liable to Reverse Charge" columns={OUTWARD_COLUMNS} rows={outwardRows} />
      <SummaryBlock title="4. Eligible ITC (Input Tax Credit)" columns={ITC_COLUMNS} rows={itcRows} />
    </div>
  );
}
