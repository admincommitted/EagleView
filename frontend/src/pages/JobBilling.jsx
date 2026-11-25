import { useEffect, useState } from 'react';
import { Briefcase, CheckCircle, FileText, Globe, Plus, QrCode, RefreshCcw, Save, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, DateInput, Field, Input, NumberInput, SelectBox } from '@/components/ui';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import PageHeader from '@/pages/PurchaseParts/PageHeader';
import Notice from '@/pages/PurchaseParts/Notice';
import { BillingPage, Panel } from './BillingParts/layout';
import ModeSwitch from './BillingParts/ModeSwitch';
import CheckOption from './BillingParts/CheckOption';
import TotalsPanel from './BillingParts/TotalsPanel';
import LedgerPicker from './BillingParts/LedgerPicker';
import { amountColumn, choiceColumn, hsnColumn, ledgerColumn, moneyColumn, removeColumn } from './BillingParts/lineColumns';
import { jobBillTotals, jobLine } from './BillingParts/billMath';
import { GST_RATE_OPTIONS, amountOf, inr, ledgersFromTree, todayYmd, wait } from './BillingParts/billingData';

const BILLING_MODES = [
  { value: 'Domestic', label: 'Domestic Billing' },
  { value: 'Overseas', label: 'Overseas Billing', icon: Globe },
];
const INVOICE_TYPES = [
  { value: 'Comprehensive', label: 'Comprehensive' },
  { value: 'Freight Only', label: 'Freight Only Bill' },
  { value: 'Local Only', label: 'Customs & Local Only' },
  { value: 'Reimbursement', label: 'Reimbursement (Debit Note)' },
];
const STATUS_OPTIONS = [{ value: 'Draft', label: 'Draft Mode' }, { value: 'Final', label: 'Finalize & Post' }];
const JOB_TYPES = ['Export', 'Import'];
const OVERSEAS_CURRENCIES = ['USD', 'EUR', 'GBP', 'AED'];
const SAMPLE_PARTIES = [{ id: 'C1', name: 'TechCorp Exports Ltd.' }, { id: 'C2', name: 'Global Logistics LLC (Dubai)' }];
const SAMPLE_IRN = '01a9b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';

const blankCharge = (taxRate, id = Date.now()) => ({ id, chargeLedgerId: '', amountFCY: '', amountINR: '', taxRate });

function previewBillNo(invoiceType, billingMode) {
  if (invoiceType === 'Freight Only') return 'FRT/26/1022';
  if (invoiceType === 'Local Only') return 'LOC/26/1022';
  if (invoiceType === 'Reimbursement') return 'DN/26/1022 (Debit Note)';
  if (billingMode === 'Overseas') return 'EXP/26/089';
  return 'INV/26/1022';
}

