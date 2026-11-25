import { useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import AdvancedEnquiryForm from './AdvancedEnquiryForm';
import AdvancedQuoteForm from './AdvancedQuoteForm';
import LeadCard from './SalesCrmParts/LeadCard';
import LeadSearchPanel from './SalesCrmParts/LeadSearchPanel';
import QuotesTable from './SalesCrmParts/QuotesTable';
import useSalesCrm from './SalesCrmParts/useSalesCrm';

export default function SalesCRM() {
  const [activeTab, setActiveTab] = useState('leads');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showEnquiryForm, setShowEnquiryForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [editQuote, setEditQuote] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const crm = useSalesCrm({ search, statusFilter });
  const { leads, quotes, leadCounts, loading, error } = crm;

  const prepareQuote = (lead) => { setSelectedLead(lead); setEditQuote(null); setShowQuoteForm(true); };
  const openQuote = (quote) => { setEditQuote(quote); setSelectedLead(null); setShowQuoteForm(true); };
  const closeQuoteForm = () => { setShowQuoteForm(false); setEditQuote(null); };
  const afterQuote = async () => {
    setShowQuoteForm(false);
    setSelectedLead(null);
    setEditQuote(null);
    await crm.load();
  };
  const afterEnquiry = async () => {
    setShowEnquiryForm(false);
    await crm.load();
  };

  return (
    <div className="tw:mx-auto tw:flex tw:max-w-[1400px] tw:flex-col tw:gap-5 tw:p-3 tw:md:p-6">
      <div className="tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:rounded-lg tw:bg-primary tw:p-3 tw:text-primary-foreground"><Users className="tw:size-6" /></div>
          <div>
            <h2 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-foreground">Sales & CRM</h2>
            <div className="tw:mt-1 tw:text-[13px] tw:text-muted-foreground">Manage leads, quotations, and procurement buy-rates</div>
          </div>
        </div>
        <div className="tw:flex tw:flex-wrap tw:gap-3">
          <Button size="lg" variant={showSearch ? 'default' : 'outline'} onClick={() => setShowSearch((shown) => !shown)}>
            <Search /> Search Leads{search || statusFilter ? ' (on)' : ''}
          </Button>
          <Button size="lg" variant="default" onClick={() => setShowEnquiryForm(true)}><Plus /> New Lead / Enquiry</Button>
        </div>
      </div>

      {showSearch && (
        <LeadSearchPanel
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          loading={loading}
          leadCount={leads.length}
          leadCounts={leadCounts}
        />
      )}

      {error && (
        <div role="alert" className="tw:rounded-lg tw:border tw:border-destructive/30 tw:bg-destructive/5 tw:px-4 tw:py-3 tw:text-[13px] tw:text-destructive">{error}</div>
      )}

      {showEnquiryForm && <AdvancedEnquiryForm onClose={() => setShowEnquiryForm(false)} onSaved={afterEnquiry} />}
      {showQuoteForm && <AdvancedQuoteForm lead={selectedLead} quote={editQuote} onClose={closeQuoteForm} onSaved={afterQuote} />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="tw:gap-5">
        <TabsList variant="line" className="tw:w-full tw:flex-wrap tw:justify-start tw:border-b tw:border-border">
          <TabsTrigger value="leads" className="tw:font-bold">Pipeline &amp; Leads (Enquiries){leadCounts ? ` (${leads.length})` : ''}</TabsTrigger>
          <TabsTrigger value="quotes" className="tw:font-bold">Quotations &amp; Conversions{quotes.length ? ` (${quotes.length})` : ''}</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(400px,100%),1fr))] tw:gap-5">
            {loading && <div className="tw:p-6 tw:text-[13px] tw:text-muted-foreground">Loading leads...</div>}
            {!loading && !leads.length && (
              <Card className="tw:p-8 tw:text-center tw:text-[13px] tw:text-muted-foreground">
                {search || statusFilter ? 'No lead matches that search.' : 'No enquiry recorded yet. Use "New Lead / Enquiry" to add the first one.'}
              </Card>
            )}
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                showDetails={detailLead === lead.id}
                onToggleDetails={() => setDetailLead(detailLead === lead.id ? null : lead.id)}
                onPrepareQuote={() => prepareQuote(lead)}
                onSeeQuotes={() => setActiveTab('quotes')}
                onMarkLost={() => crm.markLost(lead)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <QuotesTable
            quotes={quotes}
            loading={loading}
            onOpen={openQuote}
            onSend={crm.sendQuote}
            onApprove={crm.approveQuote}
            onReject={crm.rejectQuote}
            onConvert={crm.convertToJob}
            onRemove={crm.removeQuote}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
