import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightCircle, Calculator, FileText, Globe, IndianRupee, Landmark, Paperclip, Plus, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/axiosInstance';
import { Badge, Button, DateInput, Field, FileButton, Input, NumberInput, SelectBox } from '@/components/ui';
import { accountsApi } from '@/pages/AccountsHubParts/accountsApi';
import PageHeader from '@/pages/PurchaseParts/PageHeader';
import Notice from '@/pages/PurchaseParts/Notice';
import { BillingPage, Panel } from './BillingParts/layout';
import CheckOption from './BillingParts/CheckOption';
import AttachmentList from './BillingParts/AttachmentList';
import LedgerPicker from './BillingParts/LedgerPicker';
import DeductionFields from './BillingParts/DeductionFields';
import AllocationTable from './BillingParts/AllocationTable';
import useDraftAttachments from './BillingParts/useDraftAttachments';
import useVoucherNumber from './BillingParts/useVoucherNumber';
import VoucherNumberField from './BillingParts/VoucherNumberField';
import {
  BANK_CASH_GROUPS, INSTRUMENT_TYPES, PAYMENT_VOUCHER_TYPES, allocateOldestFirst, allocationPostings, allocationsFromBills, onAccountRow,
  partyGroupsFor, paymentDetails,
} from './BillingParts/paymentPostings';
import {
  BANK_ADVICE_TYPES, EVEN_ON_ERROR, amountOf, currencyRows, displayDate, foreignCurrencyCodes, inr, ledgerIdNamed, ledgersFromTree,
  refusedUnlessOk, sortedByName, todayYmd, voucherTypeFor, voucherTypesFrom,
} from './BillingParts/billingData';

const CLEARED_AMOUNTS = { receivedAmountINR: '', receivedAmountFCY: '', bankCharges: '', tdsDeducted: '', forexGainLoss: '', instrumentNo: '', narration: '' };

const bankLedgerLabel = (ledger) => ledger.name + (ledger.bankAccount ? ' - ' + ledger.bankAccount : '');

