import { useEffect, useState } from 'react';
import { errorMessage } from '@/services/axiosInstance';
import { askConfirm } from '@/components/common/askConfirm';
import { accountsApi } from '../../accountsApi';
import { sumOf } from '../../VoucherDeskParts/amounts';

const FLAGS = {
  loss: (job) => job.profit < 0,
  unbilled: (job) => !job.billed,
  nocost: (job) => !job.hasCost,
};

// income / expense / profit of every job; close (no new voucher for that job) or re-open
export function useJobClosing() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('OPEN');
  const [flag, setFlag] = useState('');
  const [picked, setPicked] = useState({});
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setBusy(true);
    try {
      setRows(await accountsApi.otherDeskJobs());
    } catch (error) {
      setMessage('Not loaded: ' + errorMessage(error));
    }
    setBusy(false);
  };
  useEffect(() => { load(); }, []);

  const shown = rows.filter((job) => (!status || job.status === status)
    && (!query || job.jobNo.includes(query.toUpperCase().trim()))
    && (!flag || FLAGS[flag](job)));
  const selected = shown.filter((job) => picked[job.jobNo]);
  const selectedOpen = selected.filter((job) => job.status === 'OPEN');
  const selectedClosed = selected.filter((job) => job.status === 'CLOSED');

  const act = async (jobs, action) => {
    if (!jobs.length) return;
    if (action === 'close') {
      const goAhead = await askConfirm({ title: 'Close jobs', message: 'Close ' + jobs.length + ' job(s)? No new voucher can be posted for a closed job.', okLabel: 'Close', tone: 'warn' });
      if (!goAhead) return;
    }
    try {
      for (const job of jobs) await accountsApi.otherDeskCloseJob({ jobNo: job.jobNo, remarks, action });
      setPicked({});
      setRemarks('');
      setMessage((action === 'close' ? 'Closed ' : 'Re-opened ') + jobs.length + ' job(s)');
      load();
    } catch (error) {
      setMessage('Not changed: ' + errorMessage(error));
    }
  };

  const openJobs = rows.filter((job) => job.status === 'OPEN');
  const summary = {
    jobs: rows.length, open: openJobs.length, closed: rows.length - openJobs.length, profit: sumOf(rows, (job) => job.profit),
    losses: rows.filter((job) => job.profit < 0).length, openUnbilled: openJobs.filter((job) => !job.billed).length,
  };
  const shownTotal = (key) => sumOf(shown, (job) => job[key]);

  return {
    rows, shown, busy, query, setQuery, status, setStatus, flag, setFlag, picked, setPicked, remarks, setRemarks, message,
    selectedOpen, selectedClosed, summary, shownTotal, load, act,
  };
}