export default function JobBilling() {
  const [date, setDate] = useState(todayYmd);
  const [partyId, setPartyId] = useState('');
  const [jobType, setJobType] = useState('Export');
  const [jobId, setJobId] = useState('');
  const [billingMode, setBillingMode] = useState('Domestic');
  const [currency, setCurrency] = useState('INR');
  const [roe, setRoe] = useState('1');
  const [lutEnabled, setLutEnabled] = useState(false);
  const [eInvoiceStatus, setEInvoiceStatus] = useState('Pending');
  const [irnData, setIrnData] = useState(null);
  const [items, setItems] = useState([blankCharge('18', 1)]);
  const [status, setStatus] = useState('Draft');
  const [invoiceType, setInvoiceType] = useState('Comprehensive');
  const [ledgers, setLedgers] = useState([]);

  const isOverseas = billingMode === 'Overseas';
  const newLineTaxRate = isOverseas ? '0' : '18';

  useEffect(() => {
    (async () => {
      try {
        setLedgers(ledgersFromTree(await accountsApi.ledgerTree()));
      } catch (error) {
        // a ledger id that is not in the chart of accounts produces an invoice that cannot post, so nothing is invented
        console.error(error);
        setLedgers([]);
        toast.error('Could not load the ledgers: ' + (errorMessage(error) || 'no answer from the server') + ' - open Masters > Chart of Accounts');
      }
    })();
  }, []);

  const changeBillingMode = (mode) => {
    if (mode === billingMode) return;
    setBillingMode(mode);
    if (mode === 'Overseas') {
      setCurrency('USD');
      setRoe('84.2');
      setLutEnabled(true);
      setItems(items.map((item) => ({ ...item, taxRate: '0' })));
    } else {
      setCurrency('INR');
      setRoe('1');
      setLutEnabled(false);
    }
  };

  const updateItem = (id, field, value) => setItems(items.map((item) => {
    if (item.id !== id) return item;
    const updated = { ...item, [field]: value };
    if (isOverseas && field === 'amountFCY') updated.amountINR = (parseFloat(value || 0) * amountOf(roe)).toFixed(2);
    if (!isOverseas && field === 'amountINR') updated.amountFCY = value;
    return updated;
  }));

  const changeRoe = (value) => {
    setRoe(value);
    setItems(items.map((item) => ({ ...item, amountINR: (parseFloat(item.amountFCY || 0) * amountOf(value)).toFixed(2) })));
  };

  const removeItem = (id) => { if (items.length > 1) setItems(items.filter((item) => item.id !== id)); };

  const generateEInvoice = async () => {
    await toast.promise(wait(2000), {
      loading: 'Connecting to Govt NIC Portal... Generating IRN...',
      success: 'E-Invoice IRN & QR Code Generated Successfully!',
      error: 'Failed to generate e-invoice.',
    });
    setEInvoiceStatus('Generated');
    setIrnData(SAMPLE_IRN);
  };

  const save = async () => {
    await toast.promise(wait(1000), {
      loading: 'Saving Invoice & Posting Accounting Vouchers...',
      success: 'Invoice Finalized and Posted to Ledger!',
      error: 'Error saving invoice.',
    });
    setItems([blankCharge(newLineTaxRate)]);
    setStatus('Draft');
    setEInvoiceStatus('Pending');
    setIrnData(null);
  };

  const totals = jobBillTotals(items, lutEnabled);
  const totalRows = [
    { label: 'Sub Total (INR)', value: inr(totals.subTotal) },
    ...(lutEnabled ? [] : [
      { label: 'CGST', value: inr(totals.cgst), tone: 'muted' },
      { label: 'SGST', value: inr(totals.sgst), tone: 'muted' },
    ]),
    { label: 'Grand Total (INR)', value: '₹ ' + inr(totals.grandTotal), grand: true },
  ];

  const columns = [
    ledgerColumn({ key: 'chargeLedgerId', header: 'Charge Head / Particulars', ledgers, placeholder: '-- Select Income Ledger --', onChange: updateItem }),
    hsnColumn({ ledgerKey: 'chargeLedgerId', header: 'HSN / SAC', findLedger: (id) => ledgers.find((ledger) => String(ledger.id) === String(id)) }),
    ...(isOverseas ? [amountColumn({ key: 'amountFCY', header: `Amount (${currency})`, onChange: updateItem, cellProps: () => ({ className: 'tw:bg-page' }) })] : []),
    amountColumn({ key: 'amountINR', header: 'Amount (₹ INR)', onChange: updateItem }),
    choiceColumn({ key: 'taxRate', header: 'GST Rate', options: GST_RATE_OPTIONS, onChange: updateItem, disabled: lutEnabled }),
    moneyColumn({ key: 'total', header: 'Total Amount (₹)', amount: (item) => jobLine(item, lutEnabled).total }),
    removeColumn(removeItem),
  ];

  const isSplitInvoice = invoiceType !== 'Comprehensive';

  return (
    <BillingPage className="tw:max-w-[1400px]">
      <PageHeader icon={FileText} title="Job Billing (Invoicing)" subtitle="Advanced multi-currency, E-Invoicing & Auto-voucher posting"
        actions={<ModeSwitch options={BILLING_MODES} value={billingMode} onChange={changeBillingMode} />} />

      <Panel bodyClassName="tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-5">
          <Field layout="col" label={<><User className="tw:size-3.5" /> Bill To (Party)</>}>
            <LedgerPicker ledgers={[...SAMPLE_PARTIES, ...ledgers]} value={partyId} placeholder="-- Select Customer Ledger --" onChange={setPartyId} />
          </Field>
          <Field layout="col" label={<><Briefcase className="tw:size-3.5" /> Link to Job</>}>
            <div className="tw:flex tw:w-full">
              <SelectBox className="tw:w-[90px] tw:shrink-0 tw:rounded-r-none" options={JOB_TYPES} value={jobType} onValueChange={setJobType} />
              <Input data-allow-text="" className="tw:rounded-l-none" placeholder="Job No." value={jobId} onChange={(event) => setJobId(event.target.value)} />
            </div>
          </Field>
          <Field layout="col" label="Invoice Type (Split Rule)">
            <SelectBox options={INVOICE_TYPES} value={invoiceType} onValueChange={setInvoiceType}
              className={cn('tw:w-full', isSplitInvoice && 'tw:border-warning tw:bg-warning/10 tw:text-warning')} />
          </Field>

          {isOverseas ? (
            <>
              <Field layout="col" label="Currency & ROE">
                <div className="tw:flex tw:w-full">
                  <SelectBox className="tw:w-[70px] tw:shrink-0 tw:rounded-r-none" options={OVERSEAS_CURRENCIES} value={currency} onValueChange={setCurrency} />
                  <NumberInput className="tw:rounded-l-none" title="Rate of Exchange" value={roe} onValueChange={changeRoe} />
                </div>
              </Field>
              <CheckOption className="tw:self-center tw:lg:mt-4" checked={lutEnabled} onCheckedChange={setLutEnabled} label="Apply LUT (0% GST)" />
            </>
          ) : (
            <Field layout="col" label="Invoice Date"><DateInput value={date} onValueChange={setDate} /></Field>
          )}
        </div>

        <Notice tone={isOverseas ? 'success' : 'info'} icon={isOverseas ? Globe : undefined}>
          <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
            <span>
              {isOverseas
                ? 'Overseas mode active: Invoices will print AD Code, SWIFT details, and values in Foreign Currency.'
                : 'Selected Bill Group will auto-generate specific Invoice Series.'}
            </span>
            <b className="tw:w-fit tw:rounded-sm tw:border tw:border-border tw:bg-background tw:px-2.5 tw:py-1">Preview No: {previewBillNo(invoiceType, billingMode)}</b>
          </div>
        </Notice>

        <div className="tw:flex tw:flex-col tw:items-start tw:gap-2">
          <DataTable columns={columns} rows={items} stickyHeader={false} className="tw:text-entry" containerClassName="tw:w-full" />
          <Button onClick={() => setItems([...items, blankCharge(newLineTaxRate)])}><Plus /> Add Charge Row</Button>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-6 tw:border-t tw:border-border tw:pt-4 tw:lg:flex-row">
          <div className="tw:min-w-0 tw:lg:flex-[1.5]">
            <Panel icon={QrCode} title="E-Invoicing (GST Govt Portal)">
              {eInvoiceStatus === 'Pending' ? (
                <div className="tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
                  <span className="tw:text-entry tw:normal-case tw:text-muted-foreground">Generate IRN and QR Code via NIC / ClearTax API instantly before finalizing the bill.</span>
                  <Button variant="default" onClick={generateEInvoice} disabled={!partyId}><RefreshCcw /> Fetch IRN</Button>
                </div>
              ) : (
                <Notice tone="success" icon={CheckCircle} title="IRN Generated Successfully">
                  <span className="tw:font-mono tw:text-[11px] tw:break-all">IRN: {irnData}</span>
                </Notice>
              )}
            </Panel>
          </div>

          <TotalsPanel className="tw:lg:flex-1" rows={totalRows}>
            <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row">
              <SelectBox options={STATUS_OPTIONS} value={status} onValueChange={setStatus}
                className={cn('tw:flex-1 tw:font-bold', status === 'Final' ? 'tw:border-success tw:text-success' : 'tw:text-muted-foreground')} />
              <Button size="lg" variant="default" className="tw:flex-1" onClick={save}><Save /> Generate Bill</Button>
            </div>
          </TotalsPanel>
        </div>
      </Panel>
    </BillingPage>
  );
}
