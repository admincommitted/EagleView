import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { readExcel } from '../../extras';
import { accountsApi } from '../../accountsApi';
import { num } from '../controlUtils';

const BLANK_POLICY = { autoSendLedger: false, autoSendDays: '', overdueReminders: false, reminderAfterDays: 7, autoHoldDelivery: false, notes: '' };
const blankFollowUp = (channel = 'CALL') => ({ channel, note: '', promiseDate: '', promiseAmount: '', refNo: '' });

// the customer's own ledger (Excel) is paired with our open bills - by reference first, then by amount
export const PARTY_LEDGER_COLUMNS = [
  { key: 'ref', label: 'Invoice / Ref No', aliases: ['ref', 'reference', 'invoice', 'bill no', 'doc no', 'particulars'] },
  { key: 'date', label: 'Date', date: true }, { key: 'amount', label: 'Amount' }, { key: 'debit', label: 'Debit' }, { key: 'credit', label: 'Credit' },
];

// one customer of Credit Control: bills, follow-ups with promise to pay, credit limit / days, reminder policy, ledger match
export default function useCreditParty({ ledgerId, asOn, onChanged }) {
  const [party, setParty] = useState(null);
  const [msg, setMsg] = useState('');
  const [followUp, setFollowUp] = useState(blankFollowUp());
  const [limit, setLimit] = useState({ creditLimit: '', creditDays: '' });
  const [policy, setPolicy] = useState({});
  const [match, setMatch] = useState(null);

  const load = async () => {
    try {
      const loaded = await accountsApi.controlCreditParty(ledgerId, asOn);
      setParty(loaded);
      setLimit({ creditLimit: String(loaded.party.creditLimit || ''), creditDays: String(loaded.party.creditDays || '') });
      setPolicy(loaded.policy || BLANK_POLICY);
    } catch (error) {
      setMsg(errorMessage(error));
    }
  };
  useEffect(() => { load(); }, [ledgerId, asOn]);

  const changed = () => { load(); onChanged(); };

  const addFollowUp = async () => {
    setMsg('');
    try {
      await accountsApi.controlAddFollowUp({ ledgerId, ...followUp });
      setFollowUp(blankFollowUp(followUp.channel));
      setMsg('Follow-up saved');
      changed();
    } catch (error) { setMsg('Not saved: ' + errorMessage(error)); }
  };
  const markPromise = async (entry, kept) => {
    try { await accountsApi.controlSetPromiseMet(entry.id, kept); changed(); } catch (error) { setMsg(errorMessage(error)); }
  };
  const saveLimit = async () => {
    setMsg('');
    if (num(limit.creditLimit) < 0 || num(limit.creditDays) < 0) { setMsg('Limit and days cannot be negative'); return; }
    try {
      await accountsApi.mastersUpdateLedger(ledgerId, { creditLimit: num(limit.creditLimit), creditDays: Math.round(num(limit.creditDays)) });
      setMsg('Credit limit saved');
      changed();
    } catch (error) { setMsg('Not saved: ' + errorMessage(error)); }
  };
  const savePolicy = async () => {
    setMsg('');
    try { await accountsApi.controlSaveCreditPolicy(ledgerId, policy); setMsg('Policy saved'); load(); } catch (error) { setMsg('Not saved: ' + errorMessage(error)); }
  };
  const readTheirLedger = async (file) => {
    setMsg(''); setMatch(null);
    try {
      const rows = (await readExcel(file, PARTY_LEDGER_COLUMNS)).map((row) => ({ ref: row.ref, date: row.date, ...(row.amount !== '' ? { amount: row.amount } : {}), debit: row.debit, credit: row.credit }));
      setMatch(await accountsApi.controlMatchPartyLedger({ ledgerId, asOn, rows }));
    } catch (error) { setMsg('Could not match: ' + errorMessage(error)); }
  };

  return { party, msg, followUp, setFollowUp, limit, setLimit, policy, setPolicy, match, addFollowUp, markPromise, saveLimit, savePolicy, readTheirLedger };
}
