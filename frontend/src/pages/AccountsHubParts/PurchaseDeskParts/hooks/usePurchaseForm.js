import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { inr, todayIso, useBalance } from '../../ui';
import { ledgerByName, readExcel, sampleExcel } from '../../extras';
import { num, plural, skippedNote, sumOf } from '../../VoucherDeskParts/amounts';
import { divFrom } from '../../VoucherDeskParts/voucherConfig';
import { useNextVoucherNumber } from '../../VoucherDeskParts/hooks/useNextVoucherNumber';
import {
  GST_SLABS, HOME_GST_STATE, PURCHASE_DESKS, addDays, blankCharge, blankTds, ddmmyyyy, nearestSlab, tdsNatureOfSection,
} from '../purchaseConfig';
import { billPosting, billTotals, chargeAmounts, splitGst } from '../purchaseCalc';
import { purchaseFromVoucher } from '../purchaseFromVoucher';
import { usePurchaseLookups } from './usePurchaseLookups';
import { usePurchaseOcr } from './usePurchaseOcr';

const EXCEL_COLUMNS = [
  { key: 'charge', label: 'Charge', aliases: ['charge name', 'description'] }, { key: 'ledger', label: 'Expense Ledger', aliases: ['ledger', 'account'] },
  { key: 'sac', label: 'SAC' }, { key: 'pr', label: 'Pay/Rec', aliases: ['payrec'] }, { key: 'currency', label: 'Currency', aliases: ['curr'] },
  { key: 'roe', label: 'Ex Rate', aliases: ['exrate', 'roe'] }, { key: 'qty', label: 'Quantity', aliases: ['qty'] }, { key: 'rate', label: 'Rate' },
  { key: 'gstRate', label: 'GST %', aliases: ['gst', 'gstrate'] }, { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'docket', 'job'] },
  { key: 'remarks', label: 'Narration', aliases: ['remarks'] },
];
const EXCEL_EXAMPLE = [
  ['AIR FREIGHT', 'AIR FREIGHT EXPENSE', '996531', 'Pay', 'USD', 84.5, 120, 2.35, 18, 'AE/001', ''],
  ['INCENTIVE', 'INCENTIVE RECEIVED', '', 'Rec', 'INR', 1, 1, 500, 18, 'AE/001', ''],
];

const blankHeader = () => ({
  voucherNumber: '', date: todayIso(), billNo: '', billDate: todayIso(), dueDate: addDays(todayIso(), 30), jobNo: '', narration: '', supply: 'intra', branchCode: '',
  hblNo: '', mblNo: '', isSez: false, sezType: 'igst', hold: false, holdReason: '', against: '', cnReason: '',
});
const tdsFromNature = (nature, base = 'taxable') => ({ on: true, natureId: String(nature.id), rate: String(nature.rate), base });

