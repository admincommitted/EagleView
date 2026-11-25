import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { lookup, todayIso } from '../../ui';

const blankBook = () => ({ bankLedgerId: '', bookNo: '', fromNo: '', toNo: '', issuedOn: todayIso(), status: 'IN USE', isActive: 1 });
const digitsOf = (chequeNo) => Number(String(chequeNo).replace(/\D/g, ''));

// cheque books per bank and every leaf (issued from payment vouchers, cancelled, unused)
export function useChequeBooks() {
  const [books, setBooks] = useState([]);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(blankBook);
  const [leaves, setLeaves] = useState([]);
  const [filter, setFilter] = useState('');
  const [cancelAt, setCancelAt] = useState(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      setBooks(await accountsApi.otherDeskChequeBooks());
    } catch (error) {
      setMessage('Not loaded: ' + errorMessage(error));
    }
  };
  useEffect(() => {
    load();
    const loadBanks = async () => setBanks(await lookup('ledgers-in?groups=' + encodeURIComponent('Bank Accounts,Bank OD A/c')));
    loadBanks();
  }, []);

  const openBook = async (book) => {
    setForm({ ...book });
    setMessage('');
    setCancelAt(null);
    try {
      setLeaves(await accountsApi.otherDeskChequeLeaves(book.id));
    } catch {
      setLeaves([]);
    }
  };
  const clear = () => {
    setForm(blankBook());
    setLeaves([]);
    setMessage('');
  };
  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setMessage('');
    if (!form.bankLedgerId) return setMessage('Choose the bank');
    if (!form.fromNo || !form.toNo) return setMessage('Enter the first and last cheque no');
    if (digitsOf(form.toNo) < digitsOf(form.fromNo)) return setMessage('Last cheque no is before the first');
    const book = { bankLedgerId: form.bankLedgerId, bookNo: form.bookNo, fromNo: form.fromNo, toNo: form.toNo, issuedOn: form.issuedOn, status: form.status, isActive: 1 };
    try {
      if (form.id) await accountsApi.otherDeskUpdateChequeBook(form.id, book);
      else await accountsApi.otherDeskCreateChequeBook(book);
      setMessage(form.id ? 'Updated' : 'Saved');
      await load();
      if (!form.id) clear(); else openBook({ ...form });
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
  };
  const remove = async () => {
    if (!form.id) return;
    const goAhead = await askConfirm({ title: 'Delete cheque book', message: 'Delete this cheque book? Issued cheques stay on their vouchers.', okLabel: 'Delete', tone: 'danger' });
    if (!goAhead) return;
    try {
      await accountsApi.otherDeskDeleteChequeBook(form.id);
      setMessage('Deleted');
      load();
      clear();
    } catch (error) {
      setMessage('Not deleted: ' + errorMessage(error));
    }
  };
  const markLeaf = async (chequeNo, action) => {
    try {
      await accountsApi.otherDeskMarkChequeLeaf(form.id, chequeNo, { action, reason });
      setCancelAt(null);
      setReason('');
      openBook(form);
      load();
    } catch (error) {
      setMessage('Not changed: ' + errorMessage(error));
    }
  };
  const startCancel = (chequeNo) => {
    setCancelAt(chequeNo);
    setReason('');
  };

  const totals = books.reduce((sum, book) => ({
    total: sum.total + book.total, issued: sum.issued + book.issued, cancelled: sum.cancelled + book.cancelled, unused: sum.unused + book.unused,
  }), { total: 0, issued: 0, cancelled: 0, unused: 0 });
  const shownLeaves = leaves.filter((leaf) => !filter || leaf.status === filter);

  return {
    books, banks, form, setField, leaves, shownLeaves, filter, setFilter, cancelAt, setCancelAt, startCancel, reason, setReason, message, totals,
    openBook, clear, save, remove, markLeaf,
  };
}
