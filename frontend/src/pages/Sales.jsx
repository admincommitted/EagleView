// Sales (logistics / freight forwarding): customers and prospects with KAM, contacts and lanes; the sales team; the pick
// lists (11-Nov-2026). 14-Nov-2026: Enquiries and Quotations (Step 2 / 3) replace the old Sales CRM tab (its screen is
// still at /sales-crm; it reads the same tables).
import React from 'react';
import toast from 'react-hot-toast';
import { Building2, Users, ListChecks, FileText, LayoutDashboard, Inbox } from 'lucide-react';
import { api, C, TONE } from './SalesParts/salesUi';
import CustomersTab from './SalesParts/CustomersTab';
import PersonsTab from './SalesParts/PersonsTab';
import ListsTab from './SalesParts/ListsTab';
import DashboardTab from './SalesParts/DashboardTab';
import EnquiriesTab from './SalesParts/EnquiriesTab';
import QuotesTab from './SalesParts/QuotesTab';

const TABS = [['dashboard', 'Dashboard', LayoutDashboard], ['enquiries', 'Enquiries', Inbox], ['quotes', 'Quotations', FileText], ['customers', 'Customers & prospects', Building2], ['persons', 'Sales persons', Users], ['lists', 'Lists', ListChecks]];

export default function Sales() {
  const [tab, setTab] = React.useState(() => { try { const t = localStorage.getItem('sales.tab'); return TABS.some(x => x[0] === t) ? t : 'dashboard'; } catch (e) { return 'dashboard'; } });
  const [meta, setMeta] = React.useState(null);
  const [deal, setDeal] = React.useState(null); // enquiry / quotation lists (statuses, charges, currencies, terms)
  const [qStatus, setQStatus] = React.useState('');
  const [err, setErr] = React.useState({ meta: '', deal: '' }); // a failed load shows its reason and Retry, not "Loading…" for ever
  const reloadMeta = React.useCallback(async () => {
    try { setMeta(await api('/meta')); setErr(o => ({ ...o, meta: '' })); } catch (e) { toast.error(e.message); setErr(o => ({ ...o, meta: e.message || 'Could not load' })); }
  }, []);
  const loadDeal = React.useCallback(async () => {
    setErr(o => ({ ...o, deal: '' }));
    try { setDeal(await api('/deal-meta')); } catch (e) { toast.error(e.message); setErr(o => ({ ...o, deal: e.message || 'Could not load' })); }
  }, []);
  React.useEffect(() => { reloadMeta(); loadDeal(); }, [reloadMeta, loadDeal]);
  const failed = !meta ? err.meta : (['enquiries', 'quotes'].includes(tab) && !deal ? err.deal : '');
  const retry = () => { if (!meta) { setErr(o => ({ ...o, meta: '' })); reloadMeta(); } if (!deal) loadDeal(); };
  const go = (t, status) => { setTab(t); if (t === 'quotes') setQStatus(status || ''); try { localStorage.setItem('sales.tab', t); } catch (e) { /* ignore */ } };
  return (
    <div style={{ padding: '12px 16px', background: C.soft, minHeight: 'calc(100vh - 60px)' }}>
      <style>{'@media (max-width: 900px) { .sales-dash-row { grid-template-columns: 1fr !important; } }'
        + '.sales-kpi-click { transition: transform .15s ease, box-shadow .15s ease; } .sales-kpi-click:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(15,23,42,.10), 0 4px 6px -4px rgba(15,23,42,.08) !important; }'
        + '.sales-kpi-click:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; } @media (prefers-reduced-motion: reduce) { .sales-kpi-click { transition: none; } .sales-kpi-click:hover { transform: none; } }'}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.ink }}>Sales</h2>
        {meta && <span style={{ fontSize: '11.5px', fontWeight: 700, color: TONE.blue[0], background: TONE.blue[1], borderRadius: '12px', padding: '2px 10px' }}>{meta.me ? `${meta.me.name} (${String(meta.me.role || '').toLowerCase()})` : meta.isAdmin ? 'Admin' : ''}</span>}
      </div>
      <div role="tablist" style={{ display: 'flex', gap: '2px', borderBottom: '1px solid ' + C.line, marginBottom: '12px', flexWrap: 'wrap' }}>
        {TABS.filter(([k]) => !meta || meta.canManage || !['persons', 'lists'].includes(k)).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => go(k)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 700, border: 'none', cursor: 'pointer',
              background: tab === k ? TONE.blue[1] : 'none', borderRadius: '8px 8px 0 0',
              color: tab === k ? TONE.blue[0] : C.grey, borderBottom: '3px solid ' + (tab === k ? TONE.blue[0] : 'transparent'), marginBottom: '-1px' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {failed ? (
        <div role="alert" style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '6px', padding: '12px 14px', fontSize: '12.5px', color: C.ink, maxWidth: '720px' }}>
          <div style={{ fontWeight: 700, color: C.red, marginBottom: '4px' }}>This screen could not load.</div>
          <div style={{ marginBottom: '6px' }}>{failed}</div>
          {/not found|restart the backend|failed to fetch|network/i.test(failed) && <div style={{ color: C.mute, marginBottom: '8px' }}>Restart the EDI backend (it loads the new Sales screens on start), then click Retry.</div>}
          <button type="button" onClick={retry} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: '1px solid ' + C.accent, color: C.accent, background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
        </div>)
        : !meta || (['enquiries', 'quotes'].includes(tab) && !deal) ? <div style={{ color: C.mute, fontSize: '12px' }}>Loading…</div>
        : tab === 'dashboard' ? <DashboardTab meta={meta} reloadMeta={reloadMeta} goTab={go} />
        : tab === 'enquiries' ? <EnquiriesTab meta={meta} deal={deal} goTab={go} />
        : tab === 'quotes' ? <QuotesTab meta={meta} deal={deal} initialStatus={qStatus} />
        : tab === 'customers' ? <CustomersTab meta={meta} reloadMeta={reloadMeta} />
        : tab === 'persons' ? <PersonsTab meta={meta} reloadMeta={reloadMeta} />
        : <ListsTab meta={meta} reloadMeta={reloadMeta} />}
    </div>
  );
}
