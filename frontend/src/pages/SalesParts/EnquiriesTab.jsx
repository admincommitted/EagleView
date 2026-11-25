// Sales > Enquiries: every RFQ with its status (Open > Quoted > Won / Lost / Dropped), the pipeline figures on top, and the
// enquiry form (customer / prospect, service, lane, cargo) from which quotations are made.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, Hourglass, Inbox, Plus, Send, Target, Trophy } from 'lucide-react';
import { Button, DataTable } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { crore, dmy, labelsOf, pairOptions } from './salesFormat';
import { DealBadge, KpiCard, Muted } from './salesWidgets';
import { ENQUIRY_STATUS } from './salesStyles';
import DealFilters from './DealFilters';
import EnquiryForm from './EnquiryForm';
import QuoteForm from './QuoteForm';

const NO_FILTERS = { q: '', status: '', spId: '', service: '' };

function cargoText(enquiry) {
  const weight = enquiry.chargeableWt ? `${enquiry.chargeableWt} kg ch.` : enquiry.grossWt ? `${enquiry.grossWt} kg` : '';
  return [enquiry.commodity, weight, enquiry.cbm ? `${enquiry.cbm} cbm` : '', enquiry.containers].filter(Boolean).join(' · ');
}

function enquiryColumns(statusLabels) {
  return [
    { key: 'enquiryNo', header: 'Enquiry', className: 'tw:font-semibold tw:text-primary' },
    { key: 'date', header: 'Date', cell: (row) => dmy(row.date) },
    {
      key: 'clientName',
      header: 'Customer',
      className: 'tw:whitespace-normal',
      cell: (row) => <>{row.clientName}{row.contactPerson ? <Muted>{row.contactPerson}</Muted> : null}</>,
    },
    { key: 'serviceLabel', header: 'Service', className: 'tw:whitespace-normal' },
    { key: 'lane', header: 'From > To', className: 'tw:whitespace-normal', cell: (row) => [row.origin, row.destination].filter(Boolean).join(' > ') },
    { key: 'cargo', header: 'Cargo', className: 'tw:whitespace-normal tw:text-[11.5px]', cell: cargoText },
    { key: 'salesPerson', header: 'Sales person', cell: (row) => row.salesPerson || '-' },
    {
      key: 'quoteBy',
      header: 'Quote by',
      cell: (row) => <span className={row.late ? 'tw:font-bold tw:text-destructive' : undefined}>{dmy(row.quoteBy)}{row.priority === 'HIGH' ? ' ⚑' : ''}</span>,
    },
    {
      key: 'lastQuote',
      header: 'Last quotation',
      cell: (row) => (row.lastQuoteNo
        ? <>{row.lastQuoteNo} <span className="tw:text-muted-foreground">{crore(row.lastQuoteSell)}{row.lastQuoteMarginPct != null ? ` · ${row.lastQuoteMarginPct}%` : ''}</span></>
        : <span className="tw:text-muted-foreground">none</span>),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <>
          <DealBadge status={row.status} variants={ENQUIRY_STATUS} labels={statusLabels} />
          {row.lostReason && ['LOST', 'DROPPED'].includes(row.status) ? <Muted>{row.lostReason}</Muted> : null}
        </>
      ),
    },
  ];
}

function PipelineFigures({ summary, onOpenEnquiries, goTab }) {
  return (
    <div className="tw:grid tw:grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] tw:gap-2.5">
      <KpiCard compact label="Open enquiries" value={summary.openEnquiries} icon={Inbox} tone={summary.lateEnquiries ? 'red' : 'blue'} alert={Boolean(summary.lateEnquiries)} onClick={onOpenEnquiries}>
        <span>{summary.lateEnquiries ? `${summary.lateEnquiries} past "quote by"` : 'to be quoted'}</span>
      </KpiCard>
      <KpiCard compact label="Quotations sent" value={summary.sentQuotes} icon={Send} tone="violet" onClick={() => goTab('quotes', 'SENT')}>
        <span>{`${crore(summary.sentValue)} awaiting reply`}</span>
      </KpiCard>
      <KpiCard compact label="Expiring / expired" value={`${summary.expiringQuotes} / ${summary.expiredQuotes}`} icon={Hourglass} tone="amber" alert={Boolean(summary.expiredQuotes)} onClick={() => goTab('quotes', 'EXPIRED')}>
        <span>in 7 days / past validity</span>
      </KpiCard>
      <KpiCard compact label="Won this month" value={summary.wonMonth} icon={Trophy} tone="green" onClick={() => goTab('quotes', 'WON')}>
        <span>{`${crore(summary.wonMonthValue)} · margin ${crore(summary.wonMonthMargin)}`}</span>
      </KpiCard>
      <KpiCard compact label="Win rate this FY" value={summary.winRate == null ? '-' : `${summary.winRate}%`} icon={Target} tone="cyan">
        <span>{`${summary.fyWon} won, ${summary.fyLost} lost`}</span>
      </KpiCard>
      {summary.draftQuotes > 0 && (
        <KpiCard compact label="Draft quotations" value={summary.draftQuotes} icon={ClipboardCheck} tone="slate" onClick={() => goTab('quotes', 'DRAFT')}><span>not sent yet</span></KpiCard>
      )}
    </div>
  );
}

export default function EnquiriesTab({ meta, deal, goTab }) {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openEnquiry, setOpenEnquiry] = useState(null);
  const [openQuoteId, setOpenQuoteId] = useState(null);

  const load = async (shown = filters) => {
    setLoading(true);
    try {
      const [enquiries, deals] = await Promise.all([salesHubApi.enquiries(shown), salesHubApi.dealsSummary()]);
      setRows(enquiries.data || []);
      setSummary(deals.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field !== 'q') load(next);
  };
  const statusLabels = labelsOf(deal.enquiryStatus);

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      {summary && <PipelineFigures summary={summary} onOpenEnquiries={() => setFilter('status', 'OPEN')} goTab={goTab} />}
      <DealFilters
        meta={meta}
        filters={filters}
        placeholder="Enquiry no, customer, place, commodity"
        statusLabel="All status"
        statusOptions={pairOptions(deal.enquiryStatus)}
        onQueryChange={(q) => setFilters({ ...filters, q })}
        onSearch={() => load()}
        onFilter={setFilter}
      >
        <Button variant="default" className="tw:sm:ml-auto" onClick={() => setOpenEnquiry('new')}><Plus /> New enquiry</Button>
      </DealFilters>
      <DataTable
        columns={enquiryColumns(statusLabels)}
        rows={rows}
        onRowClick={(row) => setOpenEnquiry(row.id)}
        emptyText={loading ? 'Loading…' : 'No enquiries. "New enquiry" records a customer\'s request for rates.'}
        containerClassName="tw:max-h-[calc(100vh-330px)] tw:rounded-md tw:border tw:border-border tw:bg-card"
      />
      {openEnquiry && (
        <EnquiryForm
          id={openEnquiry === 'new' ? null : openEnquiry}
          meta={meta}
          deal={deal}
          onClose={() => setOpenEnquiry(null)}
          onSaved={(savedId) => { load(); if (savedId) setOpenEnquiry(savedId); }}
          openQuote={setOpenQuoteId}
        />
      )}
      {openQuoteId && (
        <QuoteForm id={openQuoteId} meta={meta} deal={deal} onClose={() => { setOpenQuoteId(null); load(); }} onChanged={() => load()} openQuote={setOpenQuoteId} />
      )}
    </div>
  );
}
