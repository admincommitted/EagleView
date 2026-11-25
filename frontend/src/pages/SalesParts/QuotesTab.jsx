// Sales > Quotations: every quotation (latest revision) with value, margin, validity and status.
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { DataTable } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { dmy, inr, labelsOf, pairOptions } from './salesFormat';
import { DealBadge, Muted } from './salesWidgets';
import { QUOTE_STATUS } from './salesStyles';
import DealFilters from './DealFilters';
import QuoteForm from './QuoteForm';

const DEFAULT_MARGIN_WARN_PCT = 10;

function quoteColumns(statusLabels, marginWarnPct) {
  return [
    {
      key: 'quoteNo',
      header: 'Quotation',
      className: 'tw:font-semibold tw:text-primary',
      cell: (row) => <>{row.quoteNo}<Muted className="tw:font-normal">{row.enquiryNo}</Muted></>,
    },
    { key: 'date', header: 'Date', cell: (row) => dmy(row.date) },
    { key: 'clientName', header: 'Customer', className: 'tw:whitespace-normal' },
    { key: 'serviceLabel', header: 'Service', className: 'tw:whitespace-normal' },
    { key: 'lane', header: 'From > To', className: 'tw:whitespace-normal', cell: (row) => [row.origin, row.destination].filter(Boolean).join(' > ') },
    { key: 'totalSellInr', header: 'Sell (Rs)', align: 'right', cell: (row) => inr(row.totalSellInr) },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      cell: (row) => (
        <span className={row.marginPct != null && Number(row.marginPct) < marginWarnPct ? 'tw:text-destructive' : 'tw:text-success'}>
          {inr(row.marginInr)}
          <span className="tw:block tw:text-[11px]">{row.marginPct != null ? `${row.marginPct}%` : ''}</span>
        </span>
      ),
    },
    { key: 'validUntil', header: 'Valid until', cell: (row) => <span className={row.expired ? 'tw:text-destructive' : undefined}>{dmy(row.validUntil)}{row.expired ? ' (over)' : ''}</span> },
    { key: 'salesPerson', header: 'Sales person', cell: (row) => row.salesPerson || '-' },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <>
          <DealBadge status={row.status} variants={QUOTE_STATUS} labels={statusLabels} />
          {row.status === 'LOST' && row.rejectReason ? <Muted>{row.rejectReason}</Muted> : null}
        </>
      ),
    },
    { key: 'docketNo', header: 'Docket', cell: (row) => row.docketNo || '' },
  ];
}

export default function QuotesTab({ meta, deal, initialStatus }) {
  const [filters, setFilters] = useState({ q: '', status: initialStatus || '', spId: '', service: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = async (shown = filters) => {
    setLoading(true);
    try {
      setRows((await salesHubApi.quotes(shown)).data || []);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const next = { ...filters, status: initialStatus || '' };
    setFilters(next);
    load(next);
  }, [initialStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field !== 'q') load(next);
  };
  const totals = rows.reduce((sum, row) => ({ sell: sum.sell + (Number(row.totalSellInr) || 0), margin: sum.margin + (Number(row.marginInr) || 0) }), { sell: 0, margin: 0 });

  return (
    <div className="tw:flex tw:flex-col tw:gap-2.5">
      <DealFilters
        meta={meta}
        filters={filters}
        placeholder="Quotation no, customer, place, docket"
        statusLabel="All (latest revisions)"
        statusOptions={[...pairOptions(deal.quoteStatus), { value: 'EXPIRED', label: 'Sent, validity over' }]}
        onQueryChange={(q) => setFilters({ ...filters, q })}
        onSearch={() => load()}
        onFilter={setFilter}
      >
        <Muted className="tw:text-entry tw:sm:ml-auto">{rows.length} quotations, value Rs {inr(totals.sell)}, margin Rs {inr(totals.margin)}</Muted>
      </DealFilters>
      <Muted className="tw:text-[11.5px]">A quotation is made from its enquiry (Enquiries tab).</Muted>
      <DataTable
        columns={quoteColumns(labelsOf(deal.quoteStatus), deal.marginWarnPct || DEFAULT_MARGIN_WARN_PCT)}
        rows={rows}
        onRowClick={(row) => setOpenId(row.id)}
        emptyText={loading ? 'Loading…' : 'No quotations here.'}
        containerClassName="tw:max-h-[calc(100vh-290px)] tw:rounded-md tw:border tw:border-border tw:bg-card"
      />
      {openId && <QuoteForm id={openId} meta={meta} deal={deal} onClose={() => { setOpenId(null); load(); }} onChanged={() => load()} openQuote={setOpenId} />}
    </div>
  );
}
