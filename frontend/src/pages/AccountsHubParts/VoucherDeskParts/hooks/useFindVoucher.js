import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { fmtDate, fyEnd, fyStart, inr } from '../../ui';
import { printVoucher } from '../../printVoucher';
import { deskSearchParams } from '../voucherConfig';

export const FIND_LIMIT = 200;

// Modify / Delete / Print on the entry screen: find the voucher, then act on the one picked
export function useFindVoucher({ cfg, action, onModify }) {
  const [filters, setFilters] = useState({ vno: '', from: fyStart(), to: fyEnd(), q: '' });
  const [rows, setRows] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(0);

  const run = async () => {
    setRows(null);
    try {
      const params = { ...deskSearchParams(cfg), from: filters.from, to: filters.to, ...(filters.vno && { vno: filters.vno }), ...(filters.q && { q: filters.q }) };
      const found = await accountsApi.voucherDeskSearch(params);
      setRows(found.slice(0, FIND_LIMIT));
    } catch (error) {
      setRows([]);
      setMessage(errorMessage(error));
    }
  };
  useEffect(() => { run(); }, []);

  const confirmModify = (voucher) => !/approv/i.test(voucher.status || '') || askConfirm({
    title: 'Modify an approved voucher', message: voucher.voucherNumber + ' is approved. Modifying it sends it back for approval. Continue?', okLabel: 'Modify', tone: 'warn',
  });
  const confirmDelete = (voucher) => askConfirm({
    title: 'Delete voucher', okLabel: 'Delete', tone: 'danger',
    message: 'Delete ' + (voucher.typeName || '') + ' ' + voucher.voucherNumber + ' dated ' + fmtDate(voucher.date) + ' for ' + inr(voucher.totalAmount) + '? It is removed from the books; the audit trail keeps a copy.',
  });

  const pick = async (row) => {
    setMessage('');
    setBusyId(row.id);
    try {
      const voucher = await accountsApi.voucherDeskVoucher(row.id);
      if (action === 'modify') {
        if (!(await confirmModify(voucher))) { setBusyId(0); return; }
        onModify(voucher);
        return;
      }
      if (action === 'print' && !printVoucher(voucher)) setMessage('Allow pop-ups for this site to print');
      if (action === 'delete') {
        if (!(await confirmDelete(voucher))) { setBusyId(0); return; }
        await accountsApi.voucherDeskDelete(voucher.id);
        setMessage('Deleted ' + voucher.voucherNumber);
        run();
      }
    } catch (error) {
      setMessage((action === 'delete' ? 'Not deleted: ' : 'Could not open: ') + errorMessage(error));
    }
    setBusyId(0);
  };

  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));
  return { filters, setFilter, rows, message, busyId, run, pick };
}
