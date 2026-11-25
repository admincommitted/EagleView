import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { fmtDate, lookup, todayIso, useBalance } from '../../ui';
import { ledgerByName, readExcel, sampleExcel } from '../../extras';
import { num, plural, r2, skippedNote, sumOf } from '../amounts';
import { blankEntry, cashFromVoucher } from '../cashFromVoucher';
import { BANK_GROUPS, divFrom, nextVoucherNo, sampleFileName, voucherIdFromSave } from '../voucherConfig';
import { useMyBranches } from './useMyBranches';
import { useNextVoucherNumber } from './useNextVoucherNumber';

const EXCEL_COLUMNS = [
  { key: 'account', label: 'Account Name', aliases: ['account', 'party', 'ledger'] }, { key: 'amount', label: 'Amount' },
  { key: 'jobNo', label: 'Docket No', aliases: ['job no', 'job', 'docket'] }, { key: 'tdsAccount', label: 'TDS Account' },
  { key: 'tdsAmt', label: 'TDS Amount', aliases: ['tds'] }, { key: 'remarks', label: 'Remarks', aliases: ['narration'] },
];
const EXCEL_EXAMPLE = [['ABC EXPORTS', 11800, 'AE/001', '', '', 'Against INV/1']];

const billKeyOf = (bill) => bill.voucherId || bill.refNo;
const allocatedOf = (entry) => sumOf(Object.values(entry.allocs), num);

const heldBillsOf = async (ledgerId) => {
  try {
    return await accountsApi.voucherDeskHeldBills(ledgerId);
  } catch {
    return [];
  }
};

const blankHeader = () => ({ date: todayIso(), voucherNumber: '', refNo: '', narration: '', branchCode: '', costCentreId: '', payBy: 'NEFT', chqNo: '', chqDate: todayIso(), drawee: '' });

