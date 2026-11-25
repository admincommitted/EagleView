import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { lookup } from '../../ui';
import { PRESETS } from '../periods';
import { exportReportCsv } from '../reportOutput';

const SEARCHED = ['voucherNumber', 'contra', 'refNo', 'jobNo', 'narration', 'typeName'];
const LEDGER_CSV_COLUMNS = [
  { key: 'date', label: 'Date', type: 'date' }, { key: 'typeName', label: 'Type' }, { key: 'voucherNumber', label: 'Voucher No' }, { key: 'contra', label: 'Particulars' },
  { key: 'refNo', label: 'Ref / Chq' }, { key: 'jobNo', label: 'Job' }, { key: 'narration', label: 'Narration' }, { key: 'debit', label: 'Debit' },
  { key: 'credit', label: 'Credit' }, { key: 'balance', label: 'Balance' },
];
const monthOf = (row) => String(row.date).slice(0, 7);

// iCAFFE's Ledger: one account, opening, every entry with the other side, running balance, month totals
export function useLedgerReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ledgers, setLedgers] = useState([]);
  const [fyPeriod] = useState(() => PRESETS.thisFy[1]());
  const [params, setParams] = useState({ ledgerId: searchParams.get('ledger') || '', from: fyPeriod[0], to: fyPeriod[1] });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [showNarration, setShowNarration] = useState(true);
  const [query, setQuery] = useState('');
  const [drawerVoucher, setDrawerVoucher] = useState(null);

  useEffect(() => {
    const loadLedgers = async () => setLedgers(await lookup('ledgers'));
    loadLedgers();
  }, []);

  const run = async (current = params) => {
    if (!current.ledgerId) { setError('Choose the account'); return; }
    setBusy(true);
    setError('');
    try {
      setData(await accountsApi.reportsDeskLedger({ ledgerId: current.ledgerId, from: current.from, to: current.to }));
      const next = new URLSearchParams(searchParams);
      next.set('ledger', current.ledgerId);
      setSearchParams(next);
    } catch (failure) {
      setError(errorMessage(failure));
      setData(null);
    }
    setBusy(false);
  };
  useEffect(() => { if (params.ledgerId) run(); }, []);

  const pickLedger = (ledgerId) => {
    const next = { ...params, ledgerId };
    setParams(next);
    if (ledgerId) run(next);
  };
  const setPeriod = (from, to) => setParams((current) => ({ ...current, from, to }));

  const text = query.toLowerCase();
  const rows = data ? data.rows.filter((row) => !query || SEARCHED.some((key) => String(row[key] || '').toLowerCase().includes(text))) : [];
  const months = useMemo(() => {
    const byMonth = new Map();
    for (const row of rows) {
      const month = byMonth.get(monthOf(row)) || { dr: 0, cr: 0, n: 0, last: 0 };
      month.dr += row.debit;
      month.cr += row.credit;
      month.n++;
      month.last = row.balance;
      byMonth.set(monthOf(row), month);
    }
    return byMonth;
  }, [rows]);
  // the entries, with a month-total line after each month when Month totals is ticked
  const lines = [];
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (monthly && previous && monthOf(previous) !== monthOf(row)) lines.push({ month: monthOf(previous) });
    lines.push(row);
    if (monthly && index === rows.length - 1) lines.push({ month: monthOf(row) });
  });

  const exportCsv = () => exportReportCsv('Ledger_' + data.ledger.name, LEDGER_CSV_COLUMNS, [
    { date: data.from, contra: 'Opening balance', balance: data.opening },
    ...rows,
    { date: data.to, contra: 'Closing balance', debit: data.debit, credit: data.credit, balance: data.closing },
  ]);

  return {
    ledgers, params, pickLedger, setPeriod, data, busy, error, run, monthly, setMonthly, showNarration, setShowNarration, query, setQuery,
    rows, months, lines, drawerVoucher, setDrawerVoucher, exportCsv,
  };
}
