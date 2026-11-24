// Sales > Customers: every customer and prospect with its KAM, how it is billing (this / last FY, duty kept apart),
// filters, and "Load from books" (profiles for every debtor billed). 11-Nov-2026.
import React from 'react';
import toast from 'react-hot-toast';
import { Plus, Download, RefreshCw, Search } from 'lucide-react';
import { api, C, crore, dmy, inp, btn, th, td, StatusChip, ActivityChip, Chip, Modal } from './salesUi';
import CustomerForm from './CustomerForm';

export default function CustomersTab({ meta, reloadMeta }) {
  const [f, setF] = React.useState({ q: '', status: '', kamId: '', industry: '', segment: '', service: '', activity: '', customerType: '', reviewDue: '', sort: 'billed' });
  const [rows, setRows] = React.useState([]);
  const [info, setInfo] = React.useState({ total: 0, counts: {} });
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(null); // id or 'new'
  const [loadBox, setLoadBox] = React.useState(null);

  const load = React.useCallback(async (ff = f) => {
    setLoading(true);
    try {
      const p = new URLSearchParams(); Object.entries(ff).forEach(([k, v]) => { if (v) p.set(k, v); }); p.set('limit', '2000');
      const d = await api('/customers?' + p.toString());
      setRows(d.data || []); setInfo({ total: d.total, counts: d.counts || {}, fy: d.fy });
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [f]);
  React.useEffect(() => { load(); }, []); // eslint-disable-line
  const setFilter = (k, v) => { const n = { ...f, [k]: v }; setF(n); if (k !== 'q') load(n); };

  const persons = (meta.persons || []).filter(p => p.isActive !== 0);
  const statusLabel = Object.fromEntries((meta.statuses || []).map(s => [s[0], s[1]]));
  const svcLabel = Object.fromEntries((meta.services || []).map(s => [s[0], s[1]]));
  const sel = { ...inp, width: 'auto', minWidth: '130px' };

  const dryLoad = async () => {
    setLoadBox({ busy: true });
    try { const d = await api('/customers/load-from-books', { method: 'POST', body: { dryRun: true } }); setLoadBox({ preview: d }); }
    catch (e) { setLoadBox(null); toast.error(e.message); }
  };
  const doLoad = async () => {
    setLoadBox(b => ({ ...b, busy: true }));
    try { const d = await api('/customers/load-from-books', { method: 'POST', body: {} }); toast.success(`${d.made} customers made, ${d.linked} ledgers linked`); setLoadBox(null); load(); }
    catch (e) { setLoadBox(b => ({ ...b, busy: false })); toast.error(e.message); }
  };
  const fy = info.fy ? `FY ${String(info.fy).slice(2, 4)}-${String(Number(String(info.fy).slice(0, 4)) + 1).slice(2)}` : 'this FY';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} style={{ display: 'flex', gap: '6px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: C.mute }} />
            <input style={{ ...inp, width: '260px', paddingLeft: '26px' }} placeholder="Name, GSTIN, city, contact, mobile" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} />
          </div>
          <button type="submit" style={btn()}>Search</button>
        </form>
        <select style={sel} value={f.status} onChange={e => setFilter('status', e.target.value)} aria-label="Status">
          <option value="">All status</option>{(meta.statuses || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}{info.counts[s[0]] ? ` (${info.counts[s[0]]})` : ''}</option>)}
        </select>
        <select style={sel} value={f.kamId} onChange={e => setFilter('kamId', e.target.value)} aria-label="Sales person">
          <option value="">All sales persons</option><option value="none">No KAM</option>{persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select style={sel} value={f.activity} onChange={e => setFilter('activity', e.target.value)} aria-label="Billing">
          <option value="">Any billing</option><option value="ACTIVE">Billing (60 days)</option><option value="SLOWING">Slowing (61-120 days)</option><option value="DORMANT">Dormant (120+ days)</option><option value="NONE">Not billed</option>
        </select>
        <select style={sel} value={f.segment} onChange={e => setFilter('segment', e.target.value)} aria-label="Segment">
          <option value="">All segments</option>{(meta.segments || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        <select style={sel} value={f.industry} onChange={e => setFilter('industry', e.target.value)} aria-label="Industry">
          <option value="">All industries</option>{((meta.lookups || {}).INDUSTRY || []).filter(x => x.isActive).map(x => <option key={x.id} value={x.value}>{x.value}</option>)}
        </select>
        <select style={sel} value={f.service} onChange={e => setFilter('service', e.target.value)} aria-label="Service">
          <option value="">All services</option>{(meta.services || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        <select style={sel} value={f.customerType} onChange={e => setFilter('customerType', e.target.value)} aria-label="Customer type">
          <option value="">All types</option>{(meta.customerTypes || []).map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}
        </select>
        <label style={{ fontSize: '12px', display: 'flex', gap: '5px', alignItems: 'center' }}><input type="checkbox" checked={f.reviewDue === '1'} onChange={e => setFilter('reviewDue', e.target.checked ? '1' : '')} /> Review due</label>
        <select style={sel} value={f.sort} onChange={e => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="billed">Sort: billed {fy}</option><option value="lastBill">Sort: last bill</option><option value="potential">Sort: potential</option><option value="name">Sort: name</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button type="button" style={btn()} onClick={() => load()} title="Refresh"><RefreshCw size={13} /></button>
          {meta.canManage && <button type="button" style={btn()} onClick={dryLoad}><Download size={13} /> Load from books</button>}
          <button type="button" style={btn('primary')} onClick={() => setOpen('new')}><Plus size={13} /> New customer / prospect</button>
        </div>
      </div>

      <div style={{ fontSize: '12px', color: C.mute }}>{loading ? 'Loading…' : `${info.total} customers${info.total > rows.length ? ` (first ${rows.length} shown)` : ''}. Billed = sales bills less credit notes incl. GST; duty / DO accounts are shown apart.`}</div>
      <div style={{ overflow: 'auto', border: '1px solid ' + C.line, borderRadius: '6px', background: '#fff', maxHeight: 'calc(100vh - 330px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            <th style={th}>Customer</th><th style={th}>Status</th><th style={th}>KAM</th><th style={th}>Segment</th><th style={th}>Industry</th><th style={th}>Branch</th>
            <th style={{ ...th, textAlign: 'right' }}>Billed {fy}</th><th style={{ ...th, textAlign: 'right' }}>Last FY</th><th style={{ ...th, textAlign: 'right' }}>Duty / DO {fy}</th>
            <th style={th}>Last bill</th><th style={th}>Services</th><th style={th}>Next review</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={e => { if (e.key === 'Enter') setOpen(r.id); }} style={{ cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                <td style={{ ...td, maxWidth: '300px' }}>
                  <div style={{ fontWeight: 700, color: C.ink }}>{r.name}</div>
                  <div style={{ fontSize: '10.5px', color: C.mute }}>{[r.city, r.state, r.gstin].filter(Boolean).join(' · ')}{r.ledgers > 1 ? ` · ${r.ledgers} ledgers` : ''}{r.contacts ? ` · ${r.contacts} contact${r.contacts > 1 ? 's' : ''}` : ''}{r.lanes ? ` · ${r.lanes} lane${r.lanes > 1 ? 's' : ''}` : ''}</div>
                </td>
                <td style={td}><StatusChip status={r.status} label={statusLabel[r.status]} /><div style={{ marginTop: '3px' }}><ActivityChip activity={r.activity} last={r.lastBill} /></div></td>
                <td style={td}>{r.kamName || <span style={{ color: C.amber }}>No KAM</span>}</td>
                <td style={td}>{(meta.segments || []).find(s => s[0] === r.segment)?.[1] || ''}</td>
                <td style={td}>{r.industry || ''}</td>
                <td style={td}>{r.branchCode || ''}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{crore(r.billedCy)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: C.grey }}>{crore(r.billedLy)}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: C.grey }}>{r.reimbCy ? crore(r.reimbCy) : ''}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{dmy(r.lastBill)}</td>
                <td style={{ ...td, maxWidth: '180px', fontSize: '11px', color: C.grey }}>{String(r.services || '').split(',').filter(Boolean).map(s => svcLabel[s] || s).join(', ')}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: r.nextReviewDate && r.nextReviewDate <= new Date().toISOString().slice(0, 10) ? C.red : C.ink }}>{dmy(r.nextReviewDate)}</td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td colSpan={12} style={{ ...td, padding: '28px', textAlign: 'center', color: C.mute }}>No customer here. Add one with "New customer / prospect"{meta.canManage ? ', or make profiles for every billed debtor with "Load from books"' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && <CustomerForm id={open === 'new' ? null : open} meta={meta} onClose={() => setOpen(null)} onSaved={(id) => { load(); if (id) setOpen(id); }} reloadMeta={reloadMeta} />}

      {loadBox && (
        <Modal title="Load customers from the books" onClose={() => !loadBox.busy && setLoadBox(null)} width={900}
          footer={loadBox.preview && <>
            <button type="button" style={btn()} disabled={loadBox.busy} onClick={() => setLoadBox(null)}>Cancel</button>
            <button type="button" style={btn('primary')} disabled={loadBox.busy || !(loadBox.preview.made || loadBox.preview.linked)} onClick={doLoad}>{loadBox.busy ? 'Loading…' : `Make ${loadBox.preview.made} customers`}</button>
          </>}>
          {loadBox.busy && !loadBox.preview && <div style={{ fontSize: '12px', color: C.mute }}>Reading the books…</div>}
          {loadBox.preview && (() => { const p = loadBox.preview; return (
            <div style={{ fontSize: '12px' }}>
              <p style={{ marginTop: 0 }}>Every debtor ledger with a sales bill since <b>{dmy(p.since)}</b> gets a sales profile. Ledgers of one customer (same PAN, or the same name with "DUTY A/C", "(IMPORT DUTY ACCOUNT)", "- DO") are put together. Profiles already made are not changed.</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {[['Ledgers billed', p.ledgersBilled], ['New customers', p.made], ['Ledgers linked to existing', p.linked], ['With KAM', p.withKam], ['KAM from debtor group', p.kamFromGroup], ['KAM from dockets', p.kamFromDockets], ['More than one ledger', p.multiLedger], ['Blocked', p.blocked], ['On hold', p.onHold]].map(([k, v]) => (
                  <div key={k} style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '6px', padding: '6px 10px', minWidth: '110px' }}><div style={{ fontSize: '10.5px', color: C.mute }}>{k}</div><div style={{ fontSize: '16px', fontWeight: 800 }}>{v}</div></div>
                ))}
              </div>
              {p.unmatchedNames && p.unmatchedNames.length > 0 && (
                <div style={{ background: C.amberBg, color: C.amber, padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                  These iCAFFE names are not sales persons yet, so their customers get no KAM: {p.unmatchedNames.map(n => `${n.name} (${n.customers})`).join(', ')}. Add them in Sales Persons first (Names found in iCAFFE), then load again.
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead><tr><th style={th}>Customer</th><th style={th}>Ledgers</th><th style={th}>Bills</th><th style={{ ...th, textAlign: 'right' }}>Billed</th><th style={th}>Segment</th><th style={th}>Status</th><th style={th}>KAM</th><th style={th}>Branch</th></tr></thead>
                <tbody>{(p.sample || []).map((s, i) => (
                  <tr key={i}><td style={td}>{s.name}</td><td style={{ ...td, fontSize: '11px' }}>{s.ledgers.join(' + ')}</td><td style={td}>{s.bills}</td><td style={{ ...td, textAlign: 'right' }}>{crore(s.billed)}</td><td style={td}>{s.segment}</td><td style={td}>{s.status}</td><td style={td}>{s.kam}</td><td style={td}>{s.branch}</td></tr>
                ))}</tbody>
              </table>
              <div style={{ color: C.mute, marginTop: '6px' }}>A sample of what will be made. Segment: Key = Rs 25 lakh+ billed or 50+ bills in the period; Regular = 6+ bills; else Occasional.</div>
            </div>
          ); })()}
        </Modal>
      )}
    </div>
  );
}

export { Chip };
