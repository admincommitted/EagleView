import { FileText, Info, Plane, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui';

export default function ActionBar({ ctx }) {
  const { handleSubmit, onSubmit } = ctx;
  return (
    <div className="tw:sticky tw:bottom-0 tw:z-50 tw:flex tw:flex-col tw:gap-3 tw:border-t tw:border-border tw:bg-card tw:px-4 tw:py-4 tw:shadow-[0_-4px_20px_rgba(0,0,0,0.03)] tw:md:flex-row tw:md:items-center tw:md:justify-between tw:md:px-8">
      <div className="tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:text-muted-foreground">
        <Info className="tw:size-4" /> All mandatory fields must be filled before submission.
      </div>
      <div className="tw:flex tw:flex-wrap tw:gap-3 tw:md:gap-4">
        <Button size="lg" onClick={() => toast.success('Draft Saved!')}><Save className="tw:size-4" /> Save Draft</Button>
        <Button size="lg" variant="success" onClick={() => toast.success('Preview Generating...')}><FileText className="tw:size-4" /> Preview AWB</Button>
        <Button size="lg" variant="default" className="tw:px-8" onClick={handleSubmit(onSubmit)}><Plane className="tw:size-4" /> Submit AWB</Button>
      </div>
    </div>
  );
}
