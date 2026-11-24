// Report list of Export > Get Report (29-Oct-2026), the same panel as Import > Report: grouped list with search,
// favourites (saved per user), record counts, quick print per report, paper / DRAFT mark, Print, Mail, Excel.
import React from 'react';
import { getParties } from '../../../../../utils/partiesCache'; // shared copy of the party list, 09-Nov-2026
import { Sheet, FileSpreadsheet, FileText, ListChecks, Calculator, Files, Paperclip, Printer, Download, RefreshCw, Search, Star, Mail, Receipt, Tags, BadgePercent, Ship, Container, Landmark, X, Send } from 'lucide-react';

export const REPORTS = [
  { id: 'checklist', group: 'Checklists', name: 'S/B Checklist', sub: 'Shipping Bill checklist with items, SW info and RoDTEP', icon: ListChecks, landscape: false, own: true, main: true },
  { id: 'invoicewise', group: 'Checklists', name: 'Invoice Wise Checklist', sub: 'Each invoice with its items, value and FOB', icon: Receipt, landscape: true, main: true },
  { id: 'rodtep', group: 'Checklists', name: 'RoDTEP Wise Checklist', sub: 'Claim per item with rate, cap and estimate', icon: BadgePercent, landscape: true, main: true },
  { id: 'dbk', group: 'Schemes', name: 'Drawback Particulars', sub: 'DBK Sr No, qty, rate and value per item', icon: Calculator, landscape: true },
  { id: 'licence', group: 'Schemes', name: 'Licence Particulars', sub: 'Registration no / date, Part E / C, quantities', icon: Tags, landscape: true },
  { id: 'ar4', group: 'Schemes', name: 'AR4 Particulars', sub: 'AR4 no, date, commissionerate, division, range', icon: Landmark, landscape: true },
  { id: 'reexport', group: 'Schemes', name: 'Re-Export Particulars', sub: 'Import B/E of each re-exported item', icon: RefreshCw, landscape: true },
  { id: 'invparticulars', group: 'Invoice & Shipment', name: 'Invoice Particulars', sub: 'Values, terms, charges, payment, buyer', icon: Receipt, landscape: true },
  { id: 'annexure', group: 'Invoice & Shipment', name: 'S/B Annexure (Items)', sub: 'Invoice-wise items with FOB, PMV, DBK, RoDTEP and totals', icon: Files, landscape: true },
  { id: 'contannex', group: 'Invoice & Shipment', name: 'Container Annexure', sub: 'Container-wise seals, stuffing and S/B summary', icon: Container, landscape: true },
  { id: 'shipment', group: 'Invoice & Shipment', name: 'Shipment & Containers', sub: 'Weights, packages, marks, containers and seals', icon: Ship, landscape: false },
  { id: 'swinfo', group: 'Documents', name: 'SW Info & Statements', sub: 'Single window info rows and statements per item', icon: Files, landscape: true },
  { id: 'docs', group: 'Documents', name: 'Supporting Documents', sub: 'e-Sanchit documents of the SB and items', icon: Paperclip, landscape: true },
];
const GROUPS = ['Checklists', 'Schemes', 'Invoice & Shipment', 'Documents'];
// favourites are saved per user in the database (/api/user-prefs, 28-Oct-2026); the browser copy is only a fallback
// while the server is not reached, and is moved to the server the first time
const FAV_KEY = 'export_report_favs';
const readFavs = () => { try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const prefApi = async (method, value) => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/user-prefs/' + FAV_KEY, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: method === 'PUT' ? JSON.stringify({ value }) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || d.success === false) throw new Error(d.error || ('HTTP ' + res.status));
  return d;
};
const validIds = (v) => (Array.isArray(v) ? v.filter(id => typeof id === 'string' && REPORTS.some(r => r.id === id)) : []);
const list = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };

