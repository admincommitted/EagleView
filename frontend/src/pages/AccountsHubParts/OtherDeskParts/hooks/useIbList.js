import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { fyStart, lookup, todayIso } from '../../ui';
import { BANK_LEDGERS, CASH_LEDGERS } from '../otherConfig';

// The receiving branch accepts (picks the bank / cash it came into, or checks the journal entries) and its voucher posts
// against "BRANCH A/C - <from>", or returns it with a reason - then the sending voucher is reversed.
export function useIbList(myBranch) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: fyStart(), to: todayIso(), type: '', status: '', mine: myBranch ? 'in' : '' });
  const [mineTouched, setMineTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [action, setAction] = useState(null); // { id, kind: 'accept' | 'return', toLedgerId, date, reason, lines }
  const [look, setLook] = useState({ banks: [], cash: [], all: [] });

  // the branch comes from the top bar a moment after the page opens - then show what is coming to it
  useEffect(() => { if (myBranch && !mineTouched) setFilters((current) => ({ ...current, mine: 'in' })); }, [myBranch]);
  useEffect(() => {
    const loadLookups = async () => {
      const [all, banks, cash] = await Promise.all([lookup('ledgers'), lookup(BANK_LEDGERS), lookup(CASH_LEDGERS)]);
      setLook({ all, banks, cash });
    };
    loadLookups();
  }, []);

  const load = async () => {
    try {
      setRows(await accountsApi.otherDeskIbList({ from: filters.from, to: filters.to, ...(filters.type && { type: filters.type }), ...(filters.status && { status: filters.status }) }));
    } catch (error) {
      setMessage('Not loaded: ' + errorMessage(error));
    }
  };
  useEffect(() => { load(); }, [filters.from, filters.to, filters.type, filters.status]);

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  const setMine = (mine) => {
    setMineTouched(true);
    setFilters((current) => ({ ...current, mine }));
  };
  const shown = rows.filter((row) => !myBranch || !filters.mine || (filters.mine === 'in' ? row.toBranch === myBranch : row.fromBranch === myBranch));
  const waitingIn = rows.filter((row) => row.status === 'Waiting' && (!myBranch || row.toBranch === myBranch));
  const selected = action && rows.find((row) => row.id === action.id);

  const startAccept = (row) => setAction({
    id: row.id, kind: 'accept', date: todayIso() < row.date ? row.date : todayIso(), toLedgerId: '',
    lines: row.toLines.map((line) => ({ ledgerId: line.ledgerId, dc: line.dc, amount: line.amount, remarks: line.remarks })),
  });
  const startReturn = (row) => setAction({ id: row.id, kind: 'return', reason: '' });
  const setActionField = (key) => (value) => setAction((current) => ({ ...current, [key]: value }));
  const setActionLine = (index, key, value) => setAction((current) => ({ ...current, lines: current.lines.map((line, position) => (position === index ? { ...line, [key]: value } : line)) }));

  const accept = async (row) => {
    setMessage('');
    try {
      const body = row.type === 'journal' ? { date: action.date, toLines: action.lines } : { date: action.date, toLedgerId: action.toLedgerId };
      const result = await accountsApi.otherDeskIbAccept(row.id, body);
      setMessage('Accepted ' + row.ibNo + ' - voucher ' + result.voucherNumber);
      setAction(null);
      load();
    } catch (error) {
      setMessage('Not accepted: ' + errorMessage(error));
    }
  };
  const giveBack = async (row) => {
    setMessage('');
    if (!String(action.reason || '').trim()) return setMessage('Enter why it is returned');
    try {
      await accountsApi.otherDeskIbReturn(row.id, { reason: action.reason.trim() });
      setMessage('Returned ' + row.ibNo + ' - the sending voucher is reversed');
      setAction(null);
      load();
    } catch (error) {
      setMessage('Not returned: ' + errorMessage(error));
    }
  };

  return {
    rows, shown, waitingIn, filters, setFilter, setMine, message, action, setAction, setActionField, setActionLine, selected, look,
    load, startAccept, startReturn, accept, giveBack,
  };
}
