import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Building, CheckCircle, FileText, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, DateInput, Field, Input, Textarea } from '@/components/ui';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import PageHeader from '@/pages/PurchaseParts/PageHeader';
import Notice from '@/pages/PurchaseParts/Notice';
import { BillingPage, Panel } from './BillingParts/layout';
import ModeSwitch from './BillingParts/ModeSwitch';
import TotalsPanel from './BillingParts/TotalsPanel';
import LedgerPicker from './BillingParts/LedgerPicker';
import { amountColumn, choiceColumn, hsnColumn, ledgerColumn, moneyColumn, removeColumn, textColumn } from './BillingParts/lineColumns';
import { vendorBillTotals, vendorLine } from './BillingParts/billMath';
import {
  EVEN_ON_ERROR, GST_RATE_OPTIONS, TDS_RATE_OPTIONS, inr, ledgerIdNamed, ledgersFromTree, refusedUnlessOk, roundPaise, todayYmd,
  voucherTypeFor, voucherTypesFrom,
} from './BillingParts/billingData';

const BILL_TYPES = [
  { value: 'Trade', label: 'Trade (Job Related)', icon: Briefcase },
  { value: 'Non-Trade', label: 'Non-Trade (Admin)', icon: Building },
];

const blankItem = (id = Date.now()) => ({ id, jobId: '', expenseLedgerId: '', amount: '', taxRate: '18', tdsRate: '0' });

const isDirectCostGroup = (group) => /direct expense|purchase/.test(String(group || '').toLowerCase());

