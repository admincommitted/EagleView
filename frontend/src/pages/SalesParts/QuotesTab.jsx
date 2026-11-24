// Sales > Quotations: every quotation (latest revision) with value, margin, validity and status. 14-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Search, RefreshCw } from 'lucide-react';
import { api, C, inr, dmy, inp, btn, th, td } from './salesUi';
import { DealChip, QT_STYLE } from './EnquiriesTab';
import QuoteForm from './QuoteForm';

export default function QuotesTab({ meta, deal, initialStatus }) {
  const [f, setF] = React.useState({ q: '', status: initialStatus || '', spId: '', service: '' });
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(null);
  const load = React.useCallback(async (ff = f) => {
    setLoading(true);
    try { const p = new URLSearchParams(); Object.entries(ff).forEach(([k, v]) => { if (v) p.set(k, v); }); const d = await api('/quotes?' + p.toString()); setRows(d.data || []); }
    catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [f]);
  React.useEffect(() => { const n = { ...f, status: initialStatus || '' }; setF(n); load(n); }, [initialStatus]); // eslint-disable-line
  const setFilter = (k, v) => { const n = { ...f, [k]: v }; setF(n); if (k !== 'q') load(n); };
  const persons = (meta.persons || []).filter(p => p.isActive !== 0);
  const labels = Object.fromEntries((deal.quoteStatus || []).map(s => [s[0], s[1]]));
  const warn = deal.marginWarnPct || 10;
  const sel = { ...inp, width: 'auto', minWidth: '130px' };
  const tot = rows.reduce((a, r) => ({ sell: a.sell + (Number(r.totalSellInr) || 0), m: a.m + (Number(r.marginInr) || 0) }), { sell: 0, m: 0 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: '6px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: C.mute }} />
            <input style={{ ...inp, width: '250px', paddingLeft: '26px' }} placeholder="Quotation no, customer, place, docket" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          </div>
          <button type="submit" style={btn()}>Search</button>
        </form>
        <select style={sel} value={f.status} onChange={e => setFilter('status', e.target.value)} aria-label="Quotation status">
          <option value="">All (latest revisions)</option>{(deal.quoteStatus || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}<option value="EXPIRED">Sent, validity over</option>
        </select>
        <select style={sel} value={f.service} onChange={e => setFilter('service', e.target.value)} aria-label="Service">
          <option value="">All services</option>{(meta.services || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        {persons.length > 1 && <select style={sel} value={f.spId} onChange={e => setFilter('spId', e.target.value)} aria-label="Sales person">
          <option value="">All sales persons</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>}
        <button type="button" style={btn()} onClick={() => load()} title="Refresh"><RefreshCw size={13} /></button>
        <span style={{ marginLeft: 'auto', fontSize: '12px', color: C.mute }}>{rows.length} quotations, value Rs {inr(tot.sell)}, margin Rs {inr(tot.m)}</span>
      </div>
      <div style={{ fontSize: '11.5px', color: C.mute }}>A quotation is made from its enquiry (Enquiries tab).</div>
      <div style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', overflow: 'auto', maxHeight: 'calc(100vh - 290px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Quotation', 'Date', 'Customer', 'Service', 'From > To', 'Sell (Rs)', 'Margin', 'Valid until', 'Sales person', 'Status', 'Docket'].map(h => <th key={h} style={{ ...th, textAlign: ['Sell (Rs)', 'Margin'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} onClick={() => setOpen(r.id)} style={{ cursor: 'pointer' }}>
                <td style={{ ...td, fontWeight: 600, color: C.accent, whiteSpace: 'nowrap' }}>{r.quoteNo}<div style={{ fontSize: '11px', color: C.mute, fontWeight: 400 }}>{r.enquiryNo}</div></td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(r.date)}</td>
                <td style={td}>{r.clientName}</td>
                <td style={td}>{r.serviceLabel}</td>
                <td style={td}>{[r.origin, r.destination].filter(Boolean).join(' > ')}</td>
                <td style={{ ...td, textAlign: 'right' }}>{inr(r.totalSellInr)}</td>
                <td style={{ ...td, textAlign: 'right', color: r.marginPct != null && Number(r.marginPct) < warn ? C.red : C.green, whiteSpace: 'nowrap' }}>{inr(r.marginInr)}<div style={{ fontSize: '11px' }}>{r.marginPct != null ? r.marginPct + '%' : ''}</div></td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: r.expired ? C.red : undefined }}>{dmy(r.validUntil)}{r.expired ? ' (over)' : ''}</td>
                <td style={td}>{r.salesPerson || '-'}</td>
                <td style={td}><DealChip status={r.status} map={QT_STYLE} labels={labels} />{r.status === 'LOST' && r.rejectReason ? <div style={{ fontSize: '11px', color: C.mute }}>{r.rejectReason}</div> : null}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.docketNo || ''}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={11} style={{ ...td, textAlign: 'center', color: C.mute, padding: '24px' }}>{loading ? 'Loading…' : 'No quotations here.'}</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <QuoteForm id={open} meta={meta} deal={deal} onClose={() => { setOpen(null); load(); }} onChanged={() => load()} openQuote={(id) => setOpen(id)} />}
    </div>
  );
}
