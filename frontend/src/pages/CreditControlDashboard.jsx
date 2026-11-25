import { useState } from 'react';
import { AlertTriangle, FileText, Mail, PhoneCall, Receipt, RefreshCcw, Scale, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DateInput, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { SummaryCard } from './LedgerReportParts/ReportLayout';
import { formatRupeesWhole } from './LedgerReportParts/format';
import { useCreditControl } from './LedgerReportParts/creditControl/useCreditControl';
import ClientList from './LedgerReportParts/creditControl/ClientList';
import PendingInvoicesTab from './LedgerReportParts/creditControl/PendingInvoicesTab';
import FollowUpsTab from './LedgerReportParts/creditControl/FollowUpsTab';
import LedgerRecoTab from './LedgerReportParts/creditControl/LedgerRecoTab';
import AutoMailRulesTab from './LedgerReportParts/creditControl/AutoMailRulesTab';

const KPI_CARDS = [
  {
    label: 'Total Outstanding',
    tone: 'primary',
    value: (kpis) => formatRupeesWhole(kpis.totalOutstanding),
    note: (kpis) => `${formatRupeesWhole(kpis.notDue)} still within terms`,
  },
  {
    label: 'Overdue (31-60 Days)',
    tone: 'warning',
    value: (kpis) => formatRupeesWhole(kpis.overdue31to60),
    note: (kpis) => `${formatRupeesWhole(kpis.overdue1to30)} at 1-30 days`,
  },
  {
    label: 'Critical (60+ Days)',
    tone: 'danger',
    value: (kpis) => formatRupeesWhole(kpis.critical60plus),
    note: (kpis) => (kpis.partiesOverLimit ? `${kpis.partiesOverLimit} part(y/ies) over credit limit` : ''),
  },
  {
    label: 'Expected This Week',
    tone: 'success',
    value: (kpis) => formatRupeesWhole(kpis.expectedThisWeek),
    note: (kpis) => (kpis.promisesCounted
      ? `From ${kpis.promisesCounted} logged Promise-to-Pay date(s)`
      : 'No Promise-to-Pay logged - this is not a forecast'),
  },
];

const DETAIL_TABS = [
  { value: 'invoices', label: 'Pending Invoices', icon: Receipt },
  { value: 'followups', label: 'CRM & Follow-ups', icon: PhoneCall },
  { value: 'reco', label: 'Ledger Auto-Reco', icon: Scale },
  { value: 'settings', label: 'Auto-Mail Rules', icon: Settings },
];

const RISK_COLORS = { High: 'tw:text-destructive', Medium: 'tw:text-warning' };

function ClientHeader({ client, party, loading, onSendStatement }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-xs tw:md:flex-row tw:md:items-center tw:md:justify-between">
      <div className="tw:min-w-0">
        <h3 className="tw:m-0 tw:text-xl tw:text-foreground">{client.name}{loading ? ' ...' : ''}</h3>
        <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-1 tw:text-[13px] tw:text-muted-foreground">
          <span className="tw:flex tw:items-center tw:gap-1"><PhoneCall className="tw:size-3.5" /> {party.phone || 'no phone on the ledger'}</span>
          <span className="tw:flex tw:items-center tw:gap-1"><Mail className="tw:size-3.5" /> {party.email || 'no email on the ledger'}</span>
          <span className={cn('tw:flex tw:items-center tw:gap-1', RISK_COLORS[client.risk] || 'tw:text-success')}>
            <AlertTriangle className="tw:size-3.5" /> Risk: {client.risk} &mdash; {client.riskWhy}
          </span>
          <span>Credit {client.creditDays || 0} days</span>
        </div>
      </div>
      <Button size="lg" onClick={onSendStatement}><FileText /> Email Ledger</Button>
    </div>
  );
}

function ClientDetail({ credit, activeTab, onTabChange }) {
  const { selectedClient: client, detail } = credit;
  return (
    <>
      <ClientHeader client={client} party={detail.party} loading={credit.detailLoading} onSendStatement={credit.sendStatement} />
      <Tabs value={activeTab} onValueChange={onTabChange} className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:shadow-xs">
        <TabsList variant="line" className="tw:w-full tw:justify-start tw:overflow-x-auto tw:rounded-t-lg tw:border-b tw:border-border tw:bg-page tw:px-2">
          {DETAIL_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="tw:h-11 tw:px-4 tw:text-[13px] tw:font-semibold">
              <tab.icon /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="tw:min-h-[400px] tw:min-w-0 tw:p-3 tw:md:p-5">
          <TabsContent value="invoices"><PendingInvoicesTab detail={detail} /></TabsContent>
          <TabsContent value="followups">
            <FollowUpsTab
              draft={credit.followUp}
              onDraftChange={credit.setFollowUp}
              saving={credit.savingFollowUp}
              onSave={credit.logFollowUp}
              followUps={detail.followUps}
              onMarkPromise={credit.markPromise}
            />
          </TabsContent>
          <TabsContent value="reco">
            <LedgerRecoTab clientName={client.name} reco={credit.reco} busy={credit.recoBusy} onFile={credit.matchLedgerFile} />
          </TabsContent>
          <TabsContent value="settings">
            {credit.policy && (
              <AutoMailRulesTab
                client={client}
                hasEmail={!!detail.party.email}
                policy={credit.policy}
                onPolicyChange={credit.setPolicy}
                onSave={credit.savePolicy}
              />
            )}
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}

export default function CreditControlDashboard() {
  const credit = useCreditControl();
  const [activeTab, setActiveTab] = useState('invoices');
  const { kpis } = credit;

  return (
    <div className="tw:mx-auto tw:flex tw:w-full tw:max-w-[1600px] tw:min-w-0 tw:flex-col tw:gap-5 tw:p-3 tw:md:p-5">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div>
          <h2 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-foreground">Credit Control & Ageing Dashboard</h2>
          <p className="tw:m-0 tw:mt-1 tw:text-[13px] tw:text-muted-foreground">Advanced Accounts Receivable CRM & Ledger Reconciliation</p>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
          <span title="Ageing as on"><DateInput wrapperClassName="tw:w-32" value={credit.asOn} onValueChange={credit.setAsOn} /></span>
          {/* There is no outside ERP: these figures are the ledger in this system, so this re-reads it. */}
          <Button size="lg" onClick={credit.load} disabled={credit.loading}>
            <RefreshCcw /> {credit.loading ? 'Reading the ledger...' : 'Refresh from ledger'}
          </Button>
        </div>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:xl:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <SummaryCard key={card.label} label={card.label} tone={card.tone} value={kpis ? card.value(kpis) : '-'} note={kpis ? card.note(kpis) : ''} />
        ))}
      </div>

      <div className="tw:flex tw:flex-col tw:gap-5 tw:lg:flex-row tw:lg:items-start">
        <ClientList
          clients={credit.clients}
          loading={credit.loading}
          error={credit.error}
          asOn={credit.asOn}
          note={credit.meta?.note}
          selectedId={credit.selectedId}
          onSelect={credit.setSelectedId}
        />
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-5 tw:lg:flex-[2.5]">
          {credit.selectedClient && credit.detail ? (
            <ClientDetail credit={credit} activeTab={activeTab} onTabChange={setActiveTab} />
          ) : (
            <div className="tw:flex tw:min-h-[200px] tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:text-muted-foreground tw:shadow-xs">
              <AlertTriangle className="tw:size-12 tw:opacity-50" />
              <div className="tw:text-base tw:font-semibold">Select a client from the left to view credit details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
