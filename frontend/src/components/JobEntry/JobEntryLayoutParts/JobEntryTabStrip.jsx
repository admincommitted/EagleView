import { MessageSquare } from 'lucide-react';
import { Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { JOB_ENTRY_TABS } from './jobEntryTabs';

export default function JobEntryTabStrip({ activeTab, onTabChange, allowedTabs, onShowTimeline }) {
  return (
    <div className="tw:bg-background tw:px-2 tw:pt-3">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <div className="tw:flex tw:min-w-0 tw:items-end tw:gap-2 tw:border-b-2 tw:border-primary">
          <TabsList className="tw:w-auto tw:min-w-0 tw:overflow-x-auto tw:overflow-y-hidden tw:border-b-0">
            {JOB_ENTRY_TABS.filter((tab) => allowedTabs.includes(tab.key)).map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>{tab.label}</TabsTrigger>
            ))}
          </TabsList>
          <Button variant="secondary" className="tw:mb-1 tw:ml-auto" title="Timeline Log" onClick={onShowTimeline}>
            <MessageSquare /> <span className="tw:hidden tw:sm:inline">Timeline Log</span>
          </Button>
        </div>
      </Tabs>
    </div>
  );
}
