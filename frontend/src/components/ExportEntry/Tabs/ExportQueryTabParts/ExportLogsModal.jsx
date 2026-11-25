import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui';
import { exportEntryApi } from '../../exportEntryApi';

const logsErrorText = (error) => (error.response ? error.response.data?.error || 'Failed to fetch logs' : 'Error fetching logs');

export default function ExportLogsModal({ job, onClose }) {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const entries = await exportEntryApi.queryJobLogs(job.id);
        setLogs(Array.isArray(entries) ? entries : []);
      } catch (error) {
        toast.error(logsErrorText(error));
        setLogs([]);
      }
    };
    load();
  }, [job]);

  return (
    <Modal open title={`Job Log - ${job.jobNo || ''}`} width={560} onClose={onClose} bodyClassName="tw:gap-0">
      {!logs && <Loader2 className="tw:mx-auto tw:size-5 tw:animate-spin tw:text-primary" />}
      {logs?.length === 0 && <span className="tw:text-muted-foreground">No log entries yet.</span>}
      {logs?.map((entry, index) => (
        <div key={index} className="tw:flex tw:flex-col tw:gap-0.5 tw:border-b tw:border-border tw:py-1.5">
          <div className="tw:flex tw:flex-wrap tw:justify-between tw:gap-x-2">
            <b className="tw:text-head">{entry.action}</b>
            <span className="tw:text-[11px] tw:text-muted-foreground">{entry.time && new Date(entry.time).toLocaleString()}</span>
          </div>
          <span>{entry.details}{entry.user && ` — ${entry.user}`}</span>
        </div>
      ))}
    </Modal>
  );
}
