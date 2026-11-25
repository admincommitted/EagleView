import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { lookup, todayIso } from '../../ui';
import { PRESETS } from '../periods';
import { isNumberColumn, periodText, printReport } from '../reportOutput';

const BUCKETS = [1, 2, 3, 4, 5];
const PRINT_CELL_LIMIT = 400000;

// which filters of the report become which query parameters
const queryOf = (item, filters, params, loadAll) => {
  const query = { ...(item.extra || {}) };
  const on = (key) => filters.includes(key);
  if (on('from')) query.from = params.from;
  if (on('to')) query.to = params.to;
  if (on('asOn')) query.asOn = params.asOn;
  if (on('partyType') && params.partyType) query.type = params.partyType;
  if (on('jobNo') && params.jobNo) query.jobNo = params.jobNo;
  if (on('group') && params.groupId) query.groupId = params.groupId;
  if (on('ledger') && params.ledgerId) query.ledgerId = params.ledgerId;
  if (on('fy') && params.fyId) query.fyId = params.fyId;
  if (on('party') && params.party.trim()) query.party = params.party.trim();
  if (on('billType') && params.billType) query.billType = params.billType;
  // the search runs on the server (Purchase Register loads only the latest 100 bills until you search or ask for all)
  if (on('search') && params.search.trim()) query.q = params.search.trim();
  if (loadAll) query.all = '1';
  if (on('cn') && params.cn) query.cn = '1';
  if (on('rtype')) query.rtype = params.rtype;
  if (on('vtype')) query.vtype = params.vtype;
  if (on('buckets')) {
    BUCKETS.forEach((bucket) => { query['r' + bucket] = String(params['r' + bucket] || 30); });
    if (params.detail) query.detail = '1';
  }
  return query;
};

const totalsOf = (list, totalKeys) => Object.fromEntries(totalKeys.map((key) => [key, list.reduce((sum, row) => sum + (Number(row[key]) || 0), 0)]));

