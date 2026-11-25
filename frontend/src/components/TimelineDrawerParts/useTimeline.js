import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { jobEntryApi } from '../JobEntry/jobEntryApi';

const chaNameByCode = (reply) => {
  const rows = Array.isArray(reply) ? reply : (reply?.success ? reply.data : []);
  return Object.fromEntries((rows || []).filter((cha) => cha?.chaCode).map((cha) => [String(cha.chaCode).trim().toUpperCase(), cha.chaName || '']));
};

function useStatusRows(module) {
  const [statusRows, setStatusRows] = useState([]);
  useEffect(() => {
    const load = async () => {
      try {
        const reply = await jobEntryApi.statusMaster();
        if (reply.success) setStatusRows(reply.data.filter((status) => status.module === module).sort((first, second) => (first.sequence || 0) - (second.sequence || 0)));
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, [module]);
  return statusRows;
}

function useChaNames(isOpen) {
  const [chaNames, setChaNames] = useState({});
  const hasNames = Object.keys(chaNames).length > 0;
  useEffect(() => {
    if (!isOpen || hasNames) return;
    const load = async () => {
      try {
        setChaNames(chaNameByCode(await jobEntryApi.chaMaster()));
      } catch {
        // the Agent box shows the CHA code
      }
    };
    load();
  }, [isOpen, hasNames]);
  return chaNames;
}

// The job's timeline (remarks, statuses and the job's own events) and its header, read while the drawer is open.
export function useTimeline({ isOpen, jobId, module }) {
  const [logs, setLogs] = useState([]);
  const [jobInfo, setJobInfo] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const statusRows = useStatusRows(module);
  const chaNames = useChaNames(isOpen);

  const loadJobInfo = async () => {
    try {
      const reply = module === 'EXPORT' ? await jobEntryApi.exportJob(jobId) : await jobEntryApi.job(jobId);
      setJobInfo(reply.data || reply);
    } catch (error) {
      console.error('Error fetching job info', error);
    }
  };

  const loadLogs = async () => {
    try {
      const reply = await jobEntryApi.jobTimeline(module, jobId);
      setLogs(reply.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    if (!isOpen || !jobId) return;
    setLogs([]);
    setJobInfo(null);
    loadLogs();
    loadJobInfo();
  }, [isOpen, jobId]); // oxlint-disable-line react-hooks/exhaustive-deps

  // A status sent as STATUS also sets the job status on the server (dashboard / job list follow it).
  const addEntry = async ({ text, isStatus, author }) => {
    setIsSaving(true);
    try {
      const reply = await jobEntryApi.addTimelineEntry({ jobId, module, eventType: isStatus ? 'STATUS' : 'REMARK', message: isStatus ? text.toUpperCase() : text, author });
      loadLogs();
      if (reply?.statusUpdated) {
        loadJobInfo();
        toast.success(`Job status set to ${reply.statusUpdated.replace(/_/g, ' ')}`);
      }
      return true;
    } catch (error) {
      if (error.response) {
        const message = error.response.data?.message;
        toast.error(`Failed to add remark${message ? `: ${message}` : ''}`);
      } else {
        toast.error('Error adding remark');
        console.error(error);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEntry = async (log) => {
    try {
      const reply = await jobEntryApi.deleteTimelineEntry(log.id);
      if (reply.success) loadLogs();
      else toast.error(reply.message || 'Could not delete');
    } catch (error) {
      toast.error(error.response ? (error.response.data?.message || 'Could not delete') : `Could not delete: ${error.message}`);
    }
  };

  return { logs, jobInfo, statusRows, chaNames, isSaving, addEntry, deleteEntry };
}
