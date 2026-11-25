import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../AccountsHubParts/accountsApi';
import { formatInr, todayIso } from '../format';
import { assertSuccess } from '../reportData';
import { isLedgerSheet, isPdf, readClientLedger } from './readClientLedger';

const DEFAULT_POLICY = { autoSendLedger: false, autoSendDays: '1,15', overdueReminders: false, reminderAfterDays: 10, autoHoldDelivery: false };

export const EMPTY_FOLLOW_UP = { channel: 'CALL', note: '', promiseDate: '', promiseAmount: '' };

function statementText(detail, asOn) {
  const lines = detail.bills.map((bill) =>
    `${bill.date || ''}  ${bill.refNo || ''}${bill.billNo ? ` (${bill.billNo})` : ''}  ${formatInr(bill.pending)}`
    + (bill.overdueDays > 0 ? `  ${bill.overdueDays} days overdue` : '  within terms')).join('\n');
  return `Dear ${detail.party.contactPerson || 'Sir / Madam'},\n\n`
    + `Statement of account as on ${asOn}:\n\n${lines}`
    + `\n\nTotal outstanding: ${formatInr(detail.total)}`
    + `\n\nBasis: ${detail.basis || ''}\n`;
}

export function useCreditControl() {
  const [asOn, setAsOn] = useState(todayIso);
  const [clients, setClients] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [reco, setReco] = useState(null);
  const [recoBusy, setRecoBusy] = useState(false);
  const [followUp, setFollowUp] = useState(EMPTY_FOLLOW_UP);
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const body = assertSuccess(await accountsApi.controlCreditAgeing(asOn));
      setClients(body.clients || []);
      setKpis(body.kpis || null);
      setMeta(body);
    } catch (loadError) {
      setClients([]);
      setKpis(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [asOn]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (ledgerId) => {
    if (!ledgerId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const body = assertSuccess(await accountsApi.controlCreditParty(ledgerId, asOn));
      setDetail(body);
      setPolicy(body.policy || DEFAULT_POLICY);
      setReco(null);
    } catch (loadError) {
      setDetail(null);
      toast.error(`Could not load the customer: ${errorMessage(loadError)}`);
    } finally {
      setDetailLoading(false);
    }
  }, [asOn]);

  useEffect(() => { loadDetail(selectedId); }, [selectedId, loadDetail]);

  const logFollowUp = async () => {
    if (!selectedId) return toast.error('Pick a customer first');
    if (!followUp.note.trim()) return toast.error('Write what was said - a follow-up with no note is no record');
    setSavingFollowUp(true);
    try {
      assertSuccess(await accountsApi.controlAddFollowUp({
        ledgerId: selectedId,
        note: followUp.note.trim(),
        channel: followUp.channel,
        promiseDate: followUp.promiseDate || null,
        promiseAmount: followUp.promiseAmount || null,
      }));
      toast.success('Follow-up logged');
      setFollowUp((current) => ({ ...EMPTY_FOLLOW_UP, channel: current.channel }));
      await loadDetail(selectedId);
      await load();
    } catch (saveError) {
      toast.error(`Not saved: ${errorMessage(saveError)}`);
    } finally {
      setSavingFollowUp(false);
    }
  };

  const markPromise = async (followUpId, promiseMet) => {
    try {
      await accountsApi.controlSetPromiseMet(followUpId, promiseMet);
      await loadDetail(selectedId);
      await load();
    } catch (saveError) {
      toast.error(errorMessage(saveError));
    }
  };

  const savePolicy = async (changes) => {
    if (!selectedId) return;
    const next = { ...policy, ...changes };
    setPolicy(next);
    try {
      const body = assertSuccess(await accountsApi.controlSaveCreditPolicy(selectedId, next));
      setPolicy(body.data);
      toast.success('Saved');
    } catch (saveError) {
      toast.error(`Not saved: ${errorMessage(saveError)}`);
      await loadDetail(selectedId);
    }
  };

  const sendStatement = async () => {
    if (!detail?.party) return;
    const to = detail.party.email;
    if (!to) return toast.error('No email address on this ledger - add one in Chart of Accounts first');
    if (!detail.bills?.length) return toast.error('Nothing outstanding - no statement to send');
    const subject = `Statement of account as on ${asOn}`;
    try {
      assertSuccess(await accountsApi.ledgerReportSendEmail({ to, subject, text: statementText(detail, asOn) }));
      toast.success(`Statement emailed to ${to}`);
      // the mail itself is part of the collection history; the statement is already sent if this fails
      try {
        await accountsApi.controlAddFollowUp({ ledgerId: selectedId, channel: 'EMAIL', note: `${subject} emailed to ${to}` });
      } catch {
        // nothing to tell the user
      }
      await loadDetail(selectedId);
    } catch (sendError) {
      toast.error(`Not sent: ${errorMessage(sendError)} (check Settings > Email)`);
    }
  };

  const matchLedgerFile = async (file) => {
    if (!file) return;
    if (!selectedId) return toast.error('Pick a customer first');
    if (isPdf(file)) return toast.error('A PDF statement cannot be matched reliably. Ask the customer for the ledger as Excel or CSV.');
    if (!isLedgerSheet(file)) return toast.error('Use an Excel (.xlsx / .xls) or CSV file');
    setRecoBusy(true);
    try {
      const rows = await readClientLedger(file);
      const result = assertSuccess(await accountsApi.controlMatchPartyLedger({ ledgerId: selectedId, rows, asOn }));
      setReco({ ...result, fileName: file.name, at: new Date().toLocaleString('en-GB') });
      toast.success(`${result.counts.matched} matched, ${result.counts.variances} variance(s)`);
    } catch (matchError) {
      toast.error(`Could not read that file: ${errorMessage(matchError)}`);
    } finally {
      setRecoBusy(false);
    }
  };

  return {
    asOn, setAsOn, clients, kpis, meta, loading, error, load,
    selectedId, setSelectedId, selectedClient: clients.find((client) => client.ledgerId === selectedId) || null,
    detail, detailLoading, policy, setPolicy, savePolicy,
    followUp, setFollowUp, savingFollowUp, logFollowUp, markPromise, sendStatement,
    reco, recoBusy, matchLedgerFile,
  };
}