// every register / balance report: filters, totals strip, sort by any column, group with sub-totals, filter rows,
// click a row to open its voucher or ledger, Excel and print
export function useReportView(item) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filters = item.filters || ['from', 'to'];
  const [fyPeriod] = useState(() => PRESETS.thisFy[1]());
  const [params, setParams] = useState({
    from: fyPeriod[0], to: fyPeriod[1], asOn: todayIso(), partyType: '', jobNo: searchParams.get('jobNo') || '', groupId: '', ledgerId: '', fyId: '',
    party: '', search: '', billType: '', cn: false, rtype: 'unbilled', vtype: 'all', detail: false, r1: 30, r2: 30, r3: 30, r4: 30, r5: 30,
  });
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rowFilter, setRowFilter] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [groupBy, setGroupBy] = useState('');
  const [pages, setPages] = useState(1);
  const [closed, setClosed] = useState({});
  const [look, setLook] = useState({ ledgers: [], groups: [], years: [] });
  const [drawerVoucher, setDrawerVoucher] = useState(null);

  useEffect(() => {
    const loadLookups = async () => {
      const [ledgers, groups, years] = await Promise.all([
        filters.includes('ledger') ? lookup('ledgers') : [], filters.includes('group') ? lookup('groups') : [], filters.includes('fy') ? lookup('years') : [],
      ]);
      setLook({ ledgers, groups, years });
    };
    loadLookups();
  }, [item.id]);

  const run = async (loadAll) => {
    if (filters.includes('ledger') && !params.ledgerId) { setError('Choose the account'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await accountsApi.reportsDeskReport(item.report, queryOf(item, filters, params, loadAll === true));
      setData(result);
      setClosed({});
      setGroupBy(result.groupBy || '');
      setSort({ key: null, dir: 1 });
    } catch (failure) {
      setError(errorMessage(failure));
      setData(null);
    }
    setBusy(false);
  };
  useEffect(() => { if (!filters.includes('ledger')) run(); }, [item.id]);
  useEffect(() => { setPages(1); }, [data]);

  const columns = data ? data.columns : [];
  // the grouped column shows as the heading of each block, not again on every row
  const shownColumns = groupBy ? columns.filter((column) => column.key !== groupBy) : columns;
  const groupColumns = columns.filter((column) => (column.type === 'text' || column.key === groupBy) && column.key !== 'narration');
  const rows = useMemo(() => {
    if (!data) return [];
    const text = rowFilter.toLowerCase();
    let list = data.rows.filter((row) => !rowFilter || columns.some((column) => String(row[column.key] ?? '').toLowerCase().includes(text)));
    if (sort.key) {
      const column = columns.find((item) => item.key === sort.key);
      list = [...list].sort((a, b) => {
        const difference = column && isNumberColumn(column)
          ? (Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0)
          : String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''));
        return difference * sort.dir;
      });
    }
    return list;
  }, [data, rowFilter, sort]);
  const totalKeys = data?.totals || [];
  const totals = useMemo(() => totalsOf(rows, totalKeys), [rows]);
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const byKey = new Map();
    for (const row of rows) {
      const key = String(row[groupBy] ?? '') || '(blank)';
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(row);
    }
    return [...byKey.entries()].map(([key, list]) => ({ k: key, list, t: totalsOf(list, totalKeys) }));
  }, [rows, groupBy]);

  // a voucher row opens the Voucher Details side panel, a ledger row the ledger
  const drill = (row) => {
    if (row._v) setDrawerVoucher(row._v);
    else if (row._l) navigate('/accounts-hub?item=ledger&ledger=' + row._l);
  };
  const canDrill = rows.some((row) => row._v || row._l);
  const sortBy = (column) => setSort((current) => ({ key: column.key, dir: current.key === column.key ? -current.dir : (isNumberColumn(column) ? -1 : 1) }));
  const pickGroup = (key) => {
    setGroupBy(key);
    setClosed({});
  };
  const toggleGroup = (key) => setClosed((current) => ({ ...current, [key]: !current[key] }));
  const setParam = (key) => (value) => setParams((current) => ({ ...current, [key]: value }));
  const setPeriod = (from, to) => setParams((current) => ({ ...current, from, to }));

  // rows shown = a cell budget (wide reports) x "Show more"
  const cap = Math.min(rows.length, Math.max(100, Math.min(1000, Math.floor(150000 / Math.max(1, shownColumns.length)))) * pages);
  const outputArgs = () => ({
    title: item.label, subtitle: data.subtitle || item.label, period: periodText(data, filters, params), scope: item.scope || 'All Branches',
    cols: shownColumns, groups, rows, totals, totalKeys, note: data.note,
  });
  const print = () => {
    if (rows.length * Math.max(1, shownColumns.length) > PRINT_CELL_LIMIT) {
      setError('This report is too big to print (' + rows.length + ' rows x ' + shownColumns.length + ' columns) - use Excel, or narrow the period / party');
      return;
    }
    printReport(outputArgs());
  };
  const drawerIds = (groups ? groups.flatMap((group) => (closed[group.k] ? [] : group.list)) : rows.slice(0, cap)).map((row) => row._v);
  const moneyTotals = totalKeys.map((key) => columns.find((column) => column.key === key)).filter(Boolean).slice(0, 8);

  return {
    filters, params, setParam, setPeriod, look, data, busy, error, setError, run, columns, shownColumns, groupColumns, rows, totals, totalKeys, groups,
    rowFilter, setRowFilter, sort, sortBy, groupBy, pickGroup, closed, toggleGroup, cap, showMore: () => setPages((count) => count + 1),
    drill, canDrill, drawerVoucher, setDrawerVoucher, drawerIds, outputArgs, print, moneyTotals, period: data ? periodText(data, filters, params) : '',
  };
}