export default function VendorBillEntry() {
  const [billType, setBillType] = useState('Trade');
  const [header, setHeader] = useState({ vendorId: '', vendorInvoiceNo: '', invoiceDate: todayYmd(), dueDate: '', remarks: '' });
  const [items, setItems] = useState([blankItem(1)]);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [loadError, setLoadError] = useState('');

  const loadMasters = useCallback(async () => {
    try {
      const [treeBody, mastersBody] = await Promise.all([
        accountsApi.ledgerTree(EVEN_ON_ERROR),
        accountsApi.accountingMasters(EVEN_ON_ERROR),
      ]);
      const ledgers = ledgersFromTree(treeBody);
      setAllLedgers(ledgers);
      // the vendor of a purchase voucher IS its creditor ledger - a bill cannot be booked against anything else
      setVendors(ledgers.filter((ledger) => /creditor|payable/i.test(String(ledger.group || ''))).map((ledger) => ({ id: ledger.id, name: ledger.name, ledgerId: ledger.id })));
      setVoucherTypes(voucherTypesFrom(mastersBody));
      setLoadError(ledgers.length ? '' : 'No ledgers in the chart of accounts yet - open Masters > Chart of Accounts');
    } catch (error) {
      setVendors([]);
      setAllLedgers([]);
      setLoadError('Could not load the masters: ' + errorMessage(error));
    }
  }, []);
  useEffect(() => { loadMasters(); }, [loadMasters]);

  // Trade bills are booked to direct-cost ledgers, non-trade to the rest
  const ledgers = useMemo(
    () => allLedgers.filter((ledger) => (billType === 'Trade' ? isDirectCostGroup(ledger.group) || !ledger.group : !isDirectCostGroup(ledger.group))),
    [allLedgers, billType]
  );

  const setHeaderField = (name, value) => setHeader((previous) => ({ ...previous, [name]: value }));
  const updateItem = (id, field, value) => setItems((previous) => previous.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (id) => { if (items.length > 1) setItems(items.filter((item) => item.id !== id)); };
  const changeBillType = (type) => { setBillType(type); setItems([blankItem()]); };

  const { subTotal, taxTotal, tdsTotal, netPayable } = vendorBillTotals(items);

  const save = async () => {
    if (!header.vendorId) return toast.error('Please select a Vendor.');
    if (!header.vendorInvoiceNo) return toast.error('Vendor Invoice No is required.');
    if (billType === 'Trade' && items.some((item) => !item.jobId)) return toast.error('Job Number is mandatory for Trade Bills!');
    if (items.some((item) => !item.amount || parseFloat(item.amount) <= 0)) return toast.error('Please enter a valid amount for all rows.');

    // a real Purchase voucher: Dr each expense ledger, Dr input GST, Cr the vendor (net of TDS), Cr TDS payable
    const vendor = vendors.find((row) => String(row.id) === String(header.vendorId));
    const vendorLedgerId = vendor?.ledgerId;
    if (!vendorLedgerId) return toast.error(`"${vendor?.name || 'This vendor'}" has no ledger linked - open Masters > Vendors and link its ledger`);
    const gstLedgerId = ledgerIdNamed(allLedgers, /INPUT\s*(C?GST|IGST)|GST\s*INPUT/i);
    const tdsLedgerId = ledgerIdNamed(allLedgers, /TDS\s*PAYABLE|TDS\s*ON/i);
    if (taxTotal > 0 && !gstLedgerId) return toast.error('No input GST ledger in the chart of accounts - add one (e.g. "Input CGST") before booking a bill with GST');
    if (tdsTotal > 0 && !tdsLedgerId) return toast.error('No TDS payable ledger in the chart of accounts - add one (e.g. "TDS Payable") before booking a bill with TDS');
    const purchaseType = voucherTypeFor(voucherTypes, 'Purchase');
    if (!purchaseType) return toast.error('No Purchase voucher type - add one in Masters > Voucher Types');

    const details = items
      .filter((item) => (parseFloat(item.amount) || 0) > 0 && item.expenseLedgerId)
      .map((item) => ({ ledgerId: item.expenseLedgerId, dc: 'Dr', amount: parseFloat(item.amount) || 0 }));
    if (taxTotal > 0) details.push({ ledgerId: gstLedgerId, dc: 'Dr', amount: roundPaise(taxTotal) });
    details.push({ ledgerId: vendorLedgerId, dc: 'Cr', amount: roundPaise(netPayable) });
    if (tdsTotal > 0) details.push({ ledgerId: tdsLedgerId, dc: 'Cr', amount: roundPaise(tdsTotal) });

    setSaving(true);
    const toastId = toast.loading('Posting the purchase voucher...');
    try {
      let voucherNumber = header.vendorInvoiceNo;
      try {
        const next = await accountsApi.billingNextVoucherNumber(purchaseType.id);
        if (next?.isAuto && next.nextNumber) voucherNumber = next.nextNumber;
      } catch {
        // keep the vendor's own number
      }
      const jobs = items.map((item) => item.jobId).filter(Boolean).join(', ');
      refusedUnlessOk(await accountsApi.postVoucher({
        voucherTypeId: purchaseType.id, voucherNumber, date: header.invoiceDate, jobNo: items.find((item) => item.jobId)?.jobId || null,
        narration: [`${billType} bill ${header.vendorInvoiceNo}`, vendor.name, jobs && ('Job ' + jobs), header.remarks].filter(Boolean).join(' | '),
        details,
      }));
      toast.success('Purchase voucher ' + voucherNumber + ' posted', { id: toastId });
      setHeader({ ...header, vendorInvoiceNo: '', remarks: '' });
      setItems([blankItem()]);
    } catch (error) {
      toast.error('Could not post: ' + errorMessage(error), { id: toastId });
    }
    setSaving(false);
  };

  const columns = [
    ...(billType === 'Trade' ? [textColumn({
      key: 'jobId', header: 'Job / File No. *', placeholder: 'Job No...', onChange: updateItem, cellProps: (item) => ({ 'aria-invalid': !item.jobId }),
    })] : []),
    ledgerColumn({ key: 'expenseLedgerId', header: 'Expense / Cost Ledger', ledgers, placeholder: '-- Select Expense --', onChange: updateItem }),
    hsnColumn({ ledgerKey: 'expenseLedgerId', findLedger: (id) => ledgers.find((ledger) => String(ledger.id) === String(id)) }),
    amountColumn({ key: 'amount', header: 'Base Amt (₹)', onChange: updateItem }),
    choiceColumn({ key: 'taxRate', header: 'GST Rate', options: GST_RATE_OPTIONS, onChange: updateItem }),
    choiceColumn({ key: 'tdsRate', header: 'TDS Rate', options: TDS_RATE_OPTIONS, onChange: updateItem, className: 'tw:min-w-[130px]' }),
    moneyColumn({ key: 'net', header: 'Net Pay (₹)', amount: (item) => vendorLine(item).net }),
    removeColumn(removeItem),
  ];

  return (
    <BillingPage className="tw:max-w-[1200px]">
      <PageHeader icon={FileText} title="Vendor Bill Entry (Purchase)" subtitle="Book inward supplier invoices and manage TDS deductions"
        actions={<ModeSwitch options={BILL_TYPES} value={billType} onChange={changeBillType} />} />

      {loadError && <Notice tone="warning">{loadError}</Notice>}

      <Panel bodyClassName="tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          <Field layout="col" label="Select Vendor (Supplier) *">
            <LedgerPicker ledgers={vendors} value={header.vendorId} placeholder="-- Choose Vendor --" onChange={(value) => setHeaderField('vendorId', value)} />
          </Field>
          <Field layout="col" label="Vendor Invoice No. *">
            <Input data-allow-text="" placeholder="e.g. INV-2026-99" value={header.vendorInvoiceNo} onChange={(event) => setHeaderField('vendorInvoiceNo', event.target.value)} />
          </Field>
          <Field layout="col" label="Invoice Date"><DateInput value={header.invoiceDate} onValueChange={(value) => setHeaderField('invoiceDate', value)} /></Field>
          <Field layout="col" label="Due Date"><DateInput value={header.dueDate} onValueChange={(value) => setHeaderField('dueDate', value)} /></Field>
        </div>

        {billType === 'Trade'
          ? <Notice icon={CheckCircle}>Trade Mode: You must link a Job Number. This cost will hit the Job Profitability Sheet.</Notice>
          : <Notice icon={Building}>Non-Trade Mode: Admin expenses hit the central P&amp;L. Job linkage is disabled.</Notice>}

        <div className="tw:flex tw:flex-col tw:items-start tw:gap-2">
          <DataTable columns={columns} rows={items} stickyHeader={false} className="tw:min-w-[900px] tw:text-entry" containerClassName="tw:w-full" />
          <Button onClick={addItem}><Plus /> Add New Row</Button>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4 tw:border-t tw:border-border tw:pt-4 tw:md:flex-row tw:md:justify-between">
          <Field layout="col" label="Internal Remarks (Optional)" className="tw:w-full tw:md:max-w-[400px]">
            <Textarea data-allow-text="" rows={3} placeholder="Enter narrative or justification..." value={header.remarks}
              onChange={(event) => setHeaderField('remarks', event.target.value)} />
          </Field>
          <TotalsPanel className="tw:w-full tw:md:w-[350px]" rows={[
            { label: 'Base Taxable Value', value: inr(subTotal) },
            { label: 'Add: GST Input', value: inr(taxTotal), tone: 'muted' },
            { label: 'Less: TDS Deducted', value: '- ' + inr(tdsTotal), tone: 'danger' },
            { label: 'Net Payable (₹)', value: '₹ ' + inr(netPayable), grand: true },
          ]}>
            <Button size="lg" variant="default" className="tw:mt-3" onClick={save} disabled={saving}><Save /> {saving ? 'Wait...' : 'Post Vendor Bill'}</Button>
          </TotalsPanel>
        </div>
      </Panel>
    </BillingPage>
  );
}
