import { useEffect, useState } from 'react';
import { CheckCircle, Eye, FileSpreadsheet, Filter, List, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, DataTable, DateInput, Field, Input, NumberInput, SelectBox, Separator } from '@/components/ui';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import PageHeader from '@/pages/PurchaseParts/PageHeader';
import { TotalsBar } from '@/pages/PurchaseParts/POItemsTable';
import { BillingPage, Panel } from './BillingParts/layout';
import CheckOption from './BillingParts/CheckOption';
import TotalsPanel from './BillingParts/TotalsPanel';
import LedgerPicker from './BillingParts/LedgerPicker';
import { EVEN_ON_ERROR, inr, ledgerName, ledgersFromTree, refusedUnlessOk, todayYmd, wait } from './BillingParts/billingData';

const DEPARTMENTS = [
  { value: 'Air Export', label: 'Air Export' },
  { value: 'Air Import', label: 'Air Import' },
  { value: 'Sea Export', label: 'Sea Export' },
  { value: 'Sea Import', label: 'Sea Import' },
  { value: 'Customs', label: 'Customs Clearance' },
];
const GROUPING_OPTIONS = [
  { value: 'Job No', label: 'By ERP Job No' },
  { value: 'AWB', label: 'By AWB / HBL Number' },
  { value: 'Date', label: 'By Shipment Date' },
];

const formatCurrency = (amount) => '₹ ' + inr(amount);
const departmentMode = (department) => (/air/i.test(department) ? 'A' : /sea/i.test(department) ? 'S' : '');
const chargesTotal = (job) => Object.values(job.charges).reduce((sum, charge) => sum + charge, 0);

const GST_RATE_PERCENT = 18;

function InvoiceSheet({ children, className }) {
  return <div className={cn('tw:min-w-0 tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-lg tw:md:p-8', className)}>{children}</div>;
}

