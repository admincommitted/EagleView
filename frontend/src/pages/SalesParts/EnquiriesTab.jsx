// Sales > Enquiries: every RFQ with its status (Open > Quoted > Won / Lost / Dropped), the pipeline figures on top, and the
// enquiry form (customer / prospect, service, lane, cargo) from which quotations are made. 14-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Plus, Search, RefreshCw, Inbox, Send, Hourglass, Trophy, Target, ClipboardCheck } from 'lucide-react';
import { api, C, crore, dmy, inp, btn, th, td, Chip, KpiCard, TONE } from './salesUi';
import EnquiryForm from './EnquiryForm';
import QuoteForm from './QuoteForm';

export const ENQ_STYLE = { OPEN: [C.accentBg, C.accent], QUOTED: [C.amberBg, C.amber], WON: [C.greenBg, C.green], LOST: [C.redBg, C.red], DROPPED: [C.greyBg, C.grey] };
export const QT_STYLE = { DRAFT: [C.greyBg, C.grey], SENT: [C.accentBg, C.accent], WON: [C.greenBg, C.green], LOST: [C.redBg, C.red], SUPERSEDED: [C.greyBg, C.mute] };
export const DealChip = ({ status, map, labels }) => { const s = map[status] || [C.greyBg, C.grey]; return <Chip text={(labels && labels[status]) || status} bg={s[0]} fg={s[1]} />; };

function Stat({ label, value, sub, tone, icon, onClick, alert }) {
  return <KpiCard compact label={label} value={value} icon={icon} tone={tone} onClick={onClick} valueColor={alert ? TONE[tone][0] : undefined}>{sub && <span>{sub}</span>}</KpiCard>;
}

