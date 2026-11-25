import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/services/axiosInstance';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { exportEntryApi } from '../../exportEntryApi';
import { toListRow } from './exportJobList';

// jobs of the branch / year picked in the top bar; "Show all" lists every branch and year
export default function useExportJobList(refreshKey) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const [jobs, setJobs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [allBranches, setAllBranches] = useState(false);
  const [otherCount, setOtherCount] = useState(0);

  const branchId = !allBranches && activeBranch?.id && !activeBranch.isAll ? activeBranch.id : undefined;
  const financialYearId = !allBranches && activeYear?.id ? activeYear.id : undefined;

  const loadJobs = useCallback(async () => {
    const failed = (message) => {
      setLoadError(message);
      toast.error(`Job list: ${message}`);
      return null;
    };
    try {
      const answer = await exportEntryApi.queryJobs({ branchId, financialYearId });
      if (!answer.success) return failed(answer.error || answer.message || 'could not load the job list');
      const rows = answer.data.map(toListRow);
      setLoadError('');
      setJobs(rows);
      setOtherCount(answer.filtered && answer.totalAll > rows.length ? answer.totalAll - rows.length : 0);
      return rows;
    } catch (error) {
      return failed(errorMessage(error) || 'could not load the job list');
    }
  }, [branchId, financialYearId]);

  useEffect(() => { loadJobs(); }, [loadJobs, refreshKey]);

  const branchName = activeBranch?.branchName || activeBranch?.name || 'this branch';

  return { jobs, setJobs, loadJobs, loadError, allBranches, setAllBranches, otherCount, branchName };
}
