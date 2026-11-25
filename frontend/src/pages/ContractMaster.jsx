import { useState } from 'react';
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import PageHeader from './PurchaseParts/PageHeader';
import useContractEditor from './ContractMasterParts/useContractEditor';
import ContractToolbar from './ContractMasterParts/ContractToolbar';
import ContractHeaderForm from './ContractMasterParts/ContractHeaderForm';
import { ChargeRulesTab, FreightRatesTab, TransportRatesTab } from './ContractMasterParts/RateTabs';
import TermsTab from './ContractMasterParts/TermsTab';

const DETAIL_TABS = [
  { value: 'freight', label: '✈️ Freight Rate Matrix' },
  { value: 'local', label: '📑 Advanced Charge Rules' },
  { value: 'transport', label: '🚚 Transport & Cartage' },
  { value: 'terms', label: '📝 Terms & Conditions' },
];

// Customer contracts / quotations: the rates and charge rules that job billing reads (saved in /contracts).
export default function ContractMaster() {
  const [activeTab, setActiveTab] = useState('freight');
  const editor = useContractEditor();
  const { form, gstCharges } = editor;

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1600px] tw:flex-col tw:gap-5 tw:p-3 tw:md:p-5">
      <PageHeader
        className="tw:lg:items-start"
        title="Customer Contract & Quotation Master"
        subtitle="Advanced level contract management for automated job billing"
        actions={(
          <ContractToolbar
            contracts={editor.contracts}
            contractId={editor.contractId}
            canApprove={editor.canApprove}
            saving={editor.saving}
            onOpen={editor.openContract}
            onDelete={editor.deleteContract}
            onSetStatus={editor.setStatus}
            onSave={editor.saveContract}
          />
        )}
      />

      <ContractHeaderForm
        header={form.header}
        onHeaderChange={editor.setHeaderField}
        parties={editor.parties}
        onPartyPick={editor.pickParty}
        contracts={editor.contracts}
        contractId={editor.contractId}
        onOpenContract={editor.openContract}
        onNewForCustomer={editor.startNewForCustomer}
      />

      <Card className="tw:overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList variant="line" className="tw:w-full tw:justify-start tw:overflow-x-auto tw:border-b tw:border-border tw:bg-page">
            {DETAIL_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="tw:h-11 tw:px-4 tw:text-sm tw:font-semibold tw:md:px-6">{tab.label}</TabsTrigger>
            ))}
          </TabsList>
          <div className="tw:min-h-[350px]">
            <TabsContent value="freight">
              <FreightRatesTab rows={form.freightRates} gstCharges={gstCharges} {...editor.freightActions} />
            </TabsContent>
            <TabsContent value="local">
              <ChargeRulesTab rows={form.localCharges} gstCharges={gstCharges} {...editor.chargeActions} />
            </TabsContent>
            <TabsContent value="transport">
              <TransportRatesTab rows={form.transportRates} gstCharges={gstCharges} {...editor.transportActions} />
            </TabsContent>
            <TabsContent value="terms">
              <TermsTab terms={form.terms} onTermsChange={editor.setTerms} prefs={form.prefs} onPrefChange={editor.setPref} />
            </TabsContent>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
