import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle, FileText, Paperclip, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Button, DataTable, DateInput, Field, FileButton, Input, SelectBox, Textarea } from '@/components/ui';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import PageHeader from '@/pages/PurchaseParts/PageHeader';
import Notice from '@/pages/PurchaseParts/Notice';
import { BillingPage, Panel } from './BillingParts/layout';
import ModeSwitch from './BillingParts/ModeSwitch';
import CheckOption from './BillingParts/CheckOption';
import AttachmentList from './BillingParts/AttachmentList';
import useDraftAttachments from './BillingParts/useDraftAttachments';
import useVoucherNumber from './BillingParts/useVoucherNumber';
import VoucherNumberField from './BillingParts/VoucherNumberField';
import { amountColumn, choiceColumn, ledgerColumn, removeColumn, textColumn } from './BillingParts/lineColumns';
import {
  ATTACHMENT_TYPES, EVEN_ON_ERROR, currencyRows, foreignCurrencyCodes, ledgersFromTree, refusedUnlessOk, sortedByName,
  todayYmd, voucherTypeFor, voucherTypesFrom,
} from './BillingParts/billingData';

const VOUCHER_TYPES = ['Contra', 'Payment', 'Receipt', 'Journal', 'Sales', 'Purchase'].map((type) => ({ value: type, label: type }));
const SIDE_OPTIONS = ['Dr', 'Cr'];

const blankLine = (id, dc) => ({ id, dc, ledgerId: '', amountINR: '', amountFCY: '', curr: 'INR', roe: 1, costCentreId: '', remarks: '' });
const firstLines = () => [blankLine(1, 'Dr'), blankLine(2, 'Cr')];
const plainTotal = (amount) => amount.toLocaleString(undefined, { minimumFractionDigits: 2 });

/** Forex: the INR amount follows FCY x rate, so the two can never disagree. */
function withChange(line, field, value) {
  const next = { ...line, [field]: value };
  if (['amountFCY', 'roe', 'curr'].includes(field)) {
    if (next.curr && next.curr !== 'INR') {
      const foreignAmount = parseFloat(next.amountFCY);
      const rate = parseFloat(next.roe);
      if (Number.isFinite(foreignAmount) && Number.isFinite(rate)) next.amountINR = (foreignAmount * rate).toFixed(2);
    } else if (field === 'curr') {
      next.amountFCY = '';
      next.roe = 1;
    }
  }
  return next;
}

const branchCodeOf = (branch) => branch.branchCode || branch.code || '';

