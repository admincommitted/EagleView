import { Anchor, CheckCircle, FileText, Mail, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Card } from '@/components/ui';
import { LEAD_BADGE, LEAD_EDGE, dmy, money } from './crmFormat';

const joinDots = (parts) => parts.filter(Boolean).join(' · ');

function ContactBit({ icon: Icon, children }) {
  if (!children) return null;
  return <span className="tw:flex tw:items-center tw:gap-1"><Icon className="tw:size-3" /> {children}</span>;
}

function leadDetails(lead) {
  return [
    ['Enquiry no', lead.enquiryNo], ['Date', lead.date], ['Mode', lead.mode], ['Service', lead.serviceType],
    ['Incoterms', lead.incoterms], ['Commodity', lead.commodity], ['Container', lead.containerType],
    ['Weight', lead.weight ? Number(lead.weight) : ''], ['Volume', lead.volume ? Number(lead.volume) : ''],
    ['Target rate', lead.targetRate], ['Competitor', lead.competitor],
    ['Raised by', lead.createdByName], ['Remarks', lead.remarks],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
}

export default function LeadCard({ lead, showDetails, onToggleDetails, onPrepareQuote, onSeeQuotes, onMarkLost }) {
  const hasQuotes = lead.quotes?.length > 0;
  const cargo = joinDots([
    lead.commodity, lead.containerType, lead.incoterms,
    lead.weight ? `${Number(lead.weight)} t` : '', lead.volume ? `${Number(lead.volume)} cbm` : '',
    lead.targetRate ? `target ${lead.targetRate}` : '',
  ]);

  return (
    <Card className={cn('tw:gap-4 tw:border-l-4 tw:p-4', LEAD_EDGE[lead.status] || 'tw:border-l-destructive')}>
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:min-w-0">
          <h3 className="tw:m-0 tw:mb-1 tw:text-base tw:font-semibold tw:text-foreground">{lead.clientName}</h3>
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-entry tw:text-muted-foreground">
            <ContactBit icon={FileText}>{lead.enquiryNo}</ContactBit>
            <ContactBit icon={User}>{lead.contactPerson}</ContactBit>
            <ContactBit icon={Phone}>{lead.phone}</ContactBit>
            <ContactBit icon={Mail}>{lead.email}</ContactBit>
          </div>
        </div>
        <Badge variant={LEAD_BADGE[lead.status] || LEAD_BADGE.NEW}>{lead.status}</Badge>
      </div>

      <div className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-md tw:bg-page tw:p-3">
        <div className="tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-semibold tw:text-foreground/80">
          <Anchor className="tw:size-3.5 tw:text-primary" /> {lead.serviceType || lead.mode || 'Route'}
          <span className="tw:text-[11px] tw:font-normal tw:text-muted-foreground">{lead.date ? ` · ${dmy(lead.date)}` : ''}</span>
        </div>
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:text-[13px] tw:font-bold tw:text-foreground">
          <span>{lead.origin || '—'}</span>
          <span className="tw:text-muted-foreground/50">&rarr;</span>
          <span>{lead.destination || '—'}</span>
        </div>
        <div className="tw:text-[11px] tw:text-muted-foreground">{cargo}</div>
        {hasQuotes && (
          <div className="tw:text-[11px] tw:text-head">
            {joinDots(lead.quotes.map((quote) => `${quote.quoteNo} (${quote.status.toLowerCase()}, ${money(quote.value)})`))}
          </div>
        )}
        {lead.status === 'LOST' && lead.lostReason && <div className="tw:text-[11px] tw:text-destructive">Lost: {lead.lostReason}</div>}
      </div>

      <div className="tw:flex tw:flex-wrap tw:gap-3">
        {lead.status === 'NEW' ? (
          <Button variant="default" size="lg" className="tw:flex-1" onClick={onPrepareQuote}><FileText /> Prepare Quotation</Button>
        ) : (
          <Button variant="secondary" size="lg" className="tw:flex-1" onClick={onSeeQuotes}>
            <CheckCircle /> {hasQuotes ? 'See its quotation' : lead.status}
          </Button>
        )}
        <Button size="lg" onClick={onToggleDetails}>{showDetails ? 'Hide' : 'Details'}</Button>
        {['NEW', 'QUOTED'].includes(lead.status) && (
          <Button variant="destructive" size="lg" title="Mark this enquiry lost" onClick={onMarkLost}>Lost</Button>
        )}
      </div>

      {showDetails && (
        <div className="tw:grid tw:gap-1 tw:border-t tw:border-border tw:pt-3 tw:text-entry tw:text-foreground/80">
          {leadDetails(lead).map(([name, value]) => <div key={name}><b>{name}:</b> {String(value)}</div>)}
        </div>
      )}
    </Card>
  );
}
