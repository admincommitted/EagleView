// Side list of the masters (Account Groups, Ledgers, Voucher Types ...); a row of tabs on a phone
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { CHART_TABS } from '../chartTabs';

export default function AccountingSection({ chart }) {
  const { activeTab, changeTab } = chart;
  return (
    <div className="tw:z-10 tw:flex tw:flex-col tw:border-b tw:border-border tw:bg-card tw:lg:w-[260px] tw:lg:shrink-0 tw:lg:border-r tw:lg:border-b-0">
      <div className="tw:flex tw:items-center tw:gap-2.5 tw:px-5 tw:pt-4 tw:pb-3 tw:lg:pt-6 tw:lg:pb-4">
        <div className="tw:rounded-lg tw:bg-primary/10 tw:p-2"><Layers className="tw:size-5 tw:text-primary" /></div>
        <div>
          <div className="tw:text-[15px] tw:font-bold tw:text-foreground">Accounting</div>
          <div className="tw:mt-0.5 tw:text-[11px] tw:tracking-wider tw:text-muted-foreground tw:uppercase">Core Masters</div>
        </div>
      </div>
      <div className="tw:flex tw:gap-1 tw:overflow-x-auto tw:px-3 tw:pb-2 tw:lg:flex-col tw:lg:overflow-visible tw:lg:py-2">
        {CHART_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="block"
              onClick={() => changeTab(tab.id)}
              className={cn(
                'tw:w-auto tw:shrink-0 tw:gap-3 tw:rounded-lg tw:px-4 tw:py-3 tw:text-[13px] tw:lg:w-full',
                selected ? 'tw:bg-primary/10 tw:font-semibold tw:text-head' : 'tw:font-medium tw:text-foreground/75 tw:hover:bg-muted'
              )}
            >
              <tab.icon className={cn('tw:size-4.5', selected ? 'tw:text-primary' : 'tw:text-muted-foreground')} /> {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
