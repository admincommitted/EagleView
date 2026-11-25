import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { fmtDate, lookup, todayIso } from '../../ui';
import { readExcel } from '../../extras';
import { accountsApi } from '../../accountsApi';
import { daysBetween, digitsOf, num, round2, toExcel } from '../controlUtils';

const SAVE_RELOAD_DELAY_MS = 400;
const NEAR_DATE_DAYS = 10;

export const STATEMENT_COLUMNS = [
  { key: 'date', label: 'Date', aliases: ['txn date', 'value date', 'transaction date', 'tran date'], date: true },
  { key: 'desc', label: 'Description', aliases: ['narration', 'particulars', 'remarks', 'details'] },
  { key: 'ref', label: 'Chq / Ref No', aliases: ['cheque no', 'chq no', 'ref no', 'reference', 'chqrefno', 'utr'] },
  { key: 'wd', label: 'Withdrawal', aliases: ['debit', 'withdrawal amt', 'dr', 'withdrawals'] },
  { key: 'dep', label: 'Deposit', aliases: ['credit', 'deposit amt', 'cr', 'deposits'] },
  { key: 'bal', label: 'Balance', aliases: ['closing balance'] },
];

const refMatches = (statementLine, row) => digitsOf(row.refNo) && (digitsOf(row.refNo) === digitsOf(statementLine.ref) || digitsOf(statementLine.desc).includes(digitsOf(row.refNo)));