export default function EnquiriesTab({ meta, deal, goTab }) {
  const [f, setF] = React.useState({ q: '', status: '', spId: '', service: '' });
  const [rows, setRows] = React.useState([]);
  const [sum, setSum] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(null); // enquiry id or 'new'
  const [quote, setQuote] = React.useState(null); // quote id
  const load = React.useCallback(async (ff = f) => {
    setLoading(true);
    try {
      const p = new URLSearchParams(); Object.entries(ff).forEach(([k, v]) => { if (v) p.set(k, v); });
      const [d, s] = await Promise.all([api('/enquiries?' + p.toString()), api('/deals/summary')]);
      setRows(d.data || []); setSum(s.data);
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [f]);
  React.useEffect(() => { load(); }, []); // eslint-disable-line
  const setFilter = (k, v) => { const n = { ...f, [k]: v }; setF(n); if (k !== 'q') load(n); };
  const persons = (meta.persons || []).filter(p => p.isActive !== 0);
  const labels = Object.fromEntries((deal.enquiryStatus || []).map(s => [s[0], s[1]]));
  const sel = { ...inp, width: 'auto', minWidth: '130px' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sum && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <Stat label="Open enquiries" value={sum.openEnquiries} sub={sum.lateEnquiries ? `${sum.lateEnquiries} past "quote by"` : 'to be quoted'} icon={Inbox} tone={sum.lateEnquiries ? 'red' : 'blue'} alert={!!sum.lateEnquiries} onClick={() => setFilter('status', 'OPEN')} />
        <Stat label="Quotations sent" value={sum.sentQuotes} sub={`${crore(sum.sentValue)} awaiting reply`} icon={Send} tone="violet" onClick={() => goTab('quotes', 'SENT')} />
        <Stat label="Expiring / expired" value={`${sum.expiringQuotes} / ${sum.expiredQuotes}`} sub="in 7 days / past validity" icon={Hourglass} tone="amber" alert={!!sum.expiredQuotes} onClick={() => goTab('quotes', 'EXPIRED')} />
        <Stat label="Won this month" value={sum.wonMonth} sub={`${crore(sum.wonMonthValue)} · margin ${crore(sum.wonMonthMargin)}`} icon={Trophy} tone="green" onClick={() => goTab('quotes', 'WON')} />
        <Stat label="Win rate this FY" value={sum.winRate == null ? '-' : sum.winRate + '%'} sub={`${sum.fyWon} won, ${sum.fyLost} lost`} icon={Target} tone="cyan" />
        {sum.draftQuotes > 0 && <Stat label="Draft quotations" value={sum.draftQuotes} sub="not sent yet" icon={ClipboardCheck} tone="slate" onClick={() => goTab('quotes', 'DRAFT')} />}
      </div>}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: '6px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: C.mute }} />
            <input style={{ ...inp, width: '250px', paddingLeft: '26px' }} placeholder="Enquiry no, customer, place, commodity" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          </div>
          <button type="submit" style={btn()}>Search</button>
        </form>
        <select style={sel} value={f.status} onChange={e => setFilter('status', e.target.value)} aria-label="Enquiry status">
          <option value="">All status</option>{(deal.enquiryStatus || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        <select style={sel} value={f.service} onChange={e => setFilter('service', e.target.value)} aria-label="Service">
          <option value="">All services</option>{(meta.services || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        {persons.length > 1 && <select style={sel} value={f.spId} onChange={e => setFilter('spId', e.target.value)} aria-label="Sales person">
          <option value="">All sales persons</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>}
        <button type="button" style={btn()} onClick={() => load()} title="Refresh"><RefreshCw size={13} /></button>
        <button type="button" style={{ ...btn('primary'), marginLeft: 'auto' }} onClick={() => setOpen('new')}><Plus size={14} /> New enquiry</button>
      </div>
      <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', overflow: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Enquiry', 'Date', 'Customer', 'Service', 'From > To', 'Cargo', 'Sales person', 'Quote by', 'Last quotation', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => setOpen(r.id)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, fontWeight: 600, color: C.accent, whiteSpace: 'nowrap' }}>{r.enquiryNo}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(r.date)}</td>
                <td style={td}>{r.clientName}{r.contactPerson ? <div style={{ fontSize: '11px', color: C.mute }}>{r.contactPerson}</div> : null}</td>
                <td style={td}>{r.serviceLabel}</td>
                <td style={td}>{[r.origin, r.destination].filter(Boolean).join(' > ')}</td>
                <td style={{ ...td, fontSize: '11.5px' }}>{[r.commodity, r.chargeableWt ? r.chargeableWt + ' kg ch.' : r.grossWt ? r.grossWt + ' kg' : '', r.cbm ? r.cbm + ' cbm' : '', r.containers].filter(Boolean).join(' · ')}</td>
                <td style={td}>{r.salesPerson || '-'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: r.late ? C.red : undefined, fontWeight: r.late ? 700 : undefined }}>{dmy(r.quoteBy)}{r.priority === 'HIGH' ? ' ⚑' : ''}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.lastQuoteNo ? <>{r.lastQuoteNo} <span style={{ color: C.mute }}>{crore(r.lastQuoteSell)}{r.lastQuoteMarginPct != null ? ` · ${r.lastQuoteMarginPct}%` : ''}</span></> : <span style={{ color: C.mute }}>none</span>}</td>
                <td style={td}><DealChip status={r.status} map={ENQ_STYLE} labels={labels} />{r.lostReason && ['LOST', 'DROPPED'].includes(r.status) ? <div style={{ fontSize: '11px', color: C.mute }}>{r.lostReason}</div> : null}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} style={{ ...td, textAlign: 'center', color: C.mute, padding: '24px' }}>{loading ? 'Loading…' : 'No enquiries. "New enquiry" records a customer\'s request for rates.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <EnquiryForm id={open === 'new' ? null : open} meta={meta} deal={deal} onClose={() => setOpen(null)} onSaved={(id) => { load(); if (id) setOpen(id); }} openQuote={(qid) => setQuote(qid)} />}
      {quote && <QuoteForm id={quote} meta={meta} deal={deal} onClose={() => { setQuote(null); load(); }} onChanged={() => load()} openQuote={(qid) => setQuote(qid)} />}
    </div>
  );
}
