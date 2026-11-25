import { useEffect, useMemo, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { fmtDate, inr, todayIso } from '../../ui';
import { accountsApi } from '../../accountsApi';
import { AGE, ageKey, ageLabel, escapeHtml, printHtml, round2, toExcel } from '../controlUtils';

const matchesText = (bill, query) => !query || (bill.party + ' ' + bill.refNo + ' ' + (bill.narration || '')).toLowerCase().includes(query.toLowerCase());

function groupByParty(bills) {
  const parties = new Map();
  bills.forEach((bill) => {
    if (!parties.has(bill.ledgerId)) parties.set(bill.ledgerId, { ledgerId: bill.ledgerId, party: bill.party, bills: [], total: 0, ...Object.fromEntries(AGE.map(([key]) => [key, 0])), oldest: 0 });
    const party = parties.get(bill.ledgerId);
    party.bills.push(bill);
    party.total = round2(party.total + bill.pending);
    party[bill.age] = round2(party[bill.age] + bill.pending);
    party.oldest = Math.max(party.oldest, bill.overdueDays);
  });
  return [...parties.values()].sort((first, second) => second.total - first.total);
}

// receivable / payable open bills on a date: filters, the party view and the printed statement
export default function useOutstanding() {
  const [filter, setFilter] = useState({ type: 'receivable', asOn: todayIso(), view: 'party', q: '', age: '', overdue: false });
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState({});
  const setFilterField = (key, value) => setFilter((old) => ({ ...old, [key]: value }));

  const load = async () => {
    setData(null); setMsg('');
    try { setData(await accountsApi.controlOutstanding(filter.type, filter.asOn)); } catch (error) { setMsg('Not loaded: ' + errorMessage(error)); }
  };
  useEffect(() => { load(); }, [filter.type, filter.asOn]);

  const bills = useMemo(() => (data ? data.data || [] : []).map((bill) => ({ ...bill, age: ageKey(bill.overdueDays) })), [data]);
  const shown = bills.filter((bill) => matchesText(bill, filter.q) && (!filter.age || bill.age === filter.age) && (!filter.overdue || bill.overdueDays > 0));
  const parties = useMemo(() => groupByParty(shown), [shown]);
  const totalOf = (age) => round2(bills.filter((bill) => !age || bill.age === age).reduce((total, bill) => total + bill.pending, 0));
  const receivable = filter.type === 'receivable';
  const toggleParty = (ledgerId) => setOpen((old) => ({ ...old, [ledgerId]: !old[ledgerId] }));

  const printStatement = (party) => {
    const rows = party.bills.map((bill) => `<tr><td>${escapeHtml(bill.refNo)}</td><td>${fmtDate(bill.date)}</td><td>${fmtDate(bill.dueDate)}</td><td class="n">${inr(bill.amount)}</td><td class="n">${inr(bill.pending)}</td><td class="n">${bill.overdueDays > 0 ? bill.overdueDays : ''}</td></tr>`).join('');
    const printed = printHtml('Statement ' + party.party, `<h1>COMMITTED CARGO CARE LIMITED</h1><h2>Statement of outstanding - ${escapeHtml(party.party)} - as on ${fmtDate(filter.asOn)}</h2>
      <table><thead><tr><th>Bill</th><th>Date</th><th>Due</th><th class="n">Bill amount</th><th class="n">${receivable ? 'Due from you' : 'Due to you'}</th><th class="n">Days overdue</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td colspan="4">Total</td><td class="n">${inr(party.total)}</td><td></td></tr></tfoot></table><p class="sub">Please let us know if any bill above differs from your books.</p>`);
    if (!printed) setMsg('Allow pop-ups to print');
  };

  const exportExcel = () => toExcel('outstanding_' + filter.type + '_' + filter.asOn, [['party', 'Party'], ['refNo', 'Bill'], [(bill) => fmtDate(bill.date), 'Date'], [(bill) => fmtDate(bill.dueDate), 'Due'],
    ['amount', 'Bill amount'], ['pending', 'Pending'], ['overdueDays', 'Days overdue'], [(bill) => ageLabel(bill.age), 'Ageing']], shown);

  return { filter, setFilter, setFilterField, data, msg, setMsg, open, toggleParty, bills, shown, parties, totalOf, receivable, load, printStatement, exportExcel };
}