export default function ExportReportPanel({ ctx }) {
  const { exportReportExcel, reportType, setReportType, landscape, setLandscape, watermark, setWatermark, onPrint, printReportId, handleExportExcel, onRefresh, jobData, allItems, sendReportMail } = ctx;
  const [q, setQ] = React.useState('');
  const [favs, setFavs] = React.useState(() => validIds(readFavs()));
  const [favSync, setFavSync] = React.useState('loading'); // loading | saved | offline
  React.useEffect(() => {
    let live = true;
    prefApi('GET').then(async d => {
      if (!live) return;
      if (d.saved) { const v = validIds(d.value); setFavs(v); try { localStorage.setItem(FAV_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } }
      else { const local = validIds(readFavs()); if (local.length) await prefApi('PUT', local).catch(() => {}); }
      setFavSync('saved');
    }).catch(() => { if (live) setFavSync('offline'); });
    return () => { live = false; };
  }, []);
  const [mail, setMail] = React.useState(null); // { to, subject, sending }
  const cur = REPORTS.find(r => r.id === reportType) || REPORTS[0];
  const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
  const its = allItems || [];
  const counts = {
    invoicewise: (jobData?.invoices || []).length, invparticulars: (jobData?.invoices || []).length,
    rodtep: its.filter(it => String(it.rodtep || '').toUpperCase() === 'Y' || arr(it.swInfos).some(r => String(r.swInfoField3 || r.code || '').toUpperCase() === 'RODTEPY')).length,
    dbk: (ctx.dbkItems || []).length, licence: (ctx.licenseItems || []).length, ar4: its.filter(it => /^Y/i.test(String(it.ar4 || ''))).length,
    reexport: its.reduce((a, it) => a + arr(it.reExports).length, 0), swinfo: its.reduce((a, it) => a + arr(it.swInfos).length + arr(it.swStatements).length, 0),
    annexure: its.length, contannex: (Array.isArray(jobData?.Containers) && jobData.Containers.length) ? jobData.Containers.length : (ctx.containers || []).length,
    docs: arr(jobData?.eSanchitList).length + its.reduce((a, it) => a + arr(it.eSanchitList).length, 0),
    shipment: (Array.isArray(jobData?.Containers) && jobData.Containers.length ? jobData.Containers : (ctx.containers || [])).length,
  };
  const toggleFav = (id) => {
    const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    setFavs(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
    prefApi('PUT', next).then(() => setFavSync('saved')).catch(e => { setFavSync('offline'); ctx.toastError && ctx.toastError('Favourite not saved to server: ' + e.message); });
  };
  const pick = (r) => { setReportType(r.id); setLandscape(r.landscape); };
  const term = q.trim().toLowerCase();
  const match = (r) => !term || `${r.name} ${r.sub} ${r.group}`.toLowerCase().includes(term);
  const sections = [
    ...(favs.length ? [{ title: favSync === 'offline' ? 'Favourites (not saved to server)' : 'Favourites', items: REPORTS.filter(r => favs.includes(r.id) && match(r)) }] : []),
    ...GROUPS.map(g => ({ title: g, items: REPORTS.filter(r => r.group === g && match(r)) })),
  ].filter(s => s.items.length);

  const openMail = () => {
    const jobNo = jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'DRAFT';
    setMail({ to: '', subject: `${cur.name} - Job ${jobNo}${jobData?.shipperName ? ' - ' + jobData.shipperName : ''}`, sending: false });
    // exporter's e-mail from the Party master, when the job has the exporter party
    const pid = jobData?.shipperId;
    if (pid) getParties().then(d => { const p = (Array.isArray(d) ? d : (d && d.data) || []).find(x => String(x.id) === String(pid)); const e = p && (p.email || (p.branches || []).map(b => b.email1).find(Boolean)); if (e) setMail(m => (m && !m.to ? { ...m, to: e } : m)); }).catch(() => {});
  };
  const send = async () => {
    const to = String(mail.to || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
    if (!to.length || to.some(e => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) return ctx.toastError('Enter valid e-mail address(es), separated by comma');
    setMail(m => ({ ...m, sending: true }));
    const ok = await sendReportMail(to.join(','), mail.subject);
    setMail(ok ? null : (m => ({ ...m, sending: false })));
  };

  const label = { fontSize: '10.5px', fontWeight: 800, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const iconBtn = { background: 'none', border: 'none', padding: '3px', cursor: 'pointer', display: 'flex', borderRadius: '4px', color: 'var(--text-muted, #64748b)' };
  return (
    <div className="no-print" style={{ background: 'var(--bg-panel, #fff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--primary-bg-light, #eff6ff)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontWeight: 800, fontSize: '14px' }}>Reports</div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-panel, #fff)', border: '1px solid var(--border-color, #cbd5e1)' }} title="Job these reports are for">
            Job: {jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'not saved'}
          </span>
        </div>
        <div style={{ position: 'relative', marginTop: '8px' }}>
          <Search size={13} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted, #94a3b8)' }} />
          <input className="input-field" placeholder="Search report..." value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', paddingLeft: '26px', fontSize: '12px', boxSizing: 'border-box' }} aria-label="Search report" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} role="listbox" aria-label="Reports">
        {sections.map(s => (
          <div key={s.title}>
            <div style={{ ...label, padding: '8px 12px 4px' }}>{s.title}</div>
            {s.items.map(r => {
              const Icon = r.icon, on = r.id === cur.id, fav = favs.includes(r.id);
              return (
                <div key={s.title + r.id} role="option" aria-selected={on} tabIndex={0} onClick={() => pick(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } }}
                  className="report-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px 6px 10px', cursor: 'pointer', borderLeft: on ? '3px solid var(--primary-color, #2563eb)' : '3px solid transparent', background: on ? 'var(--primary-bg-light, #eff6ff)' : 'transparent' }}>
                  <Icon size={15} style={{ flexShrink: 0, color: r.main ? '#dc2626' : (on ? 'var(--primary-color, #2563eb)' : 'var(--text-muted, #64748b)') }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: r.main || on ? 700 : 600, color: r.main ? '#b91c1c' : 'var(--primary-color, #1d4ed8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}{r.id in counts && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, padding: '0 6px', borderRadius: '8px', background: counts[r.id] ? '#dbeafe' : '#f1f5f9', color: counts[r.id] ? '#1e40af' : '#94a3b8' }}>{counts[r.id]}</span>}
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>
                  </div>
                  <button type="button" title={fav ? 'Remove from favourites' : 'Add to favourites'} onClick={e => { e.stopPropagation(); toggleFav(r.id); }} style={{ ...iconBtn, color: fav ? '#f59e0b' : iconBtn.color }}><Star size={13} fill={fav ? '#f59e0b' : 'none'} /></button>
                  <button type="button" title={`Print ${r.name}`} onClick={e => { e.stopPropagation(); pick(r); printReportId(r.id); }} style={iconBtn}><Printer size={13} /></button>
                </div>
              );
            })}
          </div>
        ))}
        {sections.length === 0 && <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>No report matches "{q}"</div>}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '12px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={label}>Paper</span>
          {cur.own ? <span style={{ color: 'var(--text-muted, #64748b)' }}>Checklist size</span> : <>
            <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={!landscape} onChange={() => setLandscape(false)} /> Portrait</label>
            <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}><input type="radio" checked={landscape} onChange={() => setLandscape(true)} /> Landscape</label>
          </>}
          <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer', marginLeft: 'auto' }}><input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} /> DRAFT mark</label>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '11px', flex: 1 }} onClick={onPrint}><Printer size={12} /> Print / PDF</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '11px' }} onClick={openMail} title="Send the report shown to an e-mail"><Mail size={12} /> Mail</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '11px' }} onClick={exportReportExcel} title="This report to Excel"><FileSpreadsheet size={12} /> Excel</button>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '11px' }} onClick={handleExportExcel} title="Full S/B checklist in one Excel file"><Download size={12} /></button>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '11px' }} onClick={onRefresh} title="Rebuild the report from the latest job data"><RefreshCw size={12} /></button>
        </div>
        {mail && (
          <div style={{ border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-app, #f8fafc)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: '12px' }}>Send "{cur.name}" by mail</b><button type="button" onClick={() => setMail(null)} style={iconBtn} title="Close"><X size={13} /></button></div>
            <input className="input-field" placeholder="To (comma for more)" value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} style={{ fontSize: '12px' }} />
            <input className="input-field" placeholder="Subject" value={mail.subject} onChange={e => setMail(m => ({ ...m, subject: e.target.value }))} style={{ fontSize: '12px' }} />
            <button type="button" className="btn btn-primary" disabled={mail.sending} onClick={send} style={{ padding: '0.3rem 0.7rem', fontSize: '11px' }}><Send size={12} /> {mail.sending ? 'Sending...' : 'Send'}</button>
          </div>
        )}
      </div>
      <style>{`.report-row:hover { background: var(--bg-app, #f1f5f9) !important; } .report-row:focus-visible { outline: 2px solid var(--primary-color, #2563eb); outline-offset: -2px; }`}</style>
    </div>
  );
}
