import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { CHILD_FORMS } from '../mastersData';

const isoOf = (text) => {
  const match = String(text || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : String(text || '').trim();
};
// opening bills pasted from Excel: Bill no, Bill date (dd/mm/yyyy), Amount, Dr/Cr, Due date, Job no
const pastedOpenings = (text) => text.split(/\r?\n/).map((line) => line.split('\t'))
  .filter((cells) => cells[0] && cells[0].trim() && !/bill|doc/i.test(cells[0]))
  .map((cells) => ({ docNo: cells[0], docDate: isoOf(cells[1]), amount: String(cells[2] || '').replace(/,/g, ''), dc: /cr/i.test(cells[3] || '') ? 'Cr' : 'Dr', dueDate: isoOf(cells[4]), jobNo: cells[5] || '' }));

// addresses / bank accounts / opening bills of one ledger: the entry form, the list, and the Excel paste
export default function useLedgerChildren({ kind, ledger, onChanged }) {
  const config = CHILD_FORMS[kind];
  const rows = ledger[kind] || [];
  const [entry, setEntry] = useState(config.blank);
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState('');
  useEffect(() => { setEntry(config.blank); setMsg(''); }, [kind, ledger.id]);

  const setField = (key, value) => setEntry((old) => ({ ...old, [key]: value }));
  const reset = () => { setEntry(config.blank); setMsg(''); };
  const edit = (row) => { setEntry({ ...row }); setMsg(''); };

  const save = async () => {
    setMsg('');
    try {
      if (entry.id) await accountsApi.mastersUpdateLedgerChild(ledger.id, kind, entry.id, entry);
      else await accountsApi.mastersAddLedgerChild(ledger.id, kind, entry);
      setMsg(entry.id ? 'Updated' : 'Saved');
      setEntry(config.blank);
      onChanged();
    } catch (error) {
      setMsg('Not saved: ' + errorMessage(error));
    }
  };
  const remove = async (row) => {
    if (!(await askConfirm({ title: 'Delete entry', message: 'Delete this entry?', okLabel: 'Delete', tone: 'danger' }))) return;
    try {
      await accountsApi.mastersDeleteLedgerChild(ledger.id, kind, row.id);
      setMsg('Deleted'); setEntry(config.blank); onChanged();
    } catch (error) {
      setMsg('Not deleted: ' + errorMessage(error));
    }
  };
  const importPaste = async () => {
    const bills = pastedOpenings(paste);
    if (!bills.length) { setMsg('Nothing to import - paste rows copied from Excel'); return; }
    try {
      const result = await accountsApi.mastersAddLedgerChild(ledger.id, 'openings', bills);
      setMsg('Saved ' + result.added + ' bills'); setPaste(''); onChanged();
    } catch (error) {
      setMsg('Not imported: ' + errorMessage(error));
    }
  };

  // the opening bills should add up to the account's opening balance
  const billsTotal = kind === 'openings' ? rows.reduce((total, row) => total + (row.dc === 'Cr' ? -1 : 1) * Number(row.amount || 0), 0) : 0;
  const ledgerOpening = (ledger.balanceType === 'Cr' ? -1 : 1) * Number(ledger.openingBalance || 0);
  const difference = Math.round((ledgerOpening - billsTotal) * 100) / 100;

  return { config, rows, entry, setField, msg, paste, setPaste, reset, edit, save, remove, importPaste, billsTotal, ledgerOpening, difference };
}
