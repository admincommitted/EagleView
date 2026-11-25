import { ChevronDown, FileText, HelpCircle } from 'lucide-react';
import { ActionMenu, Button } from '@/components/ui';
import ExportInfoStrip from './ExportInfoStrip';

export default function ExportHeaderBar({ stripProps, actionItems, onNewJob, onShowHelp }) {
  return (
    <div className="tw:mb-1 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:py-0.5 tw:md:flex-nowrap">
      <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-0.5 tw:md:w-auto">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-1">
          <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:text-sm tw:font-semibold tw:text-foreground">
            <FileText className="tw:size-3.5 tw:text-primary" /> EXPORT SHIPPING BILL (CACHE01)
          </h3>
          <Button variant="destructive" size="sm" onClick={onNewJob}>+ CREATE NEW JOB (RESET)</Button>
        </div>
        <ExportInfoStrip {...stripProps} />
      </div>

      <div className="tw:ml-auto tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:md:ml-0">
        <Button variant="secondary" size="icon" className="tw:rounded-full" title="Help & Logic" onClick={onShowHelp}>
          <HelpCircle className="tw:size-4" />
        </Button>
        <ActionMenu
          align="end"
          items={actionItems}
          trigger={<Button variant="default" size="lg">Actions <ChevronDown /></Button>}
        />
      </div>
    </div>
  );
}
