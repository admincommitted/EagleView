import { Briefcase, Send, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, DataTable } from '@/components/ui';
import { QUOTE_BADGE, dmy, money } from './crmFormat';

const SmallNote = ({ className, children }) => <div className={cn('tw:text-[11px] tw:font-normal tw:text-muted-foreground', className)}>{children}</div>;

function QuoteActions({ quote, actions }) {
  return (
    <div className="tw:flex tw:flex-wrap tw:justify-center tw:gap-1.5">
      <Button variant="outline" onClick={() => actions.onOpen(quote)}>Open</Button>
      {['DRAFT', 'SENT'].includes(quote.status) && <Button onClick={() => actions.onSend(quote)}><Send /> Email</Button>}
      {quote.status === 'SENT' && (
        <>
          <Button variant="warning" onClick={() => actions.onApprove(quote)}>Approved</Button>
          <Button variant="destructive" onClick={() => actions.onReject(quote)}>Rejected</Button>
        </>
      )}
      {quote.status === 'APPROVED' && <Button variant="success" onClick={() => actions.onConvert(quote)}><Briefcase /> Link to Job</Button>}
      {quote.status !== 'CONVERTED' && (
        <Button variant="ghost" size="icon" title="Delete" aria-label="Delete" className="tw:text-destructive" onClick={() => actions.onRemove(quote)}><Trash2 /></Button>
      )}
    </div>
  );
}

export default function QuotesTable({ quotes, loading, ...actions }) {
  const columns = [
    {
      key: 'quoteNo',
      header: 'Quote No.',
      className: 'tw:font-bold',
      cell: (quote) => (
        <>
          {quote.quoteNo}
          <SmallNote>
            {dmy(quote.date)}
            {quote.validUntil ? ` · valid to ${dmy(quote.validUntil)}` : ''}
            {quote.expired && quote.status !== 'CONVERTED' ? ' · EXPIRED' : ''}
          </SmallNote>
        </>
      ),
    },
    {
      key: 'client',
      header: 'Client / routing',
      cell: (quote) => (
        <>
          {quote.clientName}
          <SmallNote>
            {[quote.origin, quote.destination].filter(Boolean).join(' → ')}{quote.mode ? ` · ${quote.mode}` : ''}
            {quote.charges ? ` · ${quote.charges.length} charge line(s)` : ''}
          </SmallNote>
          {quote.jobNo && <SmallNote className="tw:text-success">job {quote.jobNo}</SmallNote>}
          {!quote.totalsMatchLines && <SmallNote className="tw:text-destructive">stored total does not match the charge lines</SmallNote>}
        </>
      ),
    },
    { key: 'buy', header: 'Buy', align: 'right', className: 'tw:text-destructive', cell: (quote) => money(quote.totalBuyInr) },
    { key: 'sell', header: 'Sell', align: 'right', className: 'tw:font-bold', cell: (quote) => money(quote.totalSellInr) },
    {
      key: 'margin',
      header: 'Margin',
      align: 'center',
      cell: (quote) => (
        <>
          <span className={cn('tw:font-bold', quote.marginInr < 0 ? 'tw:text-destructive' : 'tw:text-success')}>{money(quote.marginInr)}</span>
          <SmallNote>{quote.marginPct == null ? '' : `${quote.marginPct}%`}</SmallNote>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      cell: (quote) => (
        <>
          <Badge variant={QUOTE_BADGE[quote.status] || QUOTE_BADGE.DRAFT}>{quote.status}</Badge>
          {quote.sentTo && <SmallNote className="tw:mt-0.5 tw:text-[10px]">to {quote.sentTo}</SmallNote>}
          {quote.status === 'REJECTED' && quote.rejectReason && <SmallNote className="tw:mt-0.5 tw:text-[10px] tw:text-destructive">{quote.rejectReason}</SmallNote>}
        </>
      ),
    },
    { key: 'action', header: 'Action', align: 'center', cell: (quote) => <QuoteActions quote={quote} actions={actions} /> },
  ];

  return (
    <div className="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-card">
      <DataTable
        columns={columns}
        rows={quotes}
        emptyText={loading ? 'Loading quotations...' : 'No quotation yet. Open a lead and use "Prepare Quotation".'}
      />
      <div className="tw:border-t tw:border-border tw:bg-page tw:px-4 tw:py-2.5 tw:text-[11px] tw:text-muted-foreground">
        Buy and sell are converted to rupees at the exchange rate stored on each charge line, taken from the Currency master when the quote was made.
        &quot;Link to Job&quot; records the job number against the quote so the MIS report can compare what was quoted with what the job actually earned.
      </div>
    </div>
  );
}