// vendor bill (Purchase) or the vendor's credit note against one of its bills (Debit Note, every line reversed)
export function usePurchaseForm({ desk, typeId, initial, editId, draftKey, onSaved }) {
  const [seed] = useState(() => (initial ? purchaseFromVoucher(initial) : null));
  const keepAgainst = useRef(!!seed?.h.against);
  const cfg = PURCHASE_DESKS[desk];
  const [mode, setMode] = useState(seed ? seed.mode : 'bill');
  const [header, setHeader] = useState(() => (seed
    ? { ...seed.h, ...(editId ? {} : { voucherNumber: '', date: todayIso(), billNo: '', hold: false, holdReason: '' }) }
    : blankHeader()));
  const [vendor, setVendor] = useState(seed ? seed.vendor : '');
  const [charge, setCharge] = useState(blankCharge);
  const [editAt, setEditAt] = useState(-1);
  const [lines, setLines] = useState(seed ? seed.lines : []);
  const [tds, setTds] = useState(() => blankTds(true));
  const [tds2, setTds2] = useState(() => blankTds(false));
  const [roundOff, setRoundOff] = useState(seed ? seed.roundOff : true);
  const [bills, setBills] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const { look, cnTypeId } = usePurchaseLookups(typeId);
  const vendorBalance = useBalance(vendor);
  const { ocr, readBill } = usePurchaseOcr({ draftKey, header, setHeader, setVendor, setLines, setMessage });
  const creditNote = mode === 'cn';
  const useType = editId ? initial.voucherTypeId : creditNote ? cnTypeId : typeId;

  // the voucher no follows the type: Purchase for a bill, Debit Note for a vendor credit note
  const division = header.division || divFrom(header.jobNo) || divFrom(lines.find((line) => line.jobNo)?.jobNo);
  useNextVoucherNumber({
    enabled: !!useType && !editId, keepTyped: false, setHeader,
    fetchNumber: () => accountsApi.voucherDeskNextNumber(useType, { division: division || '', branch: header.branchCode || '', date: header.date || '' }),
    deps: [useType, division, header.branchCode, header.date],
  });
  // vendor registered outside the company's GST state -> IGST; can be changed by hand. SEZ is always IGST.
  const vendorGstin = vendorBalance?.gstin;
  useEffect(() => {
    if (!vendorGstin || !/^\d{2}/.test(vendorGstin)) return;
    setHeader((current) => ({ ...current, supply: current.isSez ? 'inter' : vendorGstin.slice(0, 2) === HOME_GST_STATE ? 'intra' : 'inter' }));
  }, [vendorGstin]);
  // TDS sections of the saved bill, once the sections are loaded
  useEffect(() => {
    if (!seed || !look.tds.length) return;
    const first = tdsNatureOfSection(look.tds, seed.tdsSecs[0]);
    const second = tdsNatureOfSection(look.tds, seed.tdsSecs[1]);
    const taxable = sumOf(seed.lines, (line) => (line.pr === 'Rec' ? -1 : 1) * num(line.rate) * num(line.qty || 1) * (line.currency === 'INR' ? 1 : num(line.roe)));
    const baseOf = (nature, amount) => (nature && amount && taxable && Math.abs(Math.round(taxable * num(nature.rate) / 100) - amount) > 1 ? 'bill' : 'taxable');
    setTds(first ? tdsFromNature(first, baseOf(first, seed.tdsAmts[0])) : blankTds(!!seed.tdsAmts[0]));
    setTds2(second ? tdsFromNature(second, baseOf(second, seed.tdsAmts[1])) : blankTds(false));
  }, [look.tds.length]);
  useEffect(() => {
    if (keepAgainst.current) keepAgainst.current = false;
    else setHeader((current) => ({ ...current, against: '' }));
    if (!creditNote || !vendor) { setBills([]); return; }
    const loadBills = async () => {
      try {
        setBills(await accountsApi.purchaseDeskVendorBills(vendor));
      } catch {
        setBills([]);
      }
    };
    loadBills();
  }, [creditNote, vendor]);

  const setHeaderField = (key) => (value) => setHeader((current) => ({ ...current, [key]: value }));
  const setBillDate = (billDate) => setHeader((current) => ({ ...current, billDate, dueDate: billDate ? addDays(billDate, vendorBalance?.creditDays || 30) : current.dueDate }));
  const setChargeField = (key) => (value) => setCharge((current) => ({ ...current, [key]: value }));
  const setChargeCurrency = (currency) => setCharge((current) => ({ ...current, currency, roe: currency === 'INR' ? '1' : current.roe }));

  const switchMode = (next) => {
    if (next === mode || editId) return;
    setMode(next);
    setLines([]);
    setCharge(blankCharge());
    setEditAt(-1);
    setMessage('');
    setTds(blankTds(true));
    setTds2(blankTds(false));
    setHeader((current) => ({ ...current, hold: false, holdReason: '', against: '', cnReason: '', billNo: '', isSez: false, sezType: 'igst', hblNo: '', mblNo: '' }));
  };
  const bill = bills.find((item) => String(item.id) === String(header.against));

  // credit note: copy the charges of the chosen bill, so only the amounts need changing
  const copyFromBill = async () => {
    if (!bill) return setMessage('Choose the bill first');
    try {
      const billVoucher = await accountsApi.voucherDeskVoucher(bill.id);
      const tax = look.tax || {};
      const taxIds = new Set(Object.values(tax).map(String));
      const billLines = billVoucher.lines || [];
      const expenses = billLines.filter((line) => line.dc === 'Dr' && String(line.ledgerId) !== String(vendor) && !taxIds.has(String(line.ledgerId)));
      const inputGstIds = [tax.inputIgst, tax.inputCgst, tax.inputSgst, tax.rcmInput].map(String);
      const gstTotal = sumOf(billLines.filter((line) => line.dc === 'Dr' && inputGstIds.includes(String(line.ledgerId))), (line) => num(line.amount));
      const base = sumOf(expenses, (line) => num(line.amount));
      const slab = nearestSlab(base ? (gstTotal / base) * 100 : 0, '0');
      setLines(expenses.map((line) => ({
        ...blankCharge(), charge: String(line.remarks || line.ledgerName || '').split(' SAC ')[0] || line.ledgerName, ledgerId: line.ledgerId,
        rate: String(line.amount), gstRate: slab, jobNo: billVoucher.jobNo || '',
      })));
      const info = billVoucher.purchase || {};
      const first = tdsNatureOfSection(look.tds, info.tds1Section);
      const second = tdsNatureOfSection(look.tds, info.tds2Section);
      setTds(first ? tdsFromNature(first) : blankTds(true));
      setTds2(second ? tdsFromNature(second) : blankTds(false));
      setHeader((current) => ({
        ...current, jobNo: current.jobNo || billVoucher.jobNo || '', hblNo: current.hblNo || info.hblNo || bill.hblNo || '', mblNo: current.mblNo || info.mblNo || bill.mblNo || '',
        isSez: Number(info.isSez) === 1, sezType: info.sezType || 'igst',
      }));
      setMessage('Charges copied from bill ' + (bill.billNo || bill.voucherNumber) + ' - change the amounts to what the credit note says');
    } catch (error) {
      setMessage('Could not read the bill: ' + errorMessage(error));
    }
  };

  const chargeByName = (name) => look.charges.find((item) => String(item.chargeName).toLowerCase() === String(name || '').trim().toLowerCase());
  // a charge from GST Charges brings its SAC, GST % and expense ledger
  const pickCharge = (name) => {
    const known = look.charges.find((item) => String(item.chargeName).toLowerCase() === String(name).toLowerCase());
    setCharge((current) => (known
      ? { ...current, charge: known.chargeName, sac: known.sacCode || '', gstRate: known.gstRate != null ? String(known.gstRate) : current.gstRate, ledgerId: known.expenseLedgerId || current.ledgerId }
      : { ...current, charge: name }));
  };
  const noTax = header.isSez && header.sezType === 'lut';
  const supply = header.isSez ? 'inter' : header.supply;
  const chargeTotals = chargeAmounts(charge, noTax);
  const chargeGst = splitGst(chargeTotals.gst, supply);
  const lineGst = (line) => splitGst(line.gst, supply);

  const readXl = async (file) => {
    setMessage('');
    try {
      const sheetRows = await readExcel(file, EXCEL_COLUMNS);
      const bad = [];
      const read = [];
      for (const row of sheetRows) {
        const known = chargeByName(row.charge);
        const ledger = row.ledger ? ledgerByName(look.all, row.ledger) : null;
        const ledgerId = ledger ? ledger.id : known?.expenseLedgerId || '';
        if (!row.charge && !ledgerId) { bad.push('row ' + row._row + ' (no charge)'); continue; }
        if (!ledgerId) { bad.push('row ' + row._row + ' (expense ledger "' + (row.ledger || '') + '" not found)'); continue; }
        if (!(num(row.rate) > 0)) { bad.push('row ' + row._row + ' (no rate)'); continue; }
        const currency = String(row.currency || 'INR').toUpperCase();
        const sheetSlab = GST_SLABS.includes(String(num(row.gstRate))) && row.gstRate !== '' ? String(num(row.gstRate)) : null;
        read.push({
          ...blankCharge(), charge: known ? known.chargeName : row.charge, ledgerId, sac: row.sac || known?.sacCode || '', pr: /^r/i.test(row.pr) ? 'Rec' : 'Pay',
          currency, roe: currency === 'INR' ? '1' : String(num(row.roe) || ''), qty: String(num(row.qty) || 1), rate: String(num(row.rate)),
          gstRate: sheetSlab || (known?.gstRate != null ? String(known.gstRate) : '18'), jobNo: row.jobNo || header.jobNo, remarks: row.remarks,
        });
      }
      if (read.length) setLines((list) => [...list, ...read]);
      setMessage((read.length ? 'Read ' + plural(read.length, 'charge') + ' from Excel' : 'Nothing read') + skippedNote(bad));
    } catch (error) {
      setMessage('Could not read the Excel: ' + error.message);
    }
  };
  const downloadSample = () => sampleExcel('trade_invoice_charges_sample', EXCEL_COLUMNS, EXCEL_EXAMPLE);

  const add = () => {
    setMessage('');
    if (!charge.charge && !charge.ledgerId) return setMessage('Choose the charge');
    if (!charge.ledgerId) return setMessage('Choose the expense ledger for this charge');
    if (!chargeTotals.tx) return setMessage('Enter the rate');
    const added = { ...charge, jobNo: charge.jobNo || header.jobNo };
    setLines((list) => (editAt >= 0 ? list.map((item, index) => (index === editAt ? added : item)) : [...list, added]));
    setCharge({ ...blankCharge(), jobNo: charge.jobNo, currency: charge.currency, roe: charge.roe, gstRate: charge.gstRate });
    setEditAt(-1);
  };
  const editLine = (index) => { setCharge(lines[index]); setEditAt(index); };
  const removeLine = (index) => setLines((list) => list.filter((_, position) => position !== index));

  const totals = useMemo(
    () => billTotals({ lines, supply, tds, tds2, roundOff, rcm: cfg.rcm, noTax }),
    [lines, supply, tds, tds2, roundOff, cfg.rcm, noTax],
  );
  const sectionOf = (entry) => look.tds.find((nature) => String(nature.id) === String(entry.natureId))?.section || '';
  const posting = useMemo(
    () => billPosting({ totals, tax: look.tax, rcm: cfg.rcm, tds1Section: sectionOf(tds), tds2Section: sectionOf(tds2), vendor, billNo: header.billNo, creditNote }),
    [totals, vendor, look, cfg.rcm, tds.natureId, tds2.natureId, header.billNo, creditNote],
  );
  const dr = sumOf(posting.filter((line) => line.dc === 'Dr'), (line) => line.amount);
  const cr = sumOf(posting.filter((line) => line.dc === 'Cr'), (line) => line.amount);
  const nameOf = (id) => look.all.find((ledger) => String(ledger.id) === String(id))?.name || '';

  const validationError = () => {
    if (!useType) return creditNote ? 'Voucher type "Debit Note" is missing - add it in Masters, Voucher types' : 'Voucher type is missing';
    if (!vendor) return 'Choose the party (vendor)';
    if (!header.billNo) return creditNote ? 'Enter the credit note no given by the vendor' : 'Enter the vendor invoice no';
    if (creditNote && !bill) return 'Choose the bill this credit note is against';
    if (!creditNote && cfg.needJob && !header.jobNo && !lines.some((line) => line.jobNo)) return 'A trade invoice needs the docket / job no';
    if (!lines.length) return charge.charge ? 'Click Add to put the charge in the grid' : 'Add at least one charge';
    if (lines.some((line) => !line.ledgerId)) return 'Every charge needs its expense ledger - Edit the lines marked in red';
    if (totals.taxable <= 0) return 'The charges add up to nil or less - check Pay / Rec on the lines';
    if (header.hold && !header.holdReason.trim()) return 'Give the reason for holding the payment';
    if (tds.on && tds2.on && tds.natureId && tds.natureId === tds2.natureId) return '1st and 2nd TDS have the same section - use one';
    // on Modify the credit note's own amount is still counted against the bill
    const canCredit = bill ? bill.left + (editId && seed && String(seed.h.against) === String(bill.id) ? seed.vendorAmount : 0) : 0;
    if (creditNote && totals.payable - canCredit > 0.01) return 'Credit note ' + inr(totals.payable) + ' is more than what is left on the bill (' + inr(canCredit) + ')';
    if (!look.tax) return 'GST / TDS ledgers could not be set up - check the Duties & Taxes group';
    if (!posting.length || Math.abs(dr - cr) > 0.01) return 'Debit and credit must be equal before saving';
    return '';
  };

  const narrationOf = () => header.narration || (creditNote
    ? `Credit note ${header.billNo} dated ${ddmmyyyy(header.billDate)} against bill ${bill.billNo || bill.voucherNumber}${header.cnReason ? ' - ' + header.cnReason : ''}`
    : `${cfg.title} - bill ${header.billNo} dated ${ddmmyyyy(header.billDate)}, due ${ddmmyyyy(header.dueDate)}${header.hblNo ? ', HBL ' + header.hblNo : ''}`);

  const saveBillDetails = async (voucherId) => {
    try {
      await accountsApi.purchaseDeskSaveInfo(voucherId, {
        kind: creditNote ? 'cn' : 'bill', desk, billNo: header.billNo, billDate: header.billDate, dueDate: creditNote ? null : header.dueDate, hblNo: header.hblNo, mblNo: header.mblNo,
        isSez: header.isSez ? 1 : 0, sezType: header.isSez ? header.sezType : null, tds1Section: totals.tds1Amt ? sectionOf(tds) : null, tds1Amount: totals.tds1Amt || null,
        tds2Section: totals.tds2Amt ? sectionOf(tds2) : null, tds2Amount: totals.tds2Amt || null, againstVoucherId: creditNote ? bill.id : null, cnReason: creditNote ? header.cnReason : null,
        holdPayment: !creditNote && header.hold ? 1 : 0, holdReason: !creditNote && header.hold ? header.holdReason.trim() : null,
      });
    } catch (error) {
      console.warn('bill details not saved', error);
    }
  };

  const save = async () => {
    setMessage('');
    const problem = validationError();
    if (problem) return setMessage(problem);
    setSaving(true);
    try {
      const allocations = creditNote && totals.payable > 0
        ? [{ ledgerId: vendor, againstVoucherId: bill.id, refNo: bill.billNo || bill.voucherNumber, refType: 'AGAINST', amount: totals.payable }]
        : [];
      const body = {
        voucherTypeId: useType, voucherNumber: header.voucherNumber, division: division || null, ownBranch: header.branchCode || null, date: header.date, narration: narrationOf(),
        refNo: header.billNo, jobNo: header.jobNo || lines.find((line) => line.jobNo)?.jobNo || null, branchCode: header.branchCode || null, details: posting,
        ...(creditNote || !editId ? { allocations } : {}),
      };
      let id;
      if (editId) {
        await accountsApi.voucherDeskUpdate(editId, body);
        id = editId;
      } else {
        id = (await accountsApi.postVoucher(body))?.data?.id;
      }
      if (id) await saveBillDetails(id);
      onSaved(id);
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };

  return {
    cfg, mode, creditNote, switchMode, header, setHeaderField, setBillDate, vendor, setVendor, vendorBalance, division, supply, noTax,
    look, bills, bill, copyFromBill, ocr, readBill,
    charge, setCharge, setChargeField, setChargeCurrency, pickCharge, chargeTotals, chargeGst, lineGst, editAt, add, editLine, removeLine, readXl, downloadSample,
    lines, tds, setTds, tds2, setTds2, roundOff, setRoundOff, totals, posting, dr, cr, nameOf, message, saving, save,
  };
}
