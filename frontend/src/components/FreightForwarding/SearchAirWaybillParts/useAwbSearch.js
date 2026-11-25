import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { freightApi } from '../freightApi';
import { pageCountOf, pageSlice } from '../AirExportParts/airExport';
import { awbRowKey, EMPTY_FILTERS, hasCriteria, readLastSearch, sortRows, sortsDescendingFirst, writeLastSearch } from './searchConfig';

const TOAST_ID = 'query-toast';

const searchFailure = (error) => (error.response ? error.response.data?.error || 'Failed to fetch data.' : 'Error fetching data.');

const uniqueBy = (items, keyOf) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function usePickLists() {
  const [parties, setParties] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [awbs, setAwbs] = useState([]);

  useEffect(() => {
    const loadPartiesAndAirlines = async () => {
      try {
        const data = await freightApi.forwarderTransactions({ docType: 'All' });
        if (!data.success) return;
        if (data.parties) setParties(data.parties);
        if (data.airlines) setAirlines(data.airlines);
      } catch (error) {
        console.error(error);
      }
    };
    const loadAwbs = async () => {
      try {
        const data = await freightApi.awbList();
        setAwbs(Array.isArray(data.data) ? data.data : []);
      } catch (error) {
        console.error(error);
      }
    };
    loadPartiesAndAirlines();
    loadAwbs();
  }, []);

  return useMemo(() => {
    const partyOptions = parties.map((party) => ({ value: party.name, label: party.partyType || '' }));
    return {
      awbNumbers: uniqueBy(awbs.filter((awb) => awb.type !== 'HAWB'), (awb) => awb.awbNumber)
        .map((awb) => ({ value: awb.awbNumber, label: `${awb.type} ${awb.destination || ''}`.trim() })),
      hawbNumbers: awbs.filter((awb) => awb.type === 'HAWB' && awb.hawbNumber)
        .map((awb) => ({ value: awb.hawbNumber, label: `MAWB ${awb.awbNumber || '-'}` })),
      airlines: airlines.map((airline) => ({ value: airline.name, label: `${airline.code2 || ''} ${airline.prefix || ''}`.trim() })),
      shippers: partyOptions,
      consignees: partyOptions,
    };
  }, [parties, airlines, awbs]);
}

export function useAwbSearch() {
  const pickLists = usePickLists();
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...(readLastSearch()?.filters || {}) }));
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [picked, setPicked] = useState(() => new Set());

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const search = async (criteria = filters, quiet = false) => {
    if (!hasCriteria(criteria)) {
      toast.error('Please enter at least one search criteria (Date Range, AWB No, Party, etc.) to perform a search.', { id: TOAST_ID });
      return;
    }
    setLoading(true);
    try {
      const result = await freightApi.awbQuery(criteria);
      if (result.success) {
        const found = result.data || [];
        setRows(found);
        setSelectedKey(null);
        setMessage(result.message || '');
        setPage(1);
        setPicked((current) => new Set([...current].filter((key) => found.some((row) => awbRowKey(row) === key))));
        writeLastSearch({ filters: criteria, searched: true });
        if (!quiet) {
          if (found.length === 0) toast.error('No airwaybill records found for the selected criteria.', { id: TOAST_ID });
          else toast.success(`Found ${found.length} records.`, { id: TOAST_ID });
        }
      } else {
        toast.error(result.error || 'Failed to fetch data.', { id: TOAST_ID });
      }
    } catch (error) {
      console.error(error);
      toast.error(searchFailure(error), { id: TOAST_ID });
    }
    setLoading(false);
  };

  const researchQuietly = () => search(filters, true);

  useEffect(() => {
    const last = readLastSearch();
    const lastFilters = { ...EMPTY_FILTERS, ...last?.filters };
    if (last?.searched && last.filters && hasCriteria(lastFilters)) search(lastFilters, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => {
    setFilters(EMPTY_FILTERS);
    setRows([]);
    setMessage('');
    setSelectedKey(null);
    setPicked(new Set());
    writeLastSearch(null);
  };

  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const pageRows = pageSlice(sorted, page, pageSize);
  const pickedRows = sorted.filter((row) => picked.has(awbRowKey(row)));

  const sortBy = (key) => setSort((current) => (current.key === key
    ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: sortsDescendingFirst(key) ? 'desc' : 'asc' }));

  const togglePick = (key) => setPicked((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const togglePage = () => setPicked((current) => {
    const next = new Set(current);
    const allTicked = pageRows.length > 0 && pageRows.every((row) => current.has(awbRowKey(row)));
    pageRows.forEach((row) => (allTicked ? next.delete(awbRowKey(row)) : next.add(awbRowKey(row))));
    return next;
  });

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    pickLists, filters, setFilter, search, researchQuietly, clear, loading, message, rows, sorted, pageRows, pickedRows, picked,
    togglePick, togglePage, clearPicks: () => setPicked(new Set()), selectedKey, setSelectedKey, sort, sortBy,
    page, setPage, pageSize, changePageSize, pageCount: pageCountOf(sorted.length, pageSize),
  };
}
