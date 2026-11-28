import { Activity, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import useChartOfAccounts from './ChartOfAccountsParts/useChartOfAccounts';
import { chartTabOf } from './ChartOfAccountsParts/chartTabs';
import AccountingSection from './ChartOfAccountsParts/sections/AccountingSection';
import ManageYourAccountingSection from './ChartOfAccountsParts/sections/ManageYourAccountingSection';
import GroupNameSection from './ChartOfAccountsParts/sections/GroupNameSection';
import GeneralSection from './ChartOfAccountsParts/sections/GeneralSection';
import VoucherNameSection from './ChartOfAccountsParts/sections/VoucherNameSection';
import { AccountTree, CategoryCards, CentreTree, CurrencyCards, TdsNaturesTable, VoucherTypesTable } from './ChartOfAccountsParts/sections/MasterLists';

const LIST_OF_TAB = {
  groups: AccountTree,
  ledgers: AccountTree,
  vouchers: VoucherTypesTable,
  categories: CategoryCards,
  centres: CentreTree,
  currencies: CurrencyCards,
  tds: TdsNaturesTable,
};

function EntryForm({ chart }) {
  const { activeTab, editMode, setShowForm } = chart;
  return (
    <div className={cn('tw:animate-in tw:fade-in-0 tw:slide-in-from-bottom-2 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4 tw:md:p-8', activeTab === 'ledgers' ? 'tw:max-w-[800px]' : 'tw:max-w-[640px]')}>
      <div className="tw:mb-6 tw:flex tw:items-center tw:justify-between tw:border-b tw:border-border/60 tw:pb-4">
        <h4 className="tw:m-0 tw:flex tw:items-center tw:gap-2 tw:text-lg tw:text-slate-800">
          <Activity className="tw:size-5 tw:text-blue-500" /> {editMode ? 'Edit' : 'Create'} {chartTabOf(activeTab).entryLabel}
        </h4>
        <Button variant="ghost" size="icon" onClick={() => setShowForm(false)} className="tw:size-7 tw:rounded-full tw:bg-page tw:text-slate-400" title="Close"><X className="tw:size-5" /></Button>
      </div>
      <div className="tw:flex tw:flex-col tw:gap-5">
        <GroupNameSection chart={chart} />
        <GeneralSection chart={chart} />
        <VoucherNameSection chart={chart} />
      </div>
    </div>
  );
}

export default function ChartOfAccounts() {
  const chart = useChartOfAccounts();
  const MasterList = LIST_OF_TAB[chart.activeTab];
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:bg-page">
      <div className="tw:flex tw:flex-1 tw:flex-col tw:overflow-hidden tw:lg:flex-row">
        <AccountingSection chart={chart} />
        <div className="tw:min-w-0 tw:flex-1 tw:overflow-y-auto tw:p-4 tw:md:p-8">
          <ManageYourAccountingSection chart={chart} />
          {chart.showForm
            ? <EntryForm chart={chart} />
            : MasterList && <div className="tw:animate-in tw:fade-in-0 tw:slide-in-from-bottom-2"><MasterList chart={chart} /></div>}
        </div>
      </div>
    </div>
  );
}