export default function VoucherEntry() {
  const [activeType, setActiveType] = useState('Journal');
  const [date, setDate] = useState(todayYmd);
  const [narration, setNarration] = useState('');
  const [refNo, setRefNo] = useState('');
  const [jobNo, setJobNo] = useState('');
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [centres, setCentres] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [posting, setPosting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [enableForex, setEnableForex] = useState(false);
  const [enableCostCenter, setEnableCostCenter] = useState(false);
  const [lines, setLines] = useState(firstLines);
  const [nextId, setNextId] = useState(3);
  const attachments = useDraftAttachments('vd');

  const currentType = useMemo(() => voucherTypeFor(voucherTypes, activeType), [voucherTypes, activeType]);
  const voucherNumber = useVoucherNumber(currentType);

  useEffect(() => {
    (async () => {
      try {
        const [treeBody, mastersBody, branchesBody, currenciesBody] = await Promise.all([
          accountsApi.ledgerTree(EVEN_ON_ERROR),
          accountsApi.accountingMasters(EVEN_ON_ERROR),
          accountsApi.billingCompanyBranches(EVEN_ON_ERROR),
          accountsApi.billingCurrencies(EVEN_ON_ERROR),
        ]);
        const allLedgers = sortedByName(ledgersFromTree(treeBody));
        setLedgers(allLedgers);
        setVoucherTypes(voucherTypesFrom(mastersBody));
        setCentres(mastersBody?.data?.costCentresFlat || []);
        const branchList = branchesBody?.data || branchesBody?.branches || [];
        setBranches(branchList);
        const defaultBranch = branchList.find((row) => row.isDefault) || branchList[0];
        if (defaultBranch) setBranch(branchCodeOf(defaultBranch));
        setCurrencies(currencyRows(currenciesBody));
        if (!allLedgers.length) setLoadError('No ledgers exist yet. Open Accounts > Chart of Accounts and create your ledgers first - a voucher cannot be posted without them.');
      } catch (error) {
        setLoadError('Could not load ledgers / masters: ' + errorMessage(error));
      }
    })();
  }, []);

  const updateLine = (id, field, value) => setLines((previous) => previous.map((line) => (line.id === id ? withChange(line, field, value) : line)));

  const addLine = () => {
    const lastSide = lines[lines.length - 1]?.dc || 'Dr';
    setLines([...lines, blankLine(nextId, lastSide === 'Dr' ? 'Cr' : 'Dr')]);
    setNextId(nextId + 1);
  };

  const removeLine = (id) => {
    if (lines.length <= 2) { toast.error('A voucher needs at least two lines'); return; }
    setLines(lines.filter((line) => line.id !== id));
  };

  const totals = useMemo(() => {
    const sideTotal = (side) => lines.filter((line) => line.dc === side).reduce((sum, line) => sum + (parseFloat(line.amountINR) || 0), 0);
    const dr = sideTotal('Dr');
    const cr = sideTotal('Cr');
    return { dr, cr, diff: Math.abs(dr - cr) };
  }, [lines]);

  const autoBalance = () => {
    if (totals.diff < 0.01) { toast.success('Already tallied'); return; }
    const missingSide = totals.dr > totals.cr ? 'Cr' : 'Dr';
    setLines([...lines, { ...blankLine(nextId, missingSide), amountINR: totals.diff.toFixed(2), remarks: 'Auto-balanced' }]);
    setNextId(nextId + 1);
    toast.success('Added a balancing line - pick its ledger');
  };

  const attach = async (files) => {
    if (!files.length) return;
    try {
      await attachments.upload(files);
      toast.success(files.length === 1 ? 'Attached' : files.length + ' files attached');
      await attachments.reloadDocs();
    } catch (error) {
      toast.error('Attach failed: ' + errorMessage(error));
    }
  };

  const removeDoc = async (id) => {
    try {
      await accountsApi.billingDeleteVoucherDocument(id);
      attachments.setDocs(attachments.docs.filter((doc) => doc.id !== id));
    } catch (error) {
      toast.error('Could not remove: ' + errorMessage(error));
    }
  };

  const postingLines = () => lines
    .filter((line) => (parseFloat(line.amountINR) || 0) !== 0)
    .map((line) => {
      const isForeign = enableForex && line.curr !== 'INR';
      return {
        ledgerId: line.ledgerId, dc: line.dc, amount: parseFloat(line.amountINR) || 0,
        costCentreId: enableCostCenter && line.costCentreId ? line.costCentreId : null,
        currency: enableForex ? (line.curr || 'INR') : null,
        roe: isForeign ? line.roe : null,
        amountFcy: isForeign ? line.amountFCY : null,
        remarks: line.remarks || null,
      };
    });

  const save = async () => {
    if (!currentType) return toast.error('There is no "' + activeType + '" voucher type in Accounting Masters yet - create it first');
    if (totals.dr === 0) return toast.error('Total amount cannot be zero');
    if (totals.diff > 0.01) return toast.error('Debit and Credit totals must match. Difference: ' + totals.diff.toFixed(2));
    const linesWithoutLedger = lines.filter((line) => (parseFloat(line.amountINR) || 0) !== 0 && !line.ledgerId);
    if (linesWithoutLedger.length) return toast.error(linesWithoutLedger.length + ' line(s) have an amount but no ledger picked');
    if (!voucherNumber.isAuto && !voucherNumber.number.trim()) return toast.error('This voucher type is on manual numbering - type a voucher number');

    setPosting(true);
    try {
      const body = refusedUnlessOk(await accountsApi.postVoucher({
        voucherTypeId: currentType.id,
        voucherNumber: voucherNumber.number.trim(),
        date, narration: narration || null,
        branchCode: branch || null, refNo: refNo || null, jobNo: jobNo || null,
        details: postingLines(),
      }));
      await attachments.linkToVoucher(body?.data?.id || body?.id || body?.voucher?.id,
        'Voucher posted, but the attachments did not link - re-attach them from the voucher list');
      toast.success('Posted ' + (voucherNumber.number || ''));
      setLines(firstLines());
      setNextId(3);
      setNarration('');
      setRefNo('');
      setJobNo('');
      attachments.startNewDraft();
      await voucherNumber.reload();
    } catch (error) {
      toast.error('Not posted: ' + errorMessage(error));
    }
    setPosting(false);
  };

  const centreOptions = centres.map((centre) => ({ value: String(centre.id), label: centre.name }));
  const currencyOptions = ['INR', ...foreignCurrencyCodes(currencies)];
  const branchOptions = branches.map((row) => ({ value: branchCodeOf(row), label: branchCodeOf(row) + ' - ' + (row.branchName || row.name || '') }));
  const disabledForInr = (line) => ({ disabled: line.curr === 'INR' });
  const sideAmountColumn = (side, header, tint) => {
    const column = amountColumn({
      key: 'amountINR', header, onChange: updateLine,
      cellProps: (line) => ({ readOnly: enableForex && line.curr !== 'INR', className: cn('tw:font-bold', tint) }),
    });
    return { ...column, key: `amount${side}`, cell: (line) => (line.dc === side ? column.cell(line) : null) };
  };

  const columns = [
    {
      key: 'dc', header: 'Dr/Cr', align: 'center', className: 'tw:w-[70px]',
      cell: (line) => (
        <SelectBox options={SIDE_OPTIONS} value={line.dc} onValueChange={(value) => updateLine(line.id, 'dc', value)}
          className={cn('tw:w-full tw:font-bold', line.dc === 'Dr' ? 'tw:text-primary' : 'tw:text-destructive')} />
      ),
    },
    ledgerColumn({ key: 'ledgerId', header: 'Particulars (Ledger Account)', ledgers, placeholder: '-- pick a ledger --', onChange: updateLine, showGroup: true }),
    ...(enableForex ? [
      choiceColumn({ key: 'curr', header: 'Curr.', options: currencyOptions, onChange: updateLine }),
      amountColumn({ key: 'amountFCY', header: 'Amount (FCY)', onChange: updateLine, cellProps: disabledForInr }),
      amountColumn({ key: 'roe', header: 'Rate (ROE)', placeholder: '', onChange: updateLine, cellProps: disabledForInr }),
    ] : []),
    sideAmountColumn('Dr', 'Debit (₹)', 'tw:border-primary/40 tw:bg-primary/5'),
    sideAmountColumn('Cr', 'Credit (₹)', 'tw:border-destructive/40 tw:bg-destructive/5'),
    ...(enableCostCenter ? [{
      key: 'costCentreId', header: 'Cost Center', className: 'tw:min-w-[150px]',
      cell: (line) => (
        <SelectBox className="tw:w-full" options={centreOptions} value={line.costCentreId} clearable clearLabel="-- none --" placeholder="-- none --"
          onValueChange={(value) => updateLine(line.id, 'costCentreId', value)} />
      ),
    }] : []),
    textColumn({ key: 'remarks', header: 'Line Narration', placeholder: 'Remarks...', onChange: updateLine }),
    removeColumn(removeLine),
  ];

  return (
    <BillingPage className="tw:max-w-[1400px]">
      <PageHeader icon={FileText} title="Voucher Entry (Advanced)" subtitle="Multi-currency, Cost Center Tagging, and Auto-Balancing"
        actions={<ModeSwitch options={VOUCHER_TYPES} value={activeType} onChange={setActiveType} />} />

      {loadError && <Notice tone="warning">{loadError}</Notice>}

      <Panel bodyClassName="tw:flex-col tw:gap-4 tw:lg:flex-row">
        <div className="tw:grid tw:flex-1 tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          <Field layout="col" label="Branch">
            <SelectBox className="tw:w-full" options={branchOptions} value={branch} onValueChange={setBranch} clearable clearLabel="-- none --" placeholder="-- none --" />
          </Field>
          <Field layout="col" label="Date"><DateInput value={date} onValueChange={setDate} /></Field>
          <VoucherNumberField voucherNumber={voucherNumber} baseType={activeType} hasType={Boolean(currentType)} />
          <Field layout="col" label="Reference / Bill No.">
            <Input data-allow-text="" value={refNo} onChange={(event) => setRefNo(event.target.value)} placeholder="Optional..." />
          </Field>
          <Field layout="col" label="Job No. (links this voucher to a job)">
            <Input data-allow-text="" value={jobNo} onChange={(event) => setJobNo(event.target.value)} placeholder="Optional..." />
          </Field>
        </div>
        <div className="tw:flex tw:flex-col tw:justify-center tw:gap-3 tw:border-border tw:lg:border-l tw:lg:pl-6">
          <CheckOption checked={enableForex} onCheckedChange={setEnableForex} label="Multi-Currency (Forex)" labelClassName="tw:text-primary" />
          <CheckOption checked={enableCostCenter} onCheckedChange={setEnableCostCenter} label="Enable Cost Centers" labelClassName="tw:text-success" />
        </div>
      </Panel>

      <div>
        <DataTable columns={columns} rows={lines} stickyHeader={false} className="tw:text-entry" />
        <div className="tw:flex tw:flex-col tw:gap-2 tw:border tw:border-t-0 tw:border-border tw:bg-page tw:p-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
          <Button onClick={addLine}><Plus /> Add Ledger Line</Button>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:md:justify-end">
            <span className="tw:text-sm tw:font-bold tw:text-primary">Dr ₹ {plainTotal(totals.dr)}</span>
            <span className="tw:text-sm tw:font-bold tw:text-destructive">Cr ₹ {plainTotal(totals.cr)}</span>
            {totals.diff > 0 && (
              <Button onClick={autoBalance}><Calculator /> Auto-Balance (Diff: ₹{totals.diff.toFixed(2)})</Button>
            )}
            {totals.diff === 0 && totals.dr > 0 && (
              <span className="tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-bold tw:text-success"><CheckCircle className="tw:size-4" /> Tallied</span>
            )}
          </div>
        </div>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-4 tw:md:flex-row">
        <Field layout="col" label="Common Narration" className="tw:flex-1">
          <Textarea data-allow-text="" rows={3} value={narration} onChange={(event) => setNarration(event.target.value)} placeholder="Type narration here..." />
        </Field>
        <div className="tw:flex tw:w-full tw:flex-col tw:justify-end tw:gap-3 tw:md:w-[300px]">
          <FileButton size="lg" className="tw:border-dashed tw:text-muted-foreground" accept={ATTACHMENT_TYPES} multiple onFiles={attach} disabled={attachments.uploading}>
            <Paperclip /> {attachments.uploading ? 'Uploading...' : attachments.docs.length ? 'Attach more (' + attachments.docs.length + ')' : 'Attach Supporting Docs'}
          </FileButton>
          <AttachmentList docs={attachments.docs} onRemove={removeDoc} showSize />
          <Button size="lg" variant="default" onClick={save} disabled={posting}><Save /> {posting ? 'Posting...' : 'Post Voucher'}</Button>
        </div>
      </div>
    </BillingPage>
  );
}
