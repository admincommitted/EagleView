// Page heading of the open master with its search box and Create New
import { Plus, Search } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { chartTabOf } from '../chartTabs';

export default function ManageYourAccountingSection({ chart }) {
  const { activeTab, handleCreateNew, searchQuery, setSearchQuery, showForm } = chart;
  return (
    <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
      <div>
        <h3 className="tw:m-0 tw:mb-1 tw:text-2xl tw:font-bold tw:text-foreground">{chartTabOf(activeTab).label}</h3>
        <p className="tw:m-0 tw:text-[13px] tw:text-muted-foreground">Manage your accounting masters and hierarchies.</p>
      </div>
      {!showForm && (
        <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:md:gap-4">
          <Input
            leftIcon={Search}
            data-allow-text=""
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="tw:h-9 tw:rounded-lg tw:text-[13px] tw:sm:w-[280px]"
          />
          <Button variant="default" onClick={handleCreateNew} className="tw:h-9 tw:rounded-lg tw:px-5 tw:text-[13px]"><Plus className="tw:size-4.5" /> Create New</Button>
        </div>
      )}
    </div>
  );
}
