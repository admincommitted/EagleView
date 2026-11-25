import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { fmtDate, fyEnd, fyStart, lookup } from '../../ui';
import { printVoucher } from '../../printVoucher';
import { saveCsv } from '../../ReportsDeskParts/csvFile';
import { num, sumOf } from '../amounts';
import { accountsOf, deskSearchParams } from '../voucherConfig';

const FILTER_KEYS = ['q', 'status', 'ledgerId', 'vno', 'refNo', 'jobNo', 'branch', 'amount', 'narration'];
const blankSearch = () => ({ from: fyStart(), to: fyEnd(), q: '', status: '', ledgerId: '', vno: '', refNo: '', jobNo: '', branch: '', amount: '', narration: '' });

export function useVoucherSearch({ cfg, onCopy }) {
  const [filters, setFilters] = useState(blankSearch);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ledgers, setLedgers] = useState([]);
  const [years, setYears] = useState([]);
  const [moreFilters, setMoreFilters] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadLookups = async () => {
      const [ledgerList, yearList] = await Promise.all([lookup('ledgers'), lookup('years')]);
      setLedgers(ledgerList);
      setYears(yearList);
    };
    loadLookups();
  }, []);

  const run = async (current = filters) => {
    setBusy(true);
    const params = { ...deskSearchParams(cfg), from: current.from, to: current.to };
    FILTER_KEYS.forEach((key) => { if (current[key]) params[key] = current[key]; });
    try {
      setRows(await accountsApi.voucherDeskSearch(params));
    } catch {
      setRows([]);
    }
    setBusy(false);
  };
  useEffect(() => { run(); }, []);

  const clear = () => {
    const blank = blankSearch();
    setFilters(blank);
    run(blank);
  };
  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const yearOf = (year) => ({ from: String(year.startDate).slice(0, 10), to: String(year.endDate).slice(0, 10) });
  const pickedYear = years.find((year) => yearOf(year).from === filters.from && yearOf(year).to === filters.to);
  const pickYear = (id) => {
    const year = years.find((item) => String(item.id) === id);
    if (year) setFilters((current) => ({ ...current, ...yearOf(year) }));
  };

  const withVoucher = async (id, handleVoucher) => {
    try {
      handleVoucher(await accountsApi.voucherDeskVoucher(id));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };
  const print = (id) => withVoucher(id, (voucher) => { if (!printVoucher(voucher)) setMessage('Allow pop-ups for this site to print'); });
  const copy = (id) => withVoucher(id, onCopy);

  const exportCsv = () => saveCsv(
    cfg.title.replace(/[^\w]+/g, '_') + '_vouchers',
    ['Date', 'Voucher No', 'Type', 'Status', 'Accounts', 'Amount', 'Ref / Chq', 'Job', 'Narration'],
    rows.map((voucher) => [
      fmtDate(voucher.date), voucher.voucherNumber, voucher.typeName, voucher.status || 'Pending',
      accountsOf(voucher).map((account) => account.name + ' ' + account.dc + ' ' + account.amount).join('; '),
      voucher.totalAmount, voucher.refNo || '', voucher.jobNo || '', voucher.narration || '',
    ]),
  );

  const total = sumOf(rows, (voucher) => num(voucher.totalAmount));
  return {
    filters, setFilter, rows, busy, ledgers, years, pickedYear, pickYear, moreFilters, setMoreFilters, message, total,
    run, clear, print, copy, exportCsv,
  };
}
