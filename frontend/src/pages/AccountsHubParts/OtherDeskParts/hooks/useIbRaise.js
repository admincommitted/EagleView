import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { lookup, todayIso } from '../../ui';
import { sumOf } from '../../VoucherDeskParts/amounts';
import { BANK_LEDGERS, BRANCH_ACCOUNT, CASH_LEDGERS } from '../otherConfig';

const blankTransfer = (type, fromBranch) => ({ type, fromBranch, toBranch: '', date: todayIso(), amount: '', fromLedgerId: '', refNo: '', narration: '' });
const blankEntry = (dc = 'Dr') => ({ ledgerId: '', dc, amount: '', remarks: '' });

// The sending branch raises; its voucher posts at once against "BRANCH A/C - <to branch>". For a journal it also lists
// the entries the other branch should book.
export function useIbRaise({ myBranch, onDone }) {
  const [transfer, setTransfer] = useState(() => blankTransfer('bank', myBranch));
  const [look, setLook] = useState({ all: [], banks: [], cash: [] });
  const [lines, setLines] = useState([]);
  const [entry, setEntry] = useState(blankEntry);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (myBranch && !transfer.fromBranch) setTransfer((current) => ({ ...current, fromBranch: myBranch })); }, [myBranch]);
  useEffect(() => {
    const loadLookups = async () => {
      const [all, banks, cash] = await Promise.all([lookup('ledgers'), lookup(BANK_LEDGERS), lookup(CASH_LEDGERS)]);
      setLook({ all: all.filter((ledger) => !BRANCH_ACCOUNT.test(ledger.name)), banks, cash });
    };
    loadLookups();
  }, []);

  const journal = transfer.type === 'journal';
  const fromList = transfer.type === 'bank' ? look.banks : transfer.type === 'cash' ? look.cash : look.all;
  const net = sumOf(lines, (line) => (line.dc === 'Dr' ? 1 : -1) * Number(line.amount || 0));
  const amount = journal ? Math.abs(net) : Number(transfer.amount || 0);
  const nameOf = (id) => look.all.find((ledger) => String(ledger.id) === String(id))?.name || '';

  const setField = (key) => (value) => setTransfer((current) => ({ ...current, [key]: value }));
  const setEntryField = (key) => (value) => setEntry((current) => ({ ...current, [key]: value }));
  const pickType = (type) => {
    setTransfer((current) => ({ ...current, type, fromLedgerId: '' }));
    setLines([]);
    setMessage('');
  };

  const add = () => {
    setMessage('');
    if (!entry.ledgerId) return setMessage('Choose the account for the other branch');
    if (!(Number(entry.amount) > 0)) return setMessage('Enter the amount');
    if (String(entry.ledgerId) === String(transfer.fromLedgerId)) return setMessage('Your own account cannot be in the other branch\'s entries');
    setLines((list) => [...list, { ...entry, amount: Number(entry.amount) }]);
    setEntry(blankEntry(entry.dc));
  };
  const removeLine = (index) => setLines((list) => list.filter((_, position) => position !== index));

  const toLabel = transfer.toBranch ? 'BRANCH A/C - ' + transfer.toBranch : 'Branch A/c of the other branch';
  const reversed = journal && net < 0;
  const preview = amount > 0 && transfer.fromLedgerId ? [
    { ledgerName: toLabel, dc: reversed ? 'Cr' : 'Dr', amount },
    { ledgerName: nameOf(transfer.fromLedgerId), dc: reversed ? 'Dr' : 'Cr', amount },
  ] : [];

  const save = async () => {
    setMessage('');
    if (!transfer.fromBranch || !transfer.toBranch) return setMessage('Choose both branches');
    if (transfer.fromBranch === transfer.toBranch) return setMessage('From and to branch cannot be the same');
    if (!transfer.fromLedgerId) return setMessage(journal ? 'Choose the account of your branch' : 'Choose the ' + (transfer.type === 'cash' ? 'cash' : 'bank') + ' account it goes from');
    if (journal && !lines.length) return setMessage(entry.ledgerId ? 'Click Add to put the entry in the grid' : 'Add the entries the other branch should book');
    if (!(amount > 0)) return setMessage('Enter the amount');
    setSaving(true);
    try {
      const result = await accountsApi.otherDeskIbRaise({ ...transfer, amount, toLines: journal ? lines : [] });
      setMessage('Saved ' + result.ibNo + ' (voucher ' + result.voucherNumber + ') - waiting for ' + transfer.toBranch + ' to accept');
      setTimeout(onDone, 900);
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
    setSaving(false);
  };
  const clear = () => {
    setTransfer(blankTransfer(transfer.type, myBranch));
    setLines([]);
    setMessage('');
  };

  return {
    transfer, setField, pickType, look, fromList, journal, net, amount, nameOf, lines, entry, setEntryField, add, removeLine,
    preview, message, saving, save, clear,
  };
}
