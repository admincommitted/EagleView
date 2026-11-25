import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { accountsApi } from '../../accountsApi';
import { sumOf } from '../../VoucherDeskParts/amounts';

// vouchers waiting (with the rule that applies), approve / return, and the decided list
export function useApprovals(startTab) {
  const [tab, setTab] = useState(startTab);
  const [data, setData] = useState({ rules: [], rows: [] });
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState({});
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [returning, setReturning] = useState(null);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (tab === 'rules') return;
    setBusy(true);
    try {
      setData(await accountsApi.otherDeskApprovals(tab === 'pending' ? 'pending' : 'done'));
    } catch (error) {
      setMessage('Not loaded: ' + errorMessage(error));
    }
    setBusy(false);
  };
  useEffect(() => {
    setPicked({});
    load();
  }, [tab]);

  const types = [...new Set(data.rows.map((row) => row.typeName))];
  const searchText = (row) => (row.voucherNumber + ' ' + (row.accounts || '') + ' ' + (row.narration || '') + ' ' + (row.jobNo || '')).toLowerCase();
  const shown = data.rows.filter((row) => (!type || row.typeName === type) && (!query || searchText(row).includes(query.toLowerCase())));
  const selected = shown.filter((row) => picked[row.id]);

  const decide = async (vouchers, status) => {
    if (!vouchers.length) return;
    if (status === 'Returned' && !reason.trim()) return setMessage('Enter why it is returned');
    try {
      for (const voucher of vouchers) {
        await accountsApi.voucherDeskSetStatus(voucher.id, { status, rejectionReason: status === 'Returned' ? reason.trim() : undefined });
      }
      setMessage((status === 'Approved' ? 'Approved ' : 'Returned ') + vouchers.length + ' voucher(s)');
      setPicked({});
      setReturning(null);
      setReason('');
      load();
    } catch (error) {
      setMessage('Not changed: ' + errorMessage(error));
    }
  };
  const startReturn = (id) => {
    setReturning(id);
    setReason('');
  };

  const total = sumOf(shown, (row) => Number(row.totalAmount || 0));
  return {
    tab, setTab, data, busy, picked, setPicked, query, setQuery, type, setType, types, shown, selected, total,
    returning, setReturning, startReturn, reason, setReason, message, load, decide,
  };
}
