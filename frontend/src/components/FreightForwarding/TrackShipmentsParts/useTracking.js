import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { freightApi } from '../freightApi';
import { pageCountOf } from '../AirExportParts/airExport';
import { EMPTY_TRACK_FILTERS, REFRESH_EVERY_MS } from './trackConfig';

const uniqueBy = (items, keyOf) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function useTrackPickLists(airlines) {
  const [awbs, setAwbs] = useState([]);
  const [airports, setAirports] = useState([]);

  useEffect(() => {
    const load = async (request, setList, pick) => {
      try {
        setList(pick(await request()));
      } catch (error) {
        console.error(error);
      }
    };
    load(freightApi.awbList, setAwbs, (data) => (Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []));
    load(freightApi.airportMaster, setAirports, (data) => (Array.isArray(data) ? data : []));
  }, []);

  return useMemo(() => {
    const numbers = awbs.map((awb) => (awb.type === 'HAWB'
      ? { value: awb.hawbNumber, label: `HAWB of ${awb.awbNumber || '-'}` }
      : { value: awb.awbNumber, label: `${awb.type || ''} ${awb.destination || ''}`.trim() }));
    return {
      awbNumbers: uniqueBy(numbers, (option) => option.value),
      airports: airports.map((airport) => ({ value: airport.code, label: airport.name })),
      airlines: airlines.map((airline) => ({ value: airline.name, label: `${airline.code2 || ''} ${airline.prefix || ''}`.trim() })),
    };
  }, [awbs, airports, airlines]);
}

export function useTracking(initialAwb) {
  const [filters, setFilters] = useState(() => ({ ...EMPTY_TRACK_FILTERS, awbNumber: initialAwb || '' }));
  const [rows, setRows] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [polling, setPolling] = useState(false);
  const [pollMessage, setPollMessage] = useState('');
  const pickLists = useTrackPickLists(airlines);

  // The 15-second refresh reads the boxes as they are now, without a re-render.
  const filtersRef = useRef(filters);
  const pageSizeRef = useRef(pageSize);
  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  // silent = the 15-second refresh: it keeps the page the user is on
  const load = async (silent = false, criteria = filtersRef.current) => {
    if (!silent) setLoading(true);
    try {
      const result = await freightApi.awbTracking(criteria);
      if (result.success) {
        const found = result.data || [];
        setRows(found);
        if (result.airlines) setAirlines(result.airlines);
        if (silent) setPage((current) => Math.min(current, pageCountOf(found.length, pageSizeRef.current)));
        else setPage(1);
      } else if (Array.isArray(result)) {
        setRows(result);
        setPage(1);
      }
    } catch (error) {
      console.error(error);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), REFRESH_EVERY_MS);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => {
    setFilters(EMPTY_TRACK_FILTERS);
    filtersRef.current = EMPTY_TRACK_FILTERS;
    load(false, EMPTY_TRACK_FILTERS);
  };

  // asks the airline mailbox (SFTP) for new FSU files now, then reloads
  const fetchStatusNow = async () => {
    setPolling(true);
    setPollMessage('');
    try {
      const result = await freightApi.pollFsu();
      if (result.success === false || result.error) throw new Error(result.error || result.message || 'Could not fetch status');
      if (result.skipped) throw new Error('Airline connection (SFTP) is not set up - see Settings → SFTP');
      setPollMessage(`Status fetched: ${result.processed || 0} new update(s)`);
      await load(true);
    } catch (error) {
      setPollMessage(`Error: ${errorMessage(error)}`);
    } finally {
      setPolling(false);
    }
  };

  const changePageSize = (size) => {
    setPageSize(size);
    setPage(1);
  };

  return {
    filters, setFilter, search: () => load(false, filters), clear, reload: () => load(true), rows, airlines, pickLists, loading,
    page, setPage, pageSize, changePageSize, polling, pollMessage, fetchStatusNow,
  };
}