// books vs bank: lines cleared by hand or by reading the bank statement; clearing dates are kept until Save
export default function useBankReco() {
  const [banks, setBanks] = useState([]);
  const [filter, setFilter] = useState({ ledgerId: '', from: todayIso().slice(0, 8) + '01', to: todayIso(), stmt: '', show: 'open' });
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [edits, setEdits] = useState({});
  const [ticked, setTicked] = useState({});
  const [bulkDate, setBulkDate] = useState(todayIso());
  const [statementOnly, setStatementOnly] = useState(null);
  const [saving, setSaving] = useState(false);
  const setFilterField = (key, value) => setFilter((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    const loadBanks = async () => {
      const found = await lookup('ledgers-in?groups=Bank Accounts,Bank OD A/c,Cash-in-Hand');
      setBanks(found || []);
      if (found && found.length) setFilter((old) => (old.ledgerId ? old : { ...old, ledgerId: String(found[0].id) }));
    };
    loadBanks();
  }, []);

  const load = async () => {
    if (!filter.ledgerId) return;
    setMsg(''); setEdits({}); setTicked({}); setStatementOnly(null);
    try { setData(await accountsApi.controlBankReco({ ledgerId: filter.ledgerId, from: filter.from, to: filter.to })); } catch (error) { setMsg('Not loaded: ' + errorMessage(error)); }
  };
  useEffect(() => { load(); }, [filter.ledgerId, filter.from, filter.to]);

  const rows = (data && data.rows) || [];
  const clearedOn = (row) => (edits[row.id] !== undefined ? edits[row.id] : row.clearanceDate || '');
  const isOpen = (row) => { const date = clearedOn(row); return !date || date > filter.to; };
  const isEdited = (row) => edits[row.id] !== undefined && (edits[row.id] || '') !== (row.clearanceDate || '');

  const openTotal = (dc) => round2(rows.filter((row) => row.dc === dc && isOpen(row)).reduce((total, row) => total + row.amount, 0));
  const notPresented = openTotal('Cr');
  const notCredited = openTotal('Dr');
  const live = { notPresented, notCredited, bank: data ? round2(data.closing + notPresented - notCredited) : 0 };

  const shown = rows.filter((row) => filter.show === 'all' || (filter.show === 'open' ? isOpen(row) : !isOpen(row)));
  const dirty = Object.keys(edits).filter((id) => { const row = rows.find((entry) => String(entry.id) === id); return row && (edits[id] || '') !== (row.clearanceDate || ''); });

  const setClearedOn = (row, date) => {
    if (date && date < row.date) { setMsg('Clearing date cannot be before the voucher date (' + fmtDate(row.date) + ')'); return; }
    setMsg('');
    setEdits((old) => ({ ...old, [row.id]: date }));
  };

  const save = async () => {
    if (!dirty.length) { setMsg('Nothing changed'); return; }
    setSaving(true);
    try {
      await accountsApi.controlSaveBankReco(dirty.map((id) => ({ id: Number(id), clearanceDate: edits[id] || null })));
      setMsg('Saved ' + dirty.length + ' line' + (dirty.length === 1 ? '' : 's'));
      setTimeout(load, SAVE_RELOAD_DELAY_MS);
    } catch (error) {
      setMsg('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };

  const clearTicked = () => {
    const ids = Object.keys(ticked).filter((id) => ticked[id]);
    if (!ids.length) { setMsg('Tick the lines to clear'); return; }
    const next = { ...edits };
    let skipped = 0;
    ids.forEach((id) => { const row = rows.find((entry) => String(entry.id) === id); if (row && bulkDate >= row.date) next[id] = bulkDate; else skipped++; });
    setEdits(next); setTicked({});
    setMsg(skipped ? skipped + ' line(s) dated after ' + fmtDate(bulkDate) + ' left as they are' : '');
  };
  const toggleRow = (id, value) => setTicked((old) => ({ ...old, [id]: value }));
  const toggleShown = (value) => setTicked((old) => ({ ...old, ...Object.fromEntries(shown.map((row) => [row.id, value])) }));

  // each statement line is paired with an open book line of the same amount and direction: cheque no first, then nearest date
  const readStatement = async (file) => {
    setMsg('');
    try {
      const statement = (await readExcel(file, STATEMENT_COLUMNS)).filter((line) => num(line.wd) || num(line.dep));
      if (!statement.length) { setMsg('No withdrawal / deposit lines found in the statement'); return; }
      const used = new Set(); const next = { ...edits }; const missing = [];
      let matched = 0; let already = 0;
      for (const line of statement) {
        const amount = round2(num(line.wd) || num(line.dep));
        const dc = num(line.wd) ? 'Cr' : 'Dr'; // a withdrawal in the bank is a credit to the bank ledger in our books
        const sameAmount = (row) => !used.has(row.id) && row.dc === dc && Math.abs(row.amount - amount) < 0.01;
        const candidates = rows.filter((row) => sameAmount(row) && isOpen(row) && (!line.date || line.date >= row.date));
        let found = line.ref && digitsOf(line.ref) ? candidates.find((row) => refMatches(line, row)) : null;
        if (!found && line.desc) found = candidates.find((row) => digitsOf(row.refNo).length >= 4 && digitsOf(line.desc).includes(digitsOf(row.refNo)));
        if (!found) {
          found = candidates.filter((row) => !line.date || daysBetween(row.date, line.date) <= NEAR_DATE_DAYS)
            .sort((first, second) => Math.abs(daysBetween(first.date, line.date || first.date)) - Math.abs(daysBetween(second.date, line.date || second.date)))[0];
        }
        if (found) { used.add(found.id); next[found.id] = line.date || filter.to; matched++; continue; }
        // a line the books already show as cleared is not missing
        const done = rows.find((row) => sameAmount(row) && !isOpen(row) && (!line.ref || !digitsOf(row.refNo) || digitsOf(row.refNo) === digitsOf(line.ref) || digitsOf(line.desc).includes(digitsOf(row.refNo))));
        if (done) { used.add(done.id); already++; } else missing.push({ ...line, amount, dc });
      }
      setEdits(next); setStatementOnly(missing);
      const last = [...statement].reverse().find((line) => line.bal !== '' && line.bal != null);
      if (last && !filter.stmt) setFilterField('stmt', String(num(last.bal)));
      setMsg('Statement read: ' + statement.length + ' lines, ' + matched + ' matched with the books (not saved yet - check and Save)' + (already ? ', ' + already + ' already cleared' : '') + ', ' + missing.length + ' not in the books');
    } catch (error) {
      setMsg('Could not read the statement: ' + errorMessage(error));
    }
  };

  const ledger = banks.find((bank) => String(bank.id) === String(filter.ledgerId));
  const exportLines = () => toExcel('brs_' + (ledger ? ledger.name : '') + '_' + filter.to, [[(row) => fmtDate(row.date), 'Date'], ['voucherNumber', 'Voucher'], ['typeName', 'Type'], ['party', 'Party'], ['refNo', 'Chq / Ref'],
    [(row) => (row.dc === 'Dr' ? row.amount : ''), 'Deposit'], [(row) => (row.dc === 'Cr' ? row.amount : ''), 'Withdrawal'], [(row) => fmtDate(clearedOn(row)), 'Cleared on']], shown);
  const exportStatementOnly = () => toExcel('statement_not_in_books', [['date', 'Date'], ['desc', 'Description'], ['ref', 'Ref'], [(line) => (line.dc === 'Cr' ? line.amount : ''), 'Withdrawal'], [(line) => (line.dc === 'Dr' ? line.amount : ''), 'Deposit']], statementOnly);
  const difference = filter.stmt !== '' ? round2(num(filter.stmt) - live.bank) : null;

  return {
    banks, filter, setFilter, setFilterField, data, msg, rows, shown, live, dirty, ticked, bulkDate, setBulkDate, statementOnly, saving, difference,
    clearedOn, isOpen, isEdited, setClearedOn, save, clearTicked, toggleRow, toggleShown, readStatement, load, exportLines, exportStatementOnly,
  };
}