export default function BulkBilling() {
  const [filters, setFilters] = useState({ client: '', dateFrom: '', dateTo: '', department: 'Air Export' });
  const [unbilledJobs, setUnbilledJobs] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [viewMode, setViewMode] = useState('selection');
  const [settings, setSettings] = useState({ mergeCharges: true, attachExcel: true, groupBy: 'Job No' });
  const [amounts, setAmounts] = useState({});
  const [chargeHead, setChargeHead] = useState('Freight & Clearance Charges');
  const [clients, setClients] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const ledgers = ledgersFromTree(await accountsApi.ledgerTree(EVEN_ON_ERROR));
        setClients(ledgers.filter((ledger) => /debtor|receivable/i.test(String(ledger.group || ''))));
      } catch {
        setClients([]);
      }
    })();
  }, []);

  const setFilter = (name, value) => setFilters((previous) => ({ ...previous, [name]: value }));
  const setSetting = (name, value) => setSettings((previous) => ({ ...previous, [name]: value }));

  const selectedJobData = unbilledJobs.filter((job) => selectedJobs.includes(job.id));
  const totalTaxable = selectedJobData.reduce((sum, job) => sum + (parseFloat(amounts[job.id]) || 0), 0);
  const taxAmount = totalTaxable * (GST_RATE_PERCENT / 100);
  const grandTotal = totalTaxable + taxAmount;

  const fetchJobs = async () => {
    if (!filters.client || !filters.dateFrom || !filters.dateTo) return toast.error('Please select Client and Date Range to fetch jobs.');
    try {
      const body = refusedUnlessOk(await accountsApi.billingUnbilledJobs({
        from: filters.dateFrom, to: filters.dateTo, party: filters.client, mode: departmentMode(filters.department),
      }));
      const jobs = (body.data || []).map((job) => ({ ...job, charges: {} }));
      setUnbilledJobs(jobs);
      setSelectedJobs(jobs.map((job) => job.id));
      if (!jobs.length) toast('No unbilled job for that client and period', { icon: 'ℹ️' });
      else toast.success(`${jobs.length} unbilled job(s) found`);
    } catch (error) {
      setUnbilledJobs([]);
      setSelectedJobs([]);
      toast.error('Could not fetch: ' + errorMessage(error));
    }
  };

  // Annexure-A: the shipment-wise list behind the consolidated invoice, as a real .xlsx
  const downloadAnnexure = async () => {
    if (!selectedJobData.length) { toast.error('Select the jobs first'); return; }
    const XLSX = await import('xlsx');
    const rows = selectedJobData.map((job) => ({
      'Job No': job.id, Type: job.kind || '', Date: job.date || '', Client: job.client || '',
      Reference: job.refNo || '', Port: job.dest || '', Mode: job.mode || '',
      Amount: parseFloat(amounts[job.id]) || 0,
    }));
    rows.push({ 'Job No': '', Type: '', Date: '', Client: '', Reference: '', Port: '', Mode: 'TOTAL', Amount: totalTaxable });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Annexure-A');
    XLSX.writeFile(workbook, `annexure-a-${(filters.client || 'client').replace(/[^A-Za-z0-9]+/g, '-')}-${filters.dateFrom || ''}.xlsx`);
    toast.success(selectedJobData.length + ' job(s) exported');
  };

  const toggleJob = (id) => setSelectedJobs(selectedJobs.includes(id) ? selectedJobs.filter((jobId) => jobId !== id) : [...selectedJobs, id]);

  const openPreview = () => {
    if (selectedJobs.length === 0) return toast.error('Select at least one job to bill.');
    setViewMode('preview');
  };

  const processFinalBill = async () => {
    await toast.promise(wait(1500), {
      loading: 'Generating Consolidated Tax Invoice & Annexure...',
      success: 'Consolidated Invoice #AE-INV/26/089 Generated Successfully!',
      error: 'Error generating invoice.',
    });
    setViewMode('selection');
    setUnbilledJobs([]);
    setSelectedJobs([]);
  };

  const jobColumns = [
    { key: 'date', header: 'Date' },
    { key: 'id', header: 'Job No', className: 'tw:font-semibold tw:text-foreground' },
    { key: 'refNo', header: 'AWB/Ref No', className: 'tw:text-primary' },
    { key: 'dest', header: 'Dest' },
    { key: 'weight', header: 'Weight' },
    { key: 'total', header: 'Total Amt (₹)', align: 'right', className: 'tw:font-semibold', cell: (job) => formatCurrency(chargesTotal(job)) },
  ];

  const chargeColumns = [
    {
      key: 'head', header: 'Consolidated Charge Head', className: 'tw:min-w-[220px]',
      cell: () => (
        <Input data-allow-text="" value={chargeHead} onChange={(event) => setChargeHead(event.target.value)} placeholder="Charge description (e.g. Air Freight Charges)" />
      ),
    },
    { key: 'jobs', header: 'No. of Jobs', align: 'center', cell: () => selectedJobs.length },
    { key: 'amount', header: 'Total Amount', align: 'right', className: 'tw:font-semibold', cell: () => formatCurrency(totalTaxable) },
  ];

  const annexureColumns = [
    { key: 'date', header: 'Date' },
    { key: 'id', header: 'Job No', className: 'tw:font-semibold' },
    { key: 'refNo', header: 'AWB No', className: 'tw:text-primary' },
    {
      key: 'amount', header: 'Amount (enter)', align: 'right',
      cell: (job) => (
        <NumberInput align="right" className="tw:w-[120px]" placeholder="0.00" value={amounts[job.id] || ''}
          onValueChange={(value) => setAmounts({ ...amounts, [job.id]: value })} />
      ),
    },
  ];

  return (
    <BillingPage className="tw:max-w-[1600px]">
      <PageHeader title="Consolidated Batch Billing" subtitle="Generate Fortnightly/Monthly bulk invoices with detailed annexures" />

      <Panel>
        <div className="tw:grid tw:grid-cols-1 tw:items-end tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-5">
          <Field layout="col" label="Client / Customer *">
            <LedgerPicker ledgers={clients} getValue={ledgerName} value={filters.client} onChange={(value) => setFilter('client', value)}
              placeholder={clients.length ? '-- Select Client --' : '-- No debtor ledgers yet --'} />
          </Field>
          <Field layout="col" label="Department *">
            <SelectBox className="tw:w-full" options={DEPARTMENTS} value={filters.department} onValueChange={(value) => setFilter('department', value)} />
          </Field>
          <Field layout="col" label="Date From *"><DateInput value={filters.dateFrom} onValueChange={(value) => setFilter('dateFrom', value)} /></Field>
          <Field layout="col" label="Date To *"><DateInput value={filters.dateTo} onValueChange={(value) => setFilter('dateTo', value)} /></Field>
          <Button size="lg" variant="default" className="tw:w-full" onClick={fetchJobs}><Filter /> Fetch Unbilled Jobs</Button>
        </div>
      </Panel>

      {unbilledJobs.length > 0 && viewMode === 'selection' && (
        <div className="tw:flex tw:flex-col tw:gap-5 tw:lg:flex-row tw:lg:items-start">
          <Panel icon={List} title={`Unbilled Shipments (${unbilledJobs.length})`} className="tw:min-w-0 tw:lg:flex-[2]"
            actions={<Badge variant="info">{selectedJobs.length} Selected</Badge>}>
            <DataTable columns={jobColumns} rows={unbilledJobs} stickyHeader={false} className="tw:text-entry"
              rowClassName={(job) => selectedJobs.includes(job.id) && 'tw:bg-success/10'}
              selection={{
                keys: selectedJobs,
                onToggle: toggleJob,
                onToggleAll: (checked) => setSelectedJobs(checked ? unbilledJobs.map((job) => job.id) : []),
              }} />
          </Panel>

          <Panel icon={Settings} title="Consolidated Bill Settings" className="tw:lg:flex-1">
            <CheckOption checked={settings.mergeCharges} onCheckedChange={(value) => setSetting('mergeCharges', value)} label="Merge Identical Charge Heads"
              description="Group all common charges (e.g., total all AWB fees into one line item on the main invoice)." />
            <CheckOption checked={settings.attachExcel} onCheckedChange={(value) => setSetting('attachExcel', value)} label="Auto-Generate Excel Annexure"
              description="Attach a detailed shipment-wise breakdown in Excel format along with the PDF." />
            <Field layout="col" label="Annexure Grouping Basis">
              <SelectBox className="tw:w-full" options={GROUPING_OPTIONS} value={settings.groupBy} onValueChange={(value) => setSetting('groupBy', value)} />
            </Field>
            <Separator className="tw:my-2" />
            <Button size="lg" variant="default" onClick={openPreview}><Eye /> Preview Consolidated Bill</Button>
          </Panel>
        </div>
      )}

      {viewMode === 'preview' && (
        <div className="tw:flex tw:flex-col tw:gap-5">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
            <Button size="lg" variant="secondary" onClick={() => setViewMode('selection')}>&larr; Back to Selection</Button>
            <Button size="lg" variant="success" onClick={processFinalBill}><CheckCircle /> Generate Final Invoice &amp; Annexure</Button>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-6 tw:xl:flex-row">
            <InvoiceSheet className="tw:xl:flex-1">
              <div className="tw:mb-6 tw:border-b-2 tw:border-border tw:pb-4 tw:text-center">
                <h1 className="tw:m-0 tw:text-2xl tw:tracking-wide tw:uppercase">Tax Invoice</h1>
                <p className="tw:m-0 tw:mt-1 tw:text-entry tw:text-muted-foreground">(Consolidated Billing)</p>
              </div>

              <div className="tw:mb-8 tw:flex tw:flex-col tw:gap-4 tw:text-entry tw:sm:flex-row tw:sm:justify-between">
                <div>
                  <div className="tw:mb-1 tw:text-muted-foreground">Billed To:</div>
                  <div className="tw:text-sm tw:font-bold">TechCorp Exports Ltd.</div>
                  <div>Period: {filters.dateFrom} to {filters.dateTo}</div>
                  <div>Dept: {filters.department} ({selectedJobs.length} Shipments)</div>
                </div>
                <div className="tw:sm:text-right">
                  <div className="tw:mb-1 tw:text-muted-foreground">Invoice Details:</div>
                  <div className="tw:font-bold">INV: DRAFT PREVIEW</div>
                  <div>Date: {todayYmd()}</div>
                </div>
              </div>

              <DataTable columns={chargeColumns} rows={[{ id: 'charge' }]} stickyHeader={false} className="tw:text-entry" containerClassName="tw:mb-8" />

              <TotalsPanel className="tw:ml-auto tw:w-full tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-4 tw:sm:w-[350px]" rows={[
                { label: 'Total Taxable Value', value: formatCurrency(totalTaxable) },
                { label: `Add: IGST @ ${GST_RATE_PERCENT}%`, value: formatCurrency(taxAmount) },
                { label: 'Grand Total', value: formatCurrency(grandTotal), grand: true },
              ]} />

              <p className="tw:m-0 tw:mt-10 tw:text-center tw:text-entry tw:normal-case tw:text-muted-foreground">
                * Please refer to Annexure-A (attached) for detailed shipment-wise breakdown of the above charges.
              </p>
            </InvoiceSheet>

            <InvoiceSheet className="tw:xl:flex-[1.2]">
              <div className="tw:mb-6 tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-2 tw:border-b-2 tw:border-border tw:pb-4">
                <div>
                  <h2 className="tw:m-0 tw:text-lg">Annexure - A</h2>
                  <p className="tw:m-0 tw:mt-1 tw:text-[11px] tw:text-muted-foreground">Shipment-wise breakdown of Consolidated Invoice</p>
                </div>
                <Button variant="success" onClick={downloadAnnexure}><FileSpreadsheet /> Download Excel</Button>
              </div>
              <DataTable columns={annexureColumns} rows={selectedJobData} stickyHeader={false} />
              <TotalsBar totals={[{ label: 'GRAND TOTAL:', value: formatCurrency(totalTaxable) }]} />
            </InvoiceSheet>
          </div>
        </div>
      )}
    </BillingPage>
  );
}
