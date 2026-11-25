import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { lookup, todayIso } from '../../ui';

const blankChallan = () => ({ challanNo: '', bsrCode: '', paidOn: todayIso(), amount: '', interest: '', remarks: '' });

// late TDS deposit: interest 1.5% a month (part of a month counts as a month)
const lateInterest = (row) => (row.status === 'OVERDUE' ? String(Math.ceil(row.balance * 0.015 * Math.max(1, Math.ceil(row.daysLate / 30)))) : '');

// TDS deducted per month and section against challans paid, due dates, late days
export function useTdsPayable() {
  const [years, setYears] = useState([]);
  const [fyId, setFyId] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [deductions, setDeductions] = useState([]);
  const [challan, setChallan] = useState(blankChallan);
  const [statusFilter, setStatusFilter] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const result = await accountsApi.otherDeskTdsPayable(fyId);
      setData(result);
      if (selected) setSelected(result.rows.find((row) => row.month === selected.month && row.section === selected.section) || null);
    } catch (error) {
      setMessage('Not loaded: ' + errorMessage(error));
    }
  };
  useEffect(() => {
    const loadYears = async () => setYears(await lookup('years'));
    loadYears();
  }, []);
  useEffect(() => { load(); }, [fyId]);

  const pick = async (row) => {
    setSelected(row);
    setMessage('');
    setChallan({ ...blankChallan(), amount: row.balance > 0 ? String(row.balance) : '', interest: lateInterest(row) });
    try {
      setDeductions(await accountsApi.otherDeskTdsPayableDetail(row.month, row.section));
    } catch {
      setDeductions([]);
    }
  };
  const pickYear = (id) => {
    setFyId(id);
    setSelected(null);
  };
  const setChallanField = (key) => (value) => setChallan((current) => ({ ...current, [key]: value }));

  const addChallan = async () => {
    setMessage('');
    try {
      await accountsApi.otherDeskSaveTdsChallan({ ...challan, month: selected.month, section: selected.section });
      setMessage('Saved challan ' + challan.challanNo);
      load();
      setChallan({ ...challan, challanNo: '', amount: '', interest: '' });
    } catch (error) {
      setMessage('Not saved: ' + errorMessage(error));
    }
  };
  const deleteChallan = async (paid) => {
    const goAhead = await askConfirm({ title: 'Delete challan', message: 'Delete challan ' + paid.challanNo + '?', okLabel: 'Delete', tone: 'danger' });
    if (!goAhead) return;
    try {
      await accountsApi.otherDeskDeleteTdsChallan(paid.id);
      setMessage('Deleted challan');
      load();
    } catch (error) {
      setMessage('Not deleted: ' + errorMessage(error));
    }
  };

  const rows = data ? data.rows.filter((row) => !statusFilter || row.status === statusFilter) : [];
  return {
    years, fyId, pickYear, data, rows, selected, deductions, challan, setChallanField, statusFilter, setStatusFilter, message,
    load, pick, addChallan, deleteChallan,
  };
}
