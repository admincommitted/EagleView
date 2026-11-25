import { useEffect } from 'react';
import { Copy, Download, Edit, FileText, RefreshCw } from 'lucide-react';
import askConfirm from '../../../../common/askConfirm';
import { Badge, Button, DataTable, FileButton, Label, NumberInput } from '@/components/ui';

const SCREEN_ONLY_FIELDS = new Set(['enterFilter', 'searchBy', 'searchByCert', 'searchByWh', 'cumulativeFreight', 'cumulativeInsurance', 'cumulativeMiscCharge', 'items']);

const sameText = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();

const amountOrRate = (amount, rate, currency) => {
  if (String(amount ?? '').trim()) return currency ? `${amount} ${currency}` : String(amount);
  return String(rate ?? '').trim() ? `${rate}%` : '';
};

const invoiceName = (invoice, fallback) => (invoice?.invNo ? `invoice ${invoice.invNo}` : fallback);

const INVOICE_COLUMNS = [
  { key: 'edit', header: 'Edit', align: 'center', width: 30, cell: () => <Edit className="tw:inline tw:size-3.5 tw:text-primary" /> },
  { key: 'srNo', header: 'Inv SrNo', width: 50, cell: (_, index) => index + 1 },
  { key: 'invNo', header: 'Invoice No' },
  { key: 'invDate', header: 'Invoice Date', cell: (invoice) => invoice.invDate || invoice.invoiceDate },
  { key: 'value', header: 'Value', align: 'right', cell: (invoice) => invoice.value || invoice.invValue },
  { key: 'currency', header: 'Currency', cell: (invoice) => (invoice.currency || invoice.invoiceCurrency) && <Badge variant="info" className="tw:rounded-sm">{invoice.currency || invoice.invoiceCurrency}</Badge> },
  { key: 'terms', header: 'Terms', cell: (invoice) => invoice.terms || invoice.termsOfInvoice },
  { key: 'freight', header: 'Freight', align: 'right', cell: (invoice) => amountOrRate(invoice.freightValue, invoice.freightRate, invoice.freightCurrency) },
  { key: 'insurance', header: 'Insurance', align: 'right', cell: (invoice) => amountOrRate(invoice.insuranceValue, invoice.insuranceRate, invoice.insuranceCurrency) },
  { key: 'misc', header: 'Miscellaneous', align: 'right', cell: (invoice) => amountOrRate(invoice.miscCharges, invoice.miscChargesRate, invoice.miscCurrency) },
  { key: 'hss', header: 'HSS', align: 'right', cell: (invoice) => amountOrRate(invoice.hssLoadAmount, invoice.hssLoadRate, invoice.hssCurrency) },
];

const CUMULATIVE_FIELDS = [
  { key: 'cumulativeFreight', label: 'Freight' },
  { key: 'cumulativeInsurance', label: 'Insurance' },
  { key: 'cumulativeMiscCharge', label: 'Misc' },
];

export default function EditSection({ ctx }) {
  const {
    invoices, invoiceFormData, selectedRowId, setSelectedRowId, checkedIds, toggleCheck, checkAll,
    jobData, setJobData, registerPendingEdits,
    handleApplyCumulative, handleReadExcel, handleDownloadSample, handleRecalculateDutyAllInv, handleUpdateExchangeRate, handleCopyFromOtherJob,
  } = ctx;

  const openInvoice = invoices.find((invoice) => invoice.id === selectedRowId);

  const hasUnsavedChanges = () => {
    if (!openInvoice) return false;
    return Object.keys({ ...openInvoice, ...invoiceFormData })
      .filter((key) => !SCREEN_ONLY_FIELDS.has(key))
      .some((key) => !sameText(invoiceFormData[key], openInvoice[key]));
  };

  useEffect(() =>
    registerPendingEdits?.('invoices', () =>
      hasUnsavedChanges() ? `${openInvoice.invNo ? `Invoice ${openInvoice.invNo}` : 'The open invoice'} has changes that were not put in with MODIFY - they are not part of the BE yet.` : ''
    )
  );

  const pickInvoice = async (invoice) => {
    if (invoice.id === selectedRowId) return;
    if (hasUnsavedChanges()) {
      const nextName = invoiceName(invoice, 'the other invoice');
      const dropChanges = await askConfirm({
        title: 'Changes not put in',
        message: `${openInvoice.invNo ? `Invoice ${openInvoice.invNo}` : 'This invoice'} has changes that were not put in with MODIFY.`,
        note: `Drop the changes: ${nextName} opens, and what was typed here is lost.\nStay here: press MODIFY first, then open ${nextName}.`,
        okLabel: 'Drop the changes',
        cancelLabel: 'Stay here',
      });
      if (!dropChanges) return;
    }
    setSelectedRowId(invoice.id);
  };

  return (
    <>
      <div className="glass-panel tw:mb-1 tw:h-[180px] tw:flex-none tw:overflow-hidden">
        <DataTable
          columns={INVOICE_COLUMNS}
          rows={invoices}
          selectedKey={selectedRowId}
          onRowClick={pickInvoice}
          selection={{ keys: checkedIds, onToggle: toggleCheck, onToggleAll: checkAll }}
          emptyText="No invoices yet - fill the form below and press Save"
          containerClassName="tw:h-full"
        />
      </div>

      <div className="tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:overflow-x-auto tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1.5 tw:lg:flex-nowrap">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:border-border tw:lg:flex-nowrap tw:lg:border-r tw:lg:pr-2">
          <Label className="tw:font-semibold">Cumulative</Label>
          {CUMULATIVE_FIELDS.map(({ key, label }) => (
            <NumberInput key={key} placeholder={label} className="tw:w-20" value={jobData[key] || ''}
              title={`Cumulative ${label} for the whole job - "Apply" splits it over the invoices by invoice value`}
              onValueChange={(value) => setJobData((previous) => ({ ...previous, [key]: value }))} />
          ))}
          <Button onClick={handleApplyCumulative} title="Split the cumulative amounts over the invoices by invoice value">Apply</Button>
        </div>
        <FileButton accept=".xls, .xlsx, .csv" onChange={handleReadExcel}><FileText /> Read Excel</FileButton>
        <Button onClick={handleDownloadSample}><Download /> Download Sample</Button>
        <Button className="tw:ml-auto" onClick={handleRecalculateDutyAllInv}><RefreshCw /> Re-Calculate Duty All Inv</Button>
        <Button onClick={handleUpdateExchangeRate}><RefreshCw /> Update Exchange Rate</Button>
        <Button className="tw:ml-auto" onClick={handleCopyFromOtherJob}><Copy /> Copy From Other Job</Button>
      </div>
    </>
  );
}
