import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { getParties } from '@/utils/partiesCache';
import { askYes } from '../switchRow';
import { masterRecordsApi, mastersFormApi } from '../masterKit/masterRecordsApi';
import { awbRunProblem, hawbEndOf, lastAwbOf, startSerialOf } from './awbNumbering';

const NO_PARTY = 'Select';
const EMPTY_AWB_RUN = { first4: '', last4: '', count: '' };
const isoDay = (date) => date.toISOString().split('T')[0];
const daysAgo = (days) => { const date = new Date(); date.setDate(date.getDate() - days); return isoDay(date); };
const digitsOnly = (text) => text.replace(/\D/g, '');

// a server refusal ("ERROR: ...") or no answer at all ("Network Error: ...")
const failureText = (error) => (error.response ? `ERROR: ${errorMessage(error)}` : `Network Error: ${error.message}`);

const currentUserName = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}') || {};
    return user.username || user.name || '';
  } catch {
    return '';
  }
};

const generatedText = (kind, data, from, to) => `SUCCESS: Generated ${data.generated} ${kind} (From ${from} to ${to})` + (data.skipped ? ` - ${data.skipped} already existed` : '');

const agentOption = (agent) => ({ id: agent.id, title: `${agent.iataCode || ''} - ${agent.name}`, subtitle: agent.address || '', raw: agent });