// receipt / payment / remittance: one cash-bank book, the party lines (with TDS, bank charges and bills set off) above it
export function useCashForm({ cfg, typeId, initial, editId, onSaved }) {
  const [seed] = useState(() => (initial ? cashFromVoucher(initial, cfg) : null));
  const pay = cfg.partySide === 'Dr';
  const bankSide = pay ? 'Cr' : 'Dr';
  const [header, setHeader] = useState(() => (seed
    ? { ...seed.header, ...(editId ? {} : { date: todayIso(), voucherNumber: '', chqNo: '', chqDate: todayIso() }) }
    : blankHeader()));
  const branches = useMyBranches();
  const [look, setLook] = useState({ all: [], banks: [], cc: [] });
  const [bank, setBank] = useState(seed ? seed.bank : '');
  const [entry, setEntry] = useState(() => ({ ...blankEntry(), currency: cfg.fcy ? 'USD' : 'INR' }));
  const [editAt, setEditAt] = useState(-1);
  const [entries, setEntries] = useState(() => (seed ? seed.entries.map((item) => (editId ? item : { ...item, allocs: {}, billList: [] })) : []));
  const [bills, setBills] = useState(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const bankBalance = useBalance(bank);
  const party = useBalance(entry.ledgerId);

  useEffect(() => { if (!editId && !header.branchCode && branches.mine) setHeader((current) => ({ ...current, branchCode: branches.mine })); }, [branches.mine]);
  useEffect(() => {
    const loadLookups = async () => {
      const [all, banks, cc] = await Promise.all([lookup('ledgers'), lookup('ledgers-in?groups=' + encodeURIComponent(BANK_GROUPS)), lookup('costcentres')]);
      setLook({ all, banks, cc });
    };
    loadLookups();
  }, [typeId]);

  const division = header.division || divFrom(entries.find((item) => item.jobNo)?.jobNo) || divFrom(entry.jobNo);
  useNextVoucherNumber({
    enabled: !editId, keepTyped: true, setHeader,
    fetchNumber: () => nextVoucherNo(typeId, { division, branch: header.branchCode, date: header.date, ledgers: bank || '' }),
    deps: [typeId, division, header.branchCode, header.date, bank],
  });
  // INR amount from the foreign currency
  useEffect(() => {
    if (entry.currency !== 'INR' && num(entry.fcy) && num(entry.roe)) setEntry((current) => ({ ...current, amount: String(r2(num(current.fcy) * num(current.roe))) }));
  }, [entry.fcy, entry.roe, entry.currency]);
  useEffect(() => { setBills(null); }, [entry.ledgerId]);

  const nameOf = (id) => look.all.find((ledger) => String(ledger.id) === String(id))?.name || '';
  const setHeaderField = (key) => (value) => setHeader((current) => ({ ...current, [key]: value }));
  const setEntryField = (key) => (value) => setEntry((current) => ({ ...current, [key]: value }));
  const pickParty = (ledgerId) => setEntry((current) => ({ ...current, ledgerId, allocs: {} }));
  const setAllocation = (bill, value) => setEntry((current) => ({ ...current, allocs: { ...current.allocs, [billKeyOf(bill)]: value } }));

  const fetchBills = async () => {
    if (!entry.ledgerId) return setMessage('Choose the account first');
    setMessage('');
    try {
      const [pending, held] = await Promise.all([
        accountsApi.pendingBills({ ledgerId: entry.ledgerId, type: cfg.pending }),
        cfg.pending === 'payable' ? heldBillsOf(entry.ledgerId) : [],
      ]);
      const holdOf = new Map((held || []).map((bill) => [String(bill.voucherId), bill]));
      setBills((pending.bills || []).map((bill) => (bill.voucherId && holdOf.has(String(bill.voucherId)) ? { ...bill, held: holdOf.get(String(bill.voucherId)).holdReason || 'On hold' } : bill)));
    } catch {
      setBills([]);
    }
  };
  const allocTotal = allocatedOf(entry);
  // set the amount off against the oldest bills first (bills on hold are skipped)
  const autoAllocate = () => {
    let left = num(entry.amount);
    const allocs = {};
    const oldestFirst = (bills || []).filter((bill) => !bill.held).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (const bill of oldestFirst) {
      if (left <= 0) break;
      const take = r2(Math.min(left, bill.pending));
      allocs[billKeyOf(bill)] = String(take);
      left = r2(left - take);
    }
    setEntry((current) => ({ ...current, allocs }));
  };

  const add = () => {
    setMessage('');
    if (!entry.ledgerId) return setMessage('Choose the account');
    if (!num(entry.amount)) return setMessage('Enter the amount');
    if (num(entry.tdsAmt) && !entry.tdsLedger) return setMessage('Choose the TDS account');
    if (num(entry.chgAmt) && !entry.chgLedger) return setMessage('Choose the bank charge account');
    if (allocTotal - num(entry.amount) > 0.01) return setMessage('Bills set off are more than the amount');
    const added = { ...entry, billList: bills || entry.billList || [] };
    setEntries((list) => (editAt >= 0 ? list.map((item, index) => (index === editAt ? added : item)) : [...list, added]));
    setEntry({ ...blankEntry(), currency: entry.currency, roe: entry.roe });
    setEditAt(-1);
    setBills(null);
  };
  const editEntry = (index) => {
    const picked = entries[index];
    setEntry(picked);
    setEditAt(index);
    setBills(picked.billList?.length ? picked.billList : null);
  };
  const removeEntry = (index) => {
    setEntries((list) => list.filter((_, position) => position !== index));
    if (editAt === index) { setEditAt(-1); setEntry(blankEntry()); }
  };

  const readXl = async (file) => {
    setMessage('');
    try {
      const sheetRows = await readExcel(file, EXCEL_COLUMNS);
      const bad = [];
      const read = [];
      for (const row of sheetRows) {
        const ledger = ledgerByName(look.all, row.account);
        const tdsLedger = row.tdsAccount ? ledgerByName(look.all, row.tdsAccount) : null;
        if (!ledger) { bad.push('row ' + row._row + ' (account "' + row.account + '" not found)'); continue; }
        if (!(num(row.amount) > 0)) { bad.push('row ' + row._row + ' (no amount)'); continue; }
        if (row.tdsAccount && !tdsLedger) { bad.push('row ' + row._row + ' (TDS account not found)'); continue; }
        read.push({ ...blankEntry(), ledgerId: ledger.id, amount: String(num(row.amount)), jobNo: row.jobNo, tdsLedger: tdsLedger ? tdsLedger.id : '', tdsAmt: tdsLedger ? String(num(row.tdsAmt)) : '', remarks: row.remarks, billList: [] });
      }
      if (read.length) setEntries((list) => [...list, ...read]);
      setMessage((read.length ? 'Read ' + plural(read.length, 'line') + ' from Excel' : 'Nothing read') + skippedNote(bad) + (read.length ? '. Fetch due bills per line with Edit if needed.' : ''));
    } catch (error) {
      setMessage('Could not read the Excel: ' + error.message);
    }
  };
  const downloadSample = () => sampleExcel(sampleFileName(cfg.title), EXCEL_COLUMNS, EXCEL_EXAMPLE);

  const posting = useMemo(() => {
    const lines = [];
    let net = 0;
    entries.forEach((item) => {
      const foreign = item.currency !== 'INR' ? { currency: item.currency, amountFcy: num(item.fcy), roe: num(item.roe) } : {};
      const memo = [header.payBy, header.chqNo && 'No ' + header.chqNo, item.remarks].filter(Boolean).join(' ') || null;
      lines.push({ ledgerId: item.ledgerId, dc: cfg.partySide, amount: r2(num(item.amount)), remarks: memo, costCentreId: header.costCentreId || null, ...foreign });
      if (num(item.tdsAmt)) lines.push({ ledgerId: item.tdsLedger, dc: bankSide, amount: r2(num(item.tdsAmt)), remarks: 'TDS - ' + nameOf(item.ledgerId) });
      if (num(item.chgAmt)) lines.push({ ledgerId: item.chgLedger, dc: 'Dr', amount: r2(num(item.chgAmt)), remarks: 'Bank charges' });
      net += pay ? num(item.amount) - num(item.tdsAmt) + num(item.chgAmt) : num(item.amount) - num(item.tdsAmt) - num(item.chgAmt);
    });
    if (bank && r2(net)) {
      // a single foreign-currency remittance without TDS / charges keeps its currency on the bank line too
      const foreignEntry = cfg.fcy && entries.length === 1 && entries[0].currency !== 'INR' ? entries[0] : null;
      const bankLine = { ledgerId: bank, dc: bankSide, amount: r2(net), remarks: [header.payBy, header.chqNo && 'No ' + header.chqNo, header.drawee].filter(Boolean).join(' ') || null, costCentreId: header.costCentreId || null };
      if (foreignEntry && !num(foreignEntry.tdsAmt) && !num(foreignEntry.chgAmt)) Object.assign(bankLine, { currency: foreignEntry.currency, amountFcy: num(foreignEntry.fcy), roe: num(foreignEntry.roe) });
      lines.push(bankLine);
    }
    return lines;
  }, [entries, bank, header, cfg, look.all]);
  const dr = sumOf(posting.filter((line) => line.dc === 'Dr'), (line) => line.amount);
  const cr = sumOf(posting.filter((line) => line.dc === 'Cr'), (line) => line.amount);
  const bookTotal = r2(sumOf(posting.filter((line) => String(line.ledgerId) === String(bank)), (line) => line.amount));
  const totalTds = r2(sumOf(entries, (item) => num(item.tdsAmt)));

  const save = async () => {
    setMessage('');
    if (!header.voucherNumber) return setMessage('Enter the voucher no');
    if (!header.date) return setMessage('Enter the date');
    if (!header.branchCode) return setMessage('Choose the branch this voucher belongs to');
    if (!bank) return setMessage('Choose the cash / bank book');
    if (!entries.length) return setMessage(entry.ledgerId ? 'Click Add to put the account in the grid' : 'Add at least one account');
    if (Math.abs(dr - cr) > 0.01) return setMessage('Debit and credit must be equal before saving');
    const allocations = cfg.onAccount ? [] : entries.flatMap((item) => (item.billList || [])
      .filter((bill) => num(item.allocs[billKeyOf(bill)]))
      .map((bill) => ({ ledgerId: item.ledgerId, againstVoucherId: bill.voucherId || null, refNo: bill.refNo || bill.billNo || null, refType: 'AGAINST', amount: num(item.allocs[billKeyOf(bill)]) })));
    const cheque = header.chqNo ? ' by ' + header.payBy + ' ' + header.chqNo + ' dt ' + fmtDate(header.chqDate) : '';
    const narration = header.narration || `${cfg.title} ${pay ? 'to' : 'from'} ${entries.map((item) => nameOf(item.ledgerId)).join(', ')}${cheque}`;
    setSaving(true);
    try {
      const body = {
        voucherTypeId: typeId, voucherNumber: header.voucherNumber, division: division || null, ownBranch: header.branchCode || null, date: header.date, narration,
        refNo: header.chqNo || header.refNo || null, jobNo: entries.find((item) => item.jobNo)?.jobNo || null, branchCode: header.branchCode || null, details: posting, allocations,
      };
      if (editId) {
        await accountsApi.voucherDeskUpdate(editId, body);
        onSaved(editId);
      } else {
        onSaved(voucherIdFromSave(await accountsApi.postVoucher(body)));
      }
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };

  return {
    pay, bankSide, header, setHeaderField, branches, look, bank, setBank, bankBalance, party, division,
    entry, setEntryField, pickParty, editAt, entries, bills, allocTotal, setAllocation,
    fetchBills, autoAllocate, add, editEntry, removeEntry, readXl, downloadSample,
    posting, dr, cr, bookTotal, totalTds, nameOf, allocatedOf, message, saving, save,
  };
}
