import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { exportEntryApi } from '../exportEntryApi';

// The job no the next save will get, shown on a job not saved yet.
export function usePredictedJobNo(jobNo, shipmentMode) {
  const activeBranch = useWorkspaceStore((state) => state.activeBranch);
  const activeYear = useWorkspaceStore((state) => state.activeYear);
  const [predictedJobNo, setPredictedJobNo] = useState(null);
  const isUnsaved = !jobNo || jobNo === 'DRAFT';

  useEffect(() => {
    if (!isUnsaved) {
      setPredictedJobNo(null);
      return;
    }
    const loadNextJobNo = async () => {
      try {
        const reply = await exportEntryApi.nextJobNo({
          branchId: (activeBranch && !activeBranch.isAll && activeBranch.id) || '',
          shipmentMode: shipmentMode || 'AIR',
          financialYearId: activeYear?.id || '',
        });
        if (reply.success) setPredictedJobNo(reply.nextJobNo);
      } catch (error) {
        console.error('Error fetching predicted job no', error);
      }
    };
    loadNextJobNo();
  }, [isUnsaved, jobNo, shipmentMode, activeBranch, activeYear]);

  return predictedJobNo;
}