export function useAwbStock() {
  const [activeTab, setActiveTab] = useState('AWB');
  const [airlines, setAirlines] = useState([]);
  const [parties, setParties] = useState([]);
  const [iataAgents, setIataAgents] = useState([]);

  const [partyType, setPartyType] = useState(NO_PARTY);
  const [awbPrefix3, setAwbPrefix3] = useState('');
  const [awbRun, setAwbRun] = useState(EMPTY_AWB_RUN);
  const [awbLastSeqNo, setAwbLastSeqNo] = useState('');

  const [hawbPrefix, setHawbPrefix] = useState('');
  const [hawbStartNo, setHawbStartNo] = useState('');
  const [hawbCount, setHawbCount] = useState('');
  const [hawbEndNo, setHawbEndNo] = useState('');
  const [hawbPartyType, setHawbPartyType] = useState(NO_PARTY);
  const [hawbPartyId, setHawbPartyId] = useState('');

  const [stockRows, setStockRows] = useState([]);
  const [fromDate, setFromDate] = useState(() => daysAgo(7));
  const [toDate, setToDate] = useState(() => isoDay(new Date()));
  const [stockDate, setStockDate] = useState(() => isoDay(new Date()));
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]);

  const [returnAwb, setReturnAwb] = useState('');
  const [returnAction, setReturnAction] = useState('VOID');
  const [returnInfo, setReturnInfo] = useState(null);

  const isHawb = activeTab === 'HAWB';

  const loadStock = async (tab = activeTab) => {
    const params = { ...(fromDate && { fromDate }), ...(toDate && { toDate }), ...(filterStatus !== 'ALL' && { status: filterStatus }) };
    try {
      const data = tab === 'HAWB' ? await mastersFormApi.listHawbStock(params) : await mastersFormApi.listAwbStock(params);
      if (Array.isArray(data)) {
        setStockRows(data);
        setSelectedIds([]);
      }
    } catch (error) {
      console.error(error);
      toast.error(`Failed to load AWB stock list: ${errorMessage(error)}`);
    }
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    setSelectedIds([]);
    loadStock(tab);
  };

  useEffect(() => {
    loadStock();
    const loadList = async (load, setList, what) => {
      try {
        const data = await load();
        if (Array.isArray(data)) setList(data);
      } catch (error) {
        console.error(error);
        if (what) toast.error(`Failed to load ${what}: ${errorMessage(error)}`);
      }
    };
    loadList(() => masterRecordsApi.list('airlines'), setAirlines, 'airlines');
    loadList(getParties, setParties);
    loadList(() => masterRecordsApi.list('iataagents'), setIataAgents, 'IATA agents');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the first query of the open tab, once

  const airlineOptions = useMemo(() => airlines.filter((airline) => airline.prefix && airline.prefix.trim() !== '').map((airline) => ({
    id: airline.prefix,
    title: `${airline.prefix} - ${airline.name} (${airline.code2})`,
    subtitle: airline.code3 ? `Accounting: ${airline.code3}` : '',
    raw: airline,
  })), [airlines]);
  const agentOptions = useMemo(() => iataAgents.map(agentOption), [iataAgents]);
  const consolidatorOptions = useMemo(() => parties.filter((party) => party.partyType === 'CONSOLIDATOR').map((party) => ({
    id: party.id, title: `${party.code || ''} - ${party.name}`, subtitle: party.city || '', raw: party,
  })), [parties]);

  // the last number of the run follows each digit typed (it keeps its value until all 8 digits and a count are there)
  const changeAwbRun = (part, text) => {
    const run = { ...awbRun, [part]: digitsOnly(text) };
    setAwbRun(run);
    const lastAwb = lastAwbOf(run.first4, run.last4, run.count);
    if (lastAwb) setAwbLastSeqNo(lastAwb);
  };

  const pickAirline = (option) => {
    if (option?.raw?.prefix) setAwbPrefix3(option.raw.prefix);
  };

  const resetAwbRun = () => { setAwbPrefix3(''); setAwbRun(EMPTY_AWB_RUN); setAwbLastSeqNo(''); };
  const clearAwb = () => { resetAwbRun(); setPartyType(NO_PARTY); setSelectedIds([]); };
  const clearHawb = () => { setHawbPrefix(''); setHawbStartNo(''); setHawbCount(''); setHawbEndNo(''); setHawbPartyType(NO_PARTY); setHawbPartyId(''); setSelectedIds([]); };
  const clearReturn = () => { setReturnAwb(''); setReturnInfo(null); setReturnAction('VOID'); };

  const saveAwb = async () => {
    const { first4, last4, count } = awbRun;
    const problem = awbRunProblem({ prefix3: awbPrefix3, first4, last4, count });
    if (problem) return toast.error(problem);
    try {
      const data = await mastersFormApi.generateAwbStock({ airlinePrefix: awbPrefix3, startSerialNumber: startSerialOf(first4, last4), count: parseInt(count, 10), stockDate });
      if (!data.success) return toast.error(`ERROR: ${data.error || 'Failed to generate stock.'}`);
      toast.success(generatedText('AWBs', data, data.startAwb, data.endAwb));
      resetAwbRun();
      loadStock();
    } catch (error) {
      toast.error(failureText(error));
    }
  };

  const saveHawb = async () => {
    if (!hawbStartNo || !hawbCount) return toast.error('Please enter Starting No and Count.');
    if (!/^\d+$/.test(hawbStartNo.trim()) || !/^\d+$/.test(String(hawbCount).trim()) || parseInt(hawbCount, 10) < 1) return toast.error('Error: Starting No and Count must be numbers.');
    try {
      const data = await mastersFormApi.generateHawbStock({
        prefix: hawbPrefix.trim(),
        startSerialNumber: hawbStartNo.trim(),
        count: parseInt(hawbCount, 10),
        partyType: hawbPartyType !== NO_PARTY ? hawbPartyType : null,
        partyId: hawbPartyId || null,
        stockDate,
      });
      if (!data.success) return toast.error(`ERROR: ${data.error}`);
      toast.success(generatedText('HAWBs', data, data.startHawb, data.endHawb));
      setHawbEndNo(data.endHawb.replace(hawbPrefix, ''));
      loadStock();
    } catch (error) {
      toast.error(failureText(error));
    }
  };

  // Unallocate / Void / Delete work on the ticked rows of the open tab; the server only changes rows whose status allows it
  const changeStock = async (action, label) => {
    if (selectedIds.length === 0) return toast.error(`Please select at least one stock row to ${label}.`);
    if (action !== 'unallocate' && !(await askYes(`${label} ${selectedIds.length} selected stock row(s)?`))) return;
    try {
      const data = await mastersFormApi.changeStock(action, { ids: selectedIds, type: isHawb ? 'HAWB' : 'AWB' });
      if (!data.success) return toast.error(`ERROR: ${data.error}`);
      toast.success(`Success: ${data.message}`);
      setSelectedIds([]);
      loadStock();
    } catch (error) {
      toast.error(failureText(error));
    }
  };

  const toggleId = (id) => setSelectedIds((current) => (current.includes(id) ? current.filter((picked) => picked !== id) : [...current, id]));
  const toggleAllIds = (checked) => setSelectedIds(checked ? stockRows.map((row) => row.id) : []);

  const changeReturnAwb = (text) => { setReturnAwb(text); setReturnInfo(null); };

  const verifyReturn = async () => {
    setReturnInfo(null);
    if (!returnAwb.trim()) return toast.error('Please enter the AWB number.');
    try {
      const data = await mastersFormApi.verifyAwbStock(digitsOnly(returnAwb));
      if (!data.success) return toast.error(`ERROR: ${data.error}`);
      setReturnInfo(data.data);
    } catch (error) {
      toast.error(failureText(error));
    }
  };

  const returnStock = async () => {
    if (!returnAwb.trim()) return toast.error('Please enter the AWB number.');
    if (returnAction === 'VOID' && !(await askYes('VOID cancels this AWB for ever. Continue?'))) return;
    try {
      const data = await mastersFormApi.returnAwbStock({ awbNumber: returnAwb, action: returnAction });
      if (!data.success) return toast.error(`ERROR: ${data.error}`);
      toast.success(`Success: ${data.message}`);
      setReturnInfo(data.data);
      loadStock();
    } catch (error) {
      toast.error(failureText(error));
    }
  };

  return {
    activeTab, changeTab, isHawb,
    airlineOptions, agentOptions, consolidatorOptions,
    awb: { partyType, setPartyType, prefix3: awbPrefix3, setPrefix3: setAwbPrefix3, ...awbRun, lastSeqNo: awbLastSeqNo, changeRun: changeAwbRun, pickAirline, save: saveAwb, clear: clearAwb },
    hawb: {
      partyType: hawbPartyType, setPartyType: setHawbPartyType, setPartyId: setHawbPartyId,
      prefix: hawbPrefix, setPrefix: setHawbPrefix, startNo: hawbStartNo, setStartNo: setHawbStartNo, count: hawbCount, setCount: setHawbCount,
      endNo: hawbEndOf(hawbStartNo, hawbCount, hawbEndNo), save: saveHawb, clear: clearHawb,
    },
    returning: { awb: returnAwb, changeAwb: changeReturnAwb, action: returnAction, setAction: setReturnAction, info: returnInfo, verify: verifyReturn, save: returnStock, clear: clearReturn },
    query: { rows: stockRows, fromDate, setFromDate, toDate, setToDate, filterStatus, setFilterStatus, selectedIds, toggleId, toggleAllIds, load: () => loadStock() },
    stockDate, setStockDate,
    changeStock,
    enteredBy: currentUserName(),
    enteredDate: new Date().toLocaleDateString('en-GB'),
  };
}
