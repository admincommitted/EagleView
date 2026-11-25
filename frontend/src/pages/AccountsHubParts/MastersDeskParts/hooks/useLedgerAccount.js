import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { lookup } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { LEDGER_READ_ONLY, blankLedger, groupPath, stateOfGstin } from '../mastersData';

const LIST_LIMIT = 1000;
const SEARCH_DELAY_MS = 250;
const RETRY_DELAY_MS = 1200;
const LIST_TRIES = 3;
const PAN_FROM = 2;
const PAN_TO = 12;

// the account list (left) and the account form (right) of Ledger Account; the open account is ?ledger= in the URL
export default function useLedgerAccount() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState({ total: 0, rows: [] });
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [flag, setFlag] = useState('');
  const [groups, setGroups] = useState([]);
  const [tdsSections, setTdsSections] = useState([]);
  const [allLedgers, setAllLedgers] = useState([]);
  const [form, setForm] = useState(() => blankLedger(params.get('group') || ''));
  const [info, setInfo] = useState(null);
  const [tab, setTab] = useState('account');
  const [msg, setMsg] = useState('');

  const loadList = async (tries = LIST_TRIES) => {
    try {
      setList(await accountsApi.mastersLedgers({ q: query, groupId: groupFilter, flag, limit: LIST_LIMIT }));
    } catch {
      if (tries > 1) setTimeout(() => loadList(tries - 1), RETRY_DELAY_MS);
    }
  };
  useEffect(() => { const timer = setTimeout(loadList, SEARCH_DELAY_MS); return () => clearTimeout(timer); }, [query, groupFilter, flag]);

  useEffect(() => {
    const loadMasters = async () => {
      try { setGroups(await accountsApi.mastersGroupsTree()); } catch { /* the group list stays empty */ }
      try { setTdsSections(await accountsApi.mastersTdsSchedule()); } catch { /* the TDS list stays empty */ }
      setAllLedgers(await lookup('ledgers'));
    };
    loadMasters();
  }, []);

  const open = async (id) => {
    try {
      const ledger = await accountsApi.mastersLedger(id);
      setInfo(ledger); setMsg('');
      setForm({ ...blankLedger(), ...Object.fromEntries(Object.entries(ledger).map(([key, value]) => [key, value == null ? '' : value])) });
    } catch (error) {
      setMsg(errorMessage(error));
    }
  };
  const ledgerParam = params.get('ledger');
  useEffect(() => { if (ledgerParam) open(ledgerParam); }, [ledgerParam]);

  const byId = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const pathOf = (group) => groupPath(group, byId);
  const group = byId.get(Number(form.groupId));
  const isParty = !!group && /sundry (debtors|creditors)/i.test(pathOf(group));
  const isBank = !!group && /bank|cash/i.test(pathOf(group));

  const setField = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const setFlagField = (key, on) => setField(key, on ? 1 : 0);
  // the GSTIN fills the PAN and the state when they are blank, and marks the account GST registered
  const setGstin = (value) => {
    const gstin = value.toUpperCase().replace(/\s/g, '');
    setForm((old) => {
      const next = { ...old, gstin };
      if (gstin.length >= PAN_TO && !old.pan) next.pan = gstin.slice(PAN_FROM, PAN_TO);
      if (gstin.length >= 2 && !old.state) next.state = stateOfGstin(gstin);
      if (gstin) { next.isGstApplicable = 1; next.isUnregistered = 0; }
      return next;
    });
  };
  const showLedger = (id) => { const next = new URLSearchParams(params); next.set('ledger', id); setParams(next); };

  const clear = () => {
    setForm(blankLedger(groupFilter || '')); setInfo(null); setMsg(''); setTab('account');
    const next = new URLSearchParams(params); next.delete('ledger'); next.delete('group'); setParams(next);
  };

  const save = async () => {
    setMsg('');
    if (!form.name.trim()) { setMsg('Enter the account name'); return; }
    if (!form.groupId) { setMsg('Choose the under group'); return; }
    if (Number(form.isBlacklisted) && !String(form.blacklistReason || '').trim()) { setTab('other'); setMsg('Enter why the party is blacklisted'); return; }
    const body = { ...form };
    LEDGER_READ_ONLY.forEach((key) => delete body[key]);
    try {
      if (form.id) {
        await accountsApi.mastersUpdateLedger(form.id, body);
        setMsg('Updated');
        open(form.id);
      } else {
        const created = await accountsApi.mastersCreateLedger(body);
        setMsg('Saved');
        if (created && created.id) showLedger(created.id);
      }
      lookup('ledgers', true);
      loadList();
    } catch (error) {
      setMsg('Not saved: ' + errorMessage(error));
    }
  };

  const remove = async () => {
    if (!form.id) return;
    if (!(await askConfirm({ title: 'Delete account', message: 'Delete account "' + form.name + '"?', okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await accountsApi.mastersDeleteLedger(form.id);
      lookup('ledgers', true); loadList(); clear(); setMsg('Deleted');
    } catch (error) {
      setMsg('Not deleted: ' + errorMessage(error));
    }
  };

  return {
    list, query, setQuery, groupFilter, setGroupFilter, flag, setFlag, groups, tdsSections, allLedgers, form, setForm, info, tab, setTab, msg,
    selectedId: form.id, group, isParty, isBank, pathOf, setField, setFlagField, setGstin, showLedger, open, clear, save, remove,
  };
}