export default function PaymentReceiptEntry() {
  const [voucherType, setVoucherType] = useState('Receipt');
  const [currency, setCurrency] = useState('INR');
  const [roe, setRoe] = useState(1);
  const [enableForex, setEnableForex] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [voucherTypes, setVoucherTypes] = useState([]);
  const [bankLedgers, setBankLedgers] = useState([]);
  const [parties, setParties] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [posting, setPosting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [partyInfo, setPartyInfo] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const attachments = useDraftAttachments('pr');
  const [form, setForm] = useState({
    date: todayYmd(),
    bankCashLedgerId: '', partyLedgerId: '',
    receivedAmountFCY: '', receivedAmountINR: '',
    bankCharges: '', tdsDeducted: '', forexGainLoss: '',
    tdsLedgerId: '', chargesLedgerId: '', forexLedgerId: '',
    instrumentType: 'NEFT/RTGS', instrumentNo: '', narration: '',
  });

  const isReceipt = voucherType === 'Receipt';
  const isContra = voucherType === 'Contra';
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));

  useEffect(() => {
    (async () => {
      try {
        const [bankBody, mastersBody, currenciesBody, treeBody] = await Promise.all([
          accountsApi.billingLedgersByGroup(BANK_CASH_GROUPS, EVEN_ON_ERROR),
          accountsApi.accountingMasters(EVEN_ON_ERROR),
          accountsApi.billingCurrencies(EVEN_ON_ERROR),
          accountsApi.ledgerTree(EVEN_ON_ERROR),
        ]);
        const banks = bankBody?.data || [];
        setBankLedgers(banks);
        setVoucherTypes(voucherTypesFrom(mastersBody));
        setCurrencies(currencyRows(currenciesBody));
        const ledgers = sortedByName(ledgersFromTree(treeBody));
        setAllLedgers(ledgers);
        // sensible defaults for the deduction heads, by name - never created silently
        const named = (pattern) => ledgerIdNamed(ledgers, pattern) || '';
        setForm((previous) => ({
          ...previous,
          tdsLedgerId: named(/TDS\s*(Receivable|Recoverable)/i) || named(/\bTDS\b/i),
          chargesLedgerId: named(/Bank\s*Charge/i),
          forexLedgerId: named(/(Forex|Exchange).*(Gain|Loss)/i),
        }));
        if (!banks.length) {
          setLoadError((bankBody?.note || 'No bank or cash ledger exists yet.') + ' Create your bank and cash ledgers under "Bank Accounts" / "Cash-in-Hand" in Chart of Accounts first.');
        }
      } catch (error) {
        setLoadError('Could not load the masters: ' + errorMessage(error));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const body = await accountsApi.billingLedgersByGroup(partyGroupsFor(voucherType), EVEN_ON_ERROR);
        setParties(body?.data || []);
      } catch {
        setParties([]);
      }
      setForm((previous) => ({ ...previous, partyLedgerId: '' }));
      setPartyInfo(null);
      setAllocations([]);
    })();
  }, [voucherType]);

  const currentType = useMemo(() => voucherTypeFor(voucherTypes, voucherType), [voucherTypes, voucherType]);
  const voucherNumber = useVoucherNumber(currentType);

  const loadBills = useCallback(async (partyLedgerId) => {
    if (!partyLedgerId || isContra) { setPartyInfo(null); setAllocations([]); return; }
    try {
      const body = refusedUnlessOk(await accountsApi.pendingBills({
        ledgerId: partyLedgerId, type: isReceipt ? 'receivable' : 'payable', asOn: form.date,
      }));
      setPartyInfo(body);
      setAllocations(allocationsFromBills(body.bills));
    } catch (error) {
      setPartyInfo(null);
      setAllocations([]);
      toast.error('Could not load pending bills: ' + errorMessage(error));
    }
  }, [isContra, isReceipt, form.date]);

  useEffect(() => { loadBills(form.partyLedgerId); }, [form.partyLedgerId, loadBills]);

  const totalAllocated = useMemo(() => allocations.reduce((sum, row) => sum + amountOf(row.allocatedAmt), 0), [allocations]);
  // what the party's account must be credited with: cash received + whatever they withheld
  const creditToParty = amountOf(form.receivedAmountINR) + amountOf(form.tdsDeducted) + (enableForex ? amountOf(form.forexGainLoss) : 0);

  const autoAllocate = () => {
    if (creditToParty <= 0) { toast.error('Enter the amount received first'); return; }
    const result = allocateOldestFirst(allocations, creditToParty);
    setAllocations(result.allocations);
    if (result.left > 0.009) toast.success('Oldest bills allocated. ' + result.left.toFixed(2) + ' is left over - add an On Account row for it.');
    else toast.success('Allocated oldest bills first');
  };

  const attach = async (files) => {
    if (!files.length) return;
    try {
      const body = await attachments.upload(files, 'BANK_ADVICE');
      attachments.setDocs([...attachments.docs, ...(body?.data || [])]);
      toast.success('Attached');
    } catch (error) {
      toast.error('Attach failed: ' + errorMessage(error));
    }
  };

  const validationError = () => {
    if (!currentType) return 'There is no "' + voucherType + '" voucher type in Accounting Masters yet';
    if (!form.bankCashLedgerId) return 'Pick the bank or cash ledger';
    if (!form.partyLedgerId) return isContra ? 'Pick the other bank / cash ledger' : 'Pick the party';
    if (String(form.bankCashLedgerId) === String(form.partyLedgerId)) return 'The two sides cannot be the same ledger';
    if (amountOf(form.receivedAmountINR) <= 0) return 'Enter the amount';
    if (!voucherNumber.isAuto && !voucherNumber.number.trim()) return 'This voucher type is on manual numbering - type a number';
    if (amountOf(form.tdsDeducted) && !form.tdsLedgerId) return 'Pick the ledger the TDS should go to';
    if (amountOf(form.bankCharges) && !form.chargesLedgerId) return 'Pick the ledger the bank charges should go to';
    if (enableForex && amountOf(form.forexGainLoss) && !form.forexLedgerId) return 'Pick the ledger the exchange gain / loss should go to';
    if (!isContra && totalAllocated - creditToParty > 0.01) {
      return 'Allocated ' + totalAllocated.toFixed(2) + ' but only ' + creditToParty.toFixed(2) + ' is being credited to the party';
    }
    return '';
  };

  const save = async () => {
    const problem = validationError();
    if (problem) return toast.error(problem);

    setPosting(true);
    try {
      const body = refusedUnlessOk(await accountsApi.postVoucher({
        voucherTypeId: currentType.id, voucherNumber: voucherNumber.number.trim(), date: form.date,
        narration: [form.narration, form.instrumentType, form.instrumentNo].filter(Boolean).join(' | ') || null,
        refNo: form.instrumentNo || null,
        details: paymentDetails({ form, voucherType, enableForex, currency, roe }),
        allocations: isContra ? [] : allocationPostings({ allocations, partyLedgerId: form.partyLedgerId, enableForex }),
      }));
      await attachments.linkToVoucher(body?.data?.id || body?.id, 'Posted, but the attachment did not link');
      toast.success(voucherType + ' ' + voucherNumber.number + ' posted');
      setForm((previous) => ({ ...previous, ...CLEARED_AMOUNTS, partyLedgerId: '' }));
      setAllocations([]);
      setPartyInfo(null);
      attachments.startNewDraft();
      await voucherNumber.reload();
    } catch (error) {
      toast.error('Not posted: ' + errorMessage(error));
    }
    setPosting(false);
  };

  const changeForeignAmount = (value) => setForm((previous) => ({
    ...previous, receivedAmountFCY: value, receivedAmountINR: (amountOf(value) * amountOf(roe)).toFixed(2),
  }));

  const foreignCodes = foreignCurrencyCodes(currencies);
  const currencyOptions = foreignCodes.length ? foreignCodes : ['USD'];
  const sideOf = (bankSide) => (isReceipt || isContra ? bankSide : bankSide === 'Dr' ? 'Cr' : 'Dr');
  const partyWord = isContra ? 'the other account' : isReceipt ? 'a customer' : 'a vendor';
  const partyGroupName = isContra ? 'Bank Accounts / Cash-in-Hand' : isReceipt ? 'Sundry Debtors' : 'Sundry Creditors';
  const unallocated = creditToParty - totalAllocated;
  const overAllocated = totalAllocated > creditToParty;
  const deductions = [
    { amountKey: 'tdsDeducted', ledgerKey: 'tdsLedgerId', label: `TDS ${isReceipt ? 'deducted by the client' : 'we deducted'} (₹)`, ledgerPlaceholder: '-- which ledger does the TDS go to? --' },
    { amountKey: 'bankCharges', ledgerKey: 'chargesLedgerId', label: 'Bank Charges deducted (₹)', ledgerPlaceholder: '-- which ledger do the charges go to? --' },
    ...(enableForex ? [{
      amountKey: 'forexGainLoss', ledgerKey: 'forexLedgerId', label: 'Exchange Gain/Loss (₹)', negative: true,
      placeholder: '-ve for loss, +ve for gain', ledgerPlaceholder: '-- which ledger takes the gain / loss? --',
    }] : []),
  ];
  const emptyAllocationText = isContra
    ? 'A contra entry moves money between your own accounts - there is nothing to allocate.'
    : form.partyLedgerId ? 'No open bill for this party. Add an On Account row if the money is an advance.' : 'Pick a party to load their pending bills.';

  return (
    <BillingPage className="tw:max-w-[1300px]">
      <PageHeader icon={isReceipt ? IndianRupee : Landmark} title={`${voucherType} Voucher`} subtitle="Multi-currency, TDS, bank charges, and bill-by-bill allocation"
        actions={(
          <>
            <SelectBox className="tw:min-w-[180px] tw:font-bold" options={PAYMENT_VOUCHER_TYPES} value={voucherType} onValueChange={setVoucherType} />
            <Button size="lg" variant="default" onClick={save} disabled={posting}><Save /> {posting ? 'Posting...' : 'Post Voucher'}</Button>
          </>
        )} />

      {loadError && <Notice tone="warning">{loadError}</Notice>}
      <AttachmentList inline title="Attached:" docs={attachments.docs} onRemove={(id) => attachments.setDocs(attachments.docs.filter((doc) => doc.id !== id))} />

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:lg:grid-cols-3">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-4 tw:lg:col-span-2">
          <Panel icon={FileText} title="Voucher Profile"
            actions={<CheckOption checked={enableForex} onCheckedChange={setEnableForex} icon={Globe} label="Enable Multi-Currency (Forex)" labelClassName="tw:text-primary" />}>
            <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
              <VoucherNumberField voucherNumber={voucherNumber} autoSuffix=" (Auto)" baseType={voucherType} hasType={Boolean(currentType)} />
              <Field layout="col" label="Date"><DateInput value={form.date} onValueChange={(value) => setField('date', value)} /></Field>
              <Field layout="col" label={`Bank / Cash Ledger (${sideOf('Dr')}.)`} className="tw:sm:col-span-2">
                <LedgerPicker ledgers={bankLedgers} describe={bankLedgerLabel} value={form.bankCashLedgerId} placeholder="-- pick a bank / cash ledger --"
                  onChange={(value) => setField('bankCashLedgerId', value)} />
              </Field>
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
              <Field layout="col" className="tw:sm:col-span-2" label={`${isContra ? 'Other Bank / Cash Ledger' : 'Party Ledger'} (${sideOf('Cr')}.)`}>
                <div className="tw:flex tw:w-full tw:flex-col tw:gap-1">
                  <LedgerPicker ledgers={parties} value={form.partyLedgerId} placeholder={`-- pick ${partyWord} --`} onChange={(value) => setField('partyLedgerId', value)} />
                  {!isContra && partyInfo && (
                    <span className={cn('tw:text-[11px] tw:font-bold', partyInfo.balance > 0 ? 'tw:text-destructive' : 'tw:text-success')}>
                      Outstanding as on {displayDate(form.date)}: &#8377; {inr(partyInfo.balance)} {partyInfo.balanceSide}
                      {partyInfo.ledger?.creditDays ? ' · ' + partyInfo.ledger.creditDays + ' day terms' : ''}
                    </span>
                  )}
                  {!isContra && form.partyLedgerId && partyInfo && !(partyInfo.bills || []).length && (
                    <span className="tw:text-[11px] tw:text-muted-foreground">No open bill for this party - the receipt will sit on account.</span>
                  )}
                  {!parties.length && <span className="tw:text-[11px] tw:text-warning">No ledger under {partyGroupName} yet.</span>}
                </div>
              </Field>

              {enableForex ? (
                <>
                  <Field layout="col" label="Currency & ROE">
                    <div className="tw:flex tw:w-full tw:gap-2">
                      <SelectBox className="tw:w-1/2" options={currencyOptions} value={currency} onValueChange={setCurrency} placeholder="Currency" />
                      <NumberInput className="tw:w-1/2" value={roe} onValueChange={setRoe} placeholder="Rate" />
                    </div>
                  </Field>
                  <Field layout="col" label="Receipt Amt (FCY)" labelClassName="tw:text-success"
                    note={'= ₹ ' + inr(amountOf(form.receivedAmountINR))}>
                    <NumberInput className="tw:font-bold tw:text-success" value={form.receivedAmountFCY} onValueChange={changeForeignAmount} />
                  </Field>
                </>
              ) : (
                <Field layout="col" className="tw:sm:col-span-2" labelClassName="tw:text-sm tw:font-bold tw:text-success"
                  label={`Total Amount ${isReceipt ? 'Received' : isContra ? 'Transferred' : 'Paid'} (₹)`}>
                  <NumberInput className="tw:h-9 tw:text-lg tw:font-bold tw:text-success" value={form.receivedAmountINR} onValueChange={(value) => setField('receivedAmountINR', value)} />
                </Field>
              )}
            </div>
          </Panel>

          <Panel icon={ShieldCheck} title="Remittance & Instrument Details">
            <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
              <Field layout="col" label="Instrument Type">
                <SelectBox className="tw:w-full" options={INSTRUMENT_TYPES} value={form.instrumentType} onValueChange={(value) => setField('instrumentType', value)} />
              </Field>
              <Field layout="col" label="Instrument / UTR No.">
                <Input data-allow-text="" value={form.instrumentNo} onChange={(event) => setField('instrumentNo', event.target.value)} />
              </Field>
              <Field layout="col" label="Narration" className="tw:sm:col-span-2">
                <div className="tw:flex tw:w-full tw:gap-2">
                  <Input data-allow-text="" value={form.narration} onChange={(event) => setField('narration', event.target.value)} placeholder="Being payment received against..." />
                  <FileButton size="icon" accept={BANK_ADVICE_TYPES} multiple onFiles={attach} disabled={attachments.uploading}
                    title="Attach the SWIFT copy / cheque image / bank advice" aria-label="Attach the SWIFT copy / cheque image / bank advice">
                    <Paperclip />
                  </FileButton>
                </div>
              </Field>
            </div>
          </Panel>
        </div>

        <Panel icon={Calculator} title="Deductions & Adjustments" className="tw:bg-page">
          <p className="tw:m-0 tw:text-entry tw:normal-case tw:text-muted-foreground">Record taxes and bank charges directly here to auto-route to respective ledgers.</p>
          <DeductionFields deductions={deductions} form={form} onChange={setField} ledgers={allLedgers} />
          <div className="tw:mt-2 tw:flex tw:justify-between tw:rounded-md tw:border tw:border-border tw:bg-background tw:p-3">
            <span className="tw:text-entry tw:font-bold tw:text-muted-foreground">Total Credit to Party:</span>
            <span className="tw:text-sm tw:font-bold">₹ {inr(creditToParty)}</span>
          </div>
        </Panel>
      </div>

      <Panel title="Bill-by-Bill Allocation (Knock-off)" className="tw:border-t-4 tw:border-t-foreground"
        actions={(
          <>
            <Button onClick={autoAllocate}><ArrowRightCircle /> Auto-FIFO</Button>
            <Button variant="default" onClick={() => setAllocations([...allocations, onAccountRow()])}><Plus /> Add Row</Button>
          </>
        )}>
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <Badge variant="neutral" className="tw:text-[11px]">To allocate: ₹ {inr(creditToParty)}</Badge>
          {Math.abs(unallocated) > 0.009 && creditToParty > 0 && (
            <Badge variant={overAllocated ? 'danger' : 'warning'} className="tw:text-[11px]">
              {overAllocated ? 'Over-allocated by ' : 'Unallocated: '}₹ {inr(Math.abs(unallocated))}
            </Badge>
          )}
        </div>
        <AllocationTable allocations={allocations} onAllocationsChange={setAllocations} enableForex={enableForex} currency={currency} roe={roe}
          emptyText={emptyAllocationText} totalAllocated={totalAllocated} />
        {partyInfo?.basis && (
          <p className="tw:m-0 tw:text-[11px] tw:normal-case tw:text-muted-foreground">
            Pending amounts shown here: {partyInfo.basis}. What you allocate below is stored against the bill,
            so from this voucher on, the outstanding report is exact for this party rather than FIFO.
          </p>
        )}
      </Panel>
    </BillingPage>
  );
}
