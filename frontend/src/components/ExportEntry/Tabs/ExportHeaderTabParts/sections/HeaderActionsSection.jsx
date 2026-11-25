import { Edit, RefreshCw, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export default function HeaderActionsSection({ ctx }) {
  const { exportData, saveNewJob, saveChanges, clearHeader } = ctx;
  const isSaved = Boolean(exportData.id);

  return (
    <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-2 tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-1.5">
      <Button variant="success" size="lg" className={cn(isSaved && 'tw:opacity-60')} onClick={saveNewJob}
        title={isSaved ? 'This job is already saved - use Modify to save changes' : 'Save the new job (Ctrl+S)'}>
        <Save /> Save
      </Button>
      <Button variant="success" size="lg" className={cn(!isSaved && 'tw:opacity-60')} onClick={saveChanges}
        title={isSaved ? 'Save the changes of this job (Ctrl+S)' : 'Save the job first'}>
        <Edit /> Modify
      </Button>
      <Button size="lg" onClick={clearHeader}><RefreshCw /> Clear</Button>
    </div>
  );
}
