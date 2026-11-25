import { useEffect, useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { Button, ComboInput, DataTable, Input, Modal, SelectBox } from '@/components/ui';
import { salesHubApi } from './salesApi';
import { crore, dmy, labelsOf, lostReasons } from './salesFormat';
import { DealBadge, FormField, FormSection, Muted, StatusBadge } from './salesWidgets';
import { FORM_GRID, QUOTE_STATUS } from './salesStyles';

const SEARCH_DELAY_MS = 250;
const DEFAULT_MARGIN_WARN_PCT = 10;

/** Customer / prospect search box; shows the picked name with a Change button. */
export function CustomerPick({ customerId, label, onPick, disabled }) {
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState('');
  const [found, setFound] = useState([]);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2) { setFound([]); return undefined; }
    const timer = setTimeout(async () => {
      try {
        setFound((await salesHubApi.customers({ limit: 15, q: query })).data || []);
      } catch {
        /* the next keystroke searches again */
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  if (customerId && !changing) {
    return (
      <div className="tw:flex tw:items-center tw:gap-2">
        <b className="tw:text-[13px]">{label}</b>
        {!disabled && <Button variant="ghost" onClick={() => { setChanging(true); setText(''); }}>Change</Button>}
      </div>
    );
  }
  return (
    <ComboInput
      autoFocus={Boolean(customerId)}
      aria-label="Find customer"
      placeholder="Type 2+ letters of the customer / prospect name, GSTIN, city"
      options={found}
      value={text}
      onValueChange={setText}
      filter={() => true}
      getValue={(customer) => customer.name}
      onSelect={(customer) => { onPick(customer); setChanging(false); setText(''); }}
      renderOption={(customer) => (
        <span className="tw:flex tw:w-full tw:items-center tw:gap-2">
          <span className="tw:flex-1">{customer.name}<span className="tw:text-muted-foreground">{customer.city ? `, ${customer.city}` : ''}</span></span>
          <StatusBadge status={customer.status} />
          <span className="tw:text-[11px] tw:text-muted-foreground">{customer.kamName || 'no KAM'}</span>
        </span>
      )}
    />
  );
}

const PROSPECT_FIELDS = [['name', 'Prospect name', true], ['city', 'City'], ['contact', 'Contact person'], ['email', 'E-mail'], ['mobile', 'Mobile']];

export function ProspectBox({ prospect, onChange, onAdd, onCancel }) {
  return (
    <div className="tw:mt-2 tw:rounded-md tw:border tw:border-dashed tw:border-border tw:bg-page tw:p-2">
      <div className={FORM_GRID.normal}>
        {PROSPECT_FIELDS.map(([field, label, required]) => (
          <FormField key={field} label={label} required={required}>
            <Input value={prospect[field] || ''} onChange={(event) => onChange({ ...prospect, [field]: event.target.value })} />
          </FormField>
        ))}
      </div>
      <div className="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
        <Button variant="default" onClick={onAdd}>Add prospect</Button>
        <Button onClick={onCancel}>Cancel</Button>
        <Muted>Saved in Customers &amp; prospects; complete its profile there later.</Muted>
      </div>
    </div>
  );
}

export function EnquiryQuotes({ enquiry, deal, closed, busy, copyFrom, onLoadCopy, onMakeQuote, onOpenQuote }) {
  const quotes = enquiry.quotes || [];
  const statusLabels = labelsOf(deal.quoteStatus);
  const marginWarnPct = deal.marginWarnPct || DEFAULT_MARGIN_WARN_PCT;
  const columns = [
    { key: 'quoteNo', header: 'Quotation', className: 'tw:font-semibold tw:text-primary' },
    { key: 'date', header: 'Date', cell: (quote) => dmy(quote.date) },
    { key: 'validUntil', header: 'Valid', cell: (quote) => `valid ${dmy(quote.validUntil)}` },
    { key: 'totalSellInr', header: 'Sell', align: 'right', cell: (quote) => crore(quote.totalSellInr) },
    {
      key: 'marginPct',
      header: 'Margin',
      align: 'right',
      cell: (quote) => (
        <span className={Number(quote.marginPct) < marginWarnPct ? 'tw:text-destructive' : 'tw:text-success'}>{quote.marginPct != null ? `${quote.marginPct}%` : ''}</span>
      ),
    },
    { key: 'status', header: 'Status', cell: (quote) => <DealBadge status={quote.status} variants={QUOTE_STATUS} labels={statusLabels} /> },
    { key: 'docketNo', header: 'Docket', className: 'tw:text-muted-foreground', cell: (quote) => quote.docketNo || '' },
  ];
  const actions = !closed && (
    <>
      <Button disabled={busy} onClick={onLoadCopy}>Copy charges from…</Button>
      <Button variant="default" disabled={busy} onClick={() => onMakeQuote(null)}><FilePlus2 /> Make quotation</Button>
    </>
  );
  return (
    <FormSection title="Quotations" actions={actions}>
      {quotes.length === 0
        ? <Muted className="tw:text-entry">No quotation yet. Save the enquiry, then "Make quotation".</Muted>
        : <DataTable columns={columns} rows={quotes} onRowClick={(quote) => onOpenQuote(quote.id)} />}
      {copyFrom && (
        <div className="tw:mt-2 tw:max-h-[220px] tw:overflow-auto tw:rounded-md tw:border tw:border-border">
          {copyFrom.length === 0 ? <Muted className="tw:p-2 tw:text-entry">No other quotation to copy from.</Muted> : copyFrom.map((quote) => (
            <Button key={quote.id} variant="ghost" size="block" className="tw:flex-wrap tw:gap-2 tw:rounded-none tw:border-b tw:border-b-border/60" onClick={() => onMakeQuote(quote.id)}>
              <b>{quote.quoteNo}</b>
              <span>{quote.clientName}</span>
              <span className="tw:text-muted-foreground">{quote.serviceLabel}, {[quote.origin, quote.destination].filter(Boolean).join(' > ')}</span>
              <span className="tw:ml-auto">{crore(quote.totalSellInr)}</span>
            </Button>
          ))}
        </div>
      )}
    </FormSection>
  );
}

const CLOSE_AS = [{ value: 'LOST', label: 'Lost (went elsewhere)' }, { value: 'DROPPED', label: 'Dropped (no shipment)' }];

export function CloseEnquiryModal({ enquiryNo, closing, meta, onChange, onCancel, onClose }) {
  const footer = (
    <>
      <Button onClick={onCancel}>Cancel</Button>
      <Button variant="destructive" onClick={onClose}>Close as {closing.status === 'LOST' ? 'lost' : 'dropped'}</Button>
    </>
  );
  return (
    <Modal open title={`Close enquiry ${enquiryNo}`} onClose={onCancel} width={460} footer={footer}>
      <div className={FORM_GRID.wide}>
        <FormField label="Closed as"><SelectBox value={closing.status} onValueChange={(status) => onChange({ ...closing, status })} options={CLOSE_AS} /></FormField>
        <FormField label="Reason" required>
          <SelectBox clearable clearLabel="- pick -" placeholder="- pick -" value={closing.reason} onValueChange={(reason) => onChange({ ...closing, reason })} options={lostReasons(meta)} />
        </FormField>
        {closing.status === 'LOST' && (
          <FormField label="Lost to (competitor)"><Input value={closing.lostTo || ''} onChange={(event) => onChange({ ...closing, lostTo: event.target.value })} /></FormField>
        )}
      </div>
      <Muted className="tw:mt-1.5">Open quotations of this enquiry are marked lost too.</Muted>
    </Modal>
  );
}
