import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { helpDocs } from '../utils/helpContent';

const HelpViewer = ({ isOpen, onClose, topic }) => {
  if (!isOpen) return null;

  return (
    <aside className="tw:fixed tw:top-[60px] tw:right-0 tw:z-[999999] tw:flex tw:h-[calc(100vh-60px)] tw:w-full tw:flex-col tw:border-l-4 tw:border-double tw:border-head tw:bg-background tw:font-serif tw:normal-case tw:shadow-[-10px_0_25px_rgba(0,0,0,0.15)] tw:md:w-[420px]">
      <div className="tw:mx-5 tw:flex tw:items-start tw:justify-between tw:border-b-2 tw:border-head tw:px-6 tw:pt-6 tw:pb-4">
        <div className="tw:flex tw:items-center tw:gap-3">
          <BookOpen className="tw:size-7 tw:text-head" />
          <h2 className="tw:m-0 tw:text-[26px] tw:font-bold tw:tracking-wide tw:text-foreground tw:uppercase">System Guide</h2>
        </div>
        <Button
          variant="default"
          size="icon"
          aria-label="Close"
          className="tw:size-9 tw:rounded-full tw:border-head tw:bg-head tw:transition-transform tw:hover:scale-110 tw:hover:bg-head"
          onClick={onClose}
        >
          <X className="tw:size-5" strokeWidth={3} />
        </Button>
      </div>
      <div
        className="newspaper-content tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-6 tw:text-justify tw:text-[15px] tw:leading-[1.8] tw:text-foreground"
        dangerouslySetInnerHTML={{ __html: helpDocs[topic] || '<p>No help available for this section.</p>' }}
      />
    </aside>
  );
};

export default HelpViewer;
