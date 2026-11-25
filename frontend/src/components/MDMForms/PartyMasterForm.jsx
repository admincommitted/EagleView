import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import usePartyMasterForm from './PartyMasterFormParts/usePartyMasterForm';
import SearchPartySection from './PartyMasterFormParts/sections/SearchPartySection';
import PartyDetailsSection from './PartyMasterFormParts/sections/PartyDetailsSection';
import PartyAddressSection from './PartyMasterFormParts/sections/PartyAddressSection';
import OtherDetailsSection from './PartyMasterFormParts/sections/OtherDetailsSection';
import CustomClearanceAiSection from './PartyMasterFormParts/sections/CustomClearanceAiSection';
import PartyActionsSection from './PartyMasterFormParts/sections/PartyActionsSection';
import PartyDialogs from './PartyMasterFormParts/sections/PartyDialogs';

const TABS = [
  { value: 'details', label: 'Primary Details & Branches' },
  { value: 'adcode', label: 'Other Details' },
  { value: 'ai_rules', label: 'AI Rules (Gemini)' },
];

// the Unified Party Master: importers / exporters / consignees and their branches, used by job entry
export default function PartyMasterForm() {
  const ctx = usePartyMasterForm();
  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:lg:h-full tw:lg:min-h-0 tw:lg:flex-row">
      <SearchPartySection ctx={ctx} />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-4 tw:pb-4 tw:lg:overflow-y-auto">
        <Tabs value={ctx.activeTab} onValueChange={ctx.setActiveTab} className="tw:flex-1 tw:gap-2">
          <TabsList variant="line" className="tw:w-full tw:flex-wrap tw:justify-start tw:border-b tw:border-border">
            {TABS.map((tab) => <TabsTrigger key={tab.value} value={tab.value} className="tw:text-[11px]">{tab.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="details" className="tw:flex tw:flex-col tw:gap-4">
            <PartyDetailsSection ctx={ctx} />
            <PartyAddressSection ctx={ctx} />
          </TabsContent>
          <TabsContent value="adcode">
            <OtherDetailsSection ctx={ctx} />
          </TabsContent>
          <TabsContent value="ai_rules" className="tw:flex tw:flex-col">
            <CustomClearanceAiSection ctx={ctx} />
          </TabsContent>
        </Tabs>
        <PartyActionsSection ctx={ctx} />
      </div>
      <PartyDialogs ctx={ctx} />
    </div>
  );
}
