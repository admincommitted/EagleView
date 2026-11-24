import React, { useEffect, useState } from 'react';
import { Search, Printer, FileSpreadsheet } from 'lucide-react';
import AirExportActionTabs from './AirExportActionTabs';
import { exportRowsToExcel } from './awbExcel';

// Air Export Tonnage report (29-Oct-2026) - GET /api/reports/tonnage. Replaces the sample figures on Reports → Tonnage.
const pad = (x) => String(x).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const n1 = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const GROUPS = [['airline', 'Airline'], ['agent', 'IATA agent (forwarder)'], ['destination', 'Destination'], ['origin', 'Origin'], ['customer', 'Customer (shipper)'], ['month', 'Month'], ['day', 'Day']];
const lab = { display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' };
const inp = { padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', height: '26px', width: '100%', boxSizing: 'border-box', background: '#fff' };
const th = { padding: '6px 8px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '5px 8px', fontSize: '12px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
const btn = { display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '5px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer' };

export default function TonnageReport({ embedded = false }) {
  const now = new Date();
  const [f, setF] = useState({ from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now), groupBy: 'airline', dateBasis: 'AWB', airline: '', agent: '', type: 'ALL' });
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [airlines, setAirlines] = useState([]);
  const [agents, setAgents] = useState([]);
  const [showRows, setShowRows] = useState(false);

  useEffect(() => { fetch('/api/reports/awb-agents').then((r) => r.json()).then((j) => setAgents(j && Array.isArray(j.agents) ? j.agents : [])).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/masters/airlines?all=1').then((r) => r.json()).then((a) => setAirlines(Array.isArray(a) ? a.filter((x) => x.prefix) : [])).catch(() => {}); }, []);
  const run = async (filters = f) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/reports/tonnage?${new URLSearchParams(filters)}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Could not load');
      setD(j);
    } catch (e) { setErr(e.message); setD(null); } finally { setLoading(false); }
  };
  useEffect(() => { run(); }, []); // eslint-disable-line
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const quick = (from, to) => { const nf = { ...f, from: ymd(from), to: ymd(to) }; setF(nf); run(nf); };
  const groupName = (GROUPS.find((g) => g[0] === (d ? d.groupBy : f.groupBy)) || [])[1];

  const excel = () => {
    if (!d) return;
    exportRowsToExcel(`Tonnage_${d.groupBy}_${d.from}_${d.to}`, 'Tonnage', [['label', groupName], ['docs', d.groupBy === 'customer' ? 'Shipments' : 'AWBs'], ['pieces', 'Pieces'], ['grossWeight', 'Gross Wt (kg)'], ['chargeableWeight', 'Chargeable Wt (kg)'], ['volume', 'Volume (CBM)'], ['share', 'Share %']],
      [...d.groups, { label: 'TOTAL', ...d.totals, share: 100 }]);
  };
  const excelRows = () => d && exportRowsToExcel(`Tonnage_detail_${d.from}_${d.to}`, 'AWBs', [['day', 'Date'], ['agent', 'IATA agent'], ['kind', 'Type'], ['no', 'AWB / MAWB'], ['hawb', 'HAWB'], ['customer', 'Shipper'], ['origin', 'Origin'], ['destination', 'Destination'], ['flight', 'Flight'], ['pieces', 'Pieces'], ['gross', 'Gross Wt'], ['chargeable', 'Chargeable Wt'], ['group', groupName]], d.rows);
  const print = () => {
    if (!d) return;
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = d.groups.map((g) => `<tr><td>${esc(g.label)}</td><td class=r>${g.docs}</td><td class=r>${g.pieces}</td><td class=r>${n1(g.grossWeight)}</td><td class=r>${n1(g.chargeableWeight)}</td><td class=r>${g.share}%</td></tr>`).join('');
    const html = `<!doctype html><html><head><title>Tonnage Report</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:14px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}.r{text-align:right}tfoot td{font-weight:bold;background:#f5f5f5}</style></head><body><h3 style="margin:0">Air Export Tonnage Report - by ${esc(groupName)}</h3><div style="margin:4px 0 8px">${esc(d.from)} to ${esc(d.to)} (${d.dateBasis === 'FLIGHT' ? 'flight date' : 'AWB date'}) · printed ${esc(new Date().toLocaleString())}</div><table><thead><tr><th>${esc(groupName)}</th><th class=r>${d.groupBy === 'customer' ? 'Shipments' : 'AWBs'}</th><th class=r>Pieces</th><th class=r>Gross Wt (kg)</th><th class=r>Chargeable Wt (kg)</th><th class=r>Share</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>TOTAL (${d.totals.tonnes} tonnes chargeable)</td><td class=r>${d.totals.docs}</td><td class=r>${d.totals.pieces}</td><td class=r>${n1(d.totals.grossWeight)}</td><td class=r>${n1(d.totals.chargeableWeight)}</td><td class=r>100%</td></tr></tfoot></table></body></html>`;
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } finally { setTimeout(() => fr.remove(), 1000); } }, 300);
  };
  const maxCw = d ? Math.max(1, ...d.groups.map((g) => g.chargeableWeight)) : 1;
  const today = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {!embedded && <AirExportActionTabs activeTab="" />}
      <div style={{ padding: embedded ? 0 : '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '14px', marginRight: 'auto' }}>TONNAGE REPORT - AIR EXPORT</b>
            <button onClick={() => run()} style={{ ...btn, background: '#3b82f6' }}><Search size={13} /> SHOW</button>
            <button onClick={print} disabled={!d} style={{ ...btn, background: '#0f766e', opacity: d ? 1 : 0.5 }}><Printer size={13} /> PRINT</button>
            <button onClick={excel} disabled={!d} style={{ ...btn, background: '#15803d', opacity: d ? 1 : 0.5 }}><FileSpreadsheet size={13} /> EXCEL</button>
          </div>
          <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px 10px', alignItems: 'end' }}>
            <div><span style={lab}>From</span><input type="date" value={f.from} onChange={set('from')} style={inp} /></div>
            <div><span style={lab}>To</span><input type="date" value={f.to} onChange={set('to')} style={inp} /></div>
            <div><span style={lab}>Date is</span><select value={f.dateBasis} onChange={set('dateBasis')} style={inp}><option value="AWB">AWB date</option><option value="FLIGHT">Flight date</option></select></div>
            <div><span style={lab}>Group by</span><select value={f.groupBy} onChange={(e) => { const nf = { ...f, groupBy: e.target.value }; setF(nf); run(nf); }} style={inp}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><span style={lab}>Airline</span><select value={f.airline} onChange={set('airline')} style={inp}><option value="">All airlines</option>{airlines.map((a) => <option key={a.id} value={a.prefix}>{a.prefix} {a.code2} {a.name}</option>)}</select></div>
            <div><span style={lab}>IATA agent</span><select value={f.agent} onChange={set('agent')} style={inp}><option value="">All agents</option>{agents.map((a) => <option key={(a.iataCode || '') + a.name} value={a.iataCode || a.name}>{a.name || '(no name)'}{a.iataCode ? ` (${a.iataCode})` : ''}{a.inMaster ? '' : ' - on AWB only'}</option>)}</select></div>
            <div><span style={lab}>AWB type</span><select value={f.type} onChange={set('type')} style={inp}><option value="ALL">Direct + MAWB</option><option value="AWB">Direct AWB</option><option value="MAWB">MAWB</option></select></div>
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[['This month', new Date(today.getFullYear(), today.getMonth(), 1), today], ['Last month', new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)], ['This FY', new Date(today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1, 3, 1), today]].map(([l, a, b]) => (
                <button key={l} onClick={() => quick(a, b)} style={{ border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: '12px', padding: '2px 10px', fontSize: '11px', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          {err && <div style={{ padding: '10px 12px', color: '#dc2626', fontSize: '12px' }}>{err}</div>}
          {loading && <div style={{ padding: '10px 12px', fontSize: '12px', color: '#64748b' }}>Loading...</div>}
          {d && !loading && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', padding: '10px 12px' }}>
                {[[d.groupBy === 'customer' ? 'Shipments' : 'AWBs', d.totals.docs], ['Pieces', d.totals.pieces], ['Gross weight', `${n1(d.totals.grossWeight)} kg`], ['Chargeable weight', `${n1(d.totals.chargeableWeight)} kg`], ['Chargeable tonnes', d.totals.tonnes]].map(([l, v]) => (
                  <div key={l} style={{ background: '#f8fafc', borderRadius: '6px', padding: '8px 10px' }}><div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: '18px', fontWeight: 900 }}>{v}</div></div>
                ))}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}>{groupName}</th><th style={{ ...th, textAlign: 'right' }}>{d.groupBy === 'customer' ? 'Shipments' : 'AWBs'}</th><th style={{ ...th, textAlign: 'right' }}>Pieces</th><th style={{ ...th, textAlign: 'right' }}>Gross wt (kg)</th><th style={{ ...th, textAlign: 'right' }}>Chargeable wt (kg)</th><th style={{ ...th, width: '30%' }}>Share</th></tr></thead>
                  <tbody>
                    {d.groups.map((g) => (
                      <tr key={g.key}>
                        <td style={{ ...td, fontWeight: 700 }}>{g.label}</td><td style={{ ...td, textAlign: 'right' }}>{g.docs}</td><td style={{ ...td, textAlign: 'right' }}>{g.pieces}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{n1(g.grossWeight)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{n1(g.chargeableWeight)}</td>
                        <td style={td}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ flex: 1, background: '#eef2f7', height: '8px', borderRadius: '4px' }}><div style={{ width: `${(g.chargeableWeight / maxCw) * 100}%`, height: '100%', background: '#2563eb', borderRadius: '4px' }} /></div><span style={{ width: '44px', textAlign: 'right' }}>{g.share}%</span></div></td>
                      </tr>
                    ))}
                    {!d.groups.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b' }}>No AWB in this period.</td></tr>}
                  </tbody>
                  {d.groups.length > 0 && <tfoot><tr style={{ background: '#f1f5f9', fontWeight: 800 }}><td style={td}>TOTAL</td><td style={{ ...td, textAlign: 'right' }}>{d.totals.docs}</td><td style={{ ...td, textAlign: 'right' }}>{d.totals.pieces}</td><td style={{ ...td, textAlign: 'right' }}>{n1(d.totals.grossWeight)}</td><td style={{ ...td, textAlign: 'right' }}>{n1(d.totals.chargeableWeight)}</td><td style={td}>100%</td></tr></tfoot>}
                </table>
              </div>
              <div style={{ padding: '8px 12px', fontSize: '11px', color: '#64748b', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span>Counted: live direct AWBs and MAWBs (VOID left out). "Customer" counts direct AWBs and the houses of each MAWB. Chargeable weight from the rate lines.</span>
                <button onClick={() => setShowRows((s) => !s)} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>{showRows ? 'Hide' : 'Show'} AWB list ({d.rows.length})</button>
                <button onClick={excelRows} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}>Excel of AWB list</button>
              </div>
              {showRows && (
                <div style={{ overflowX: 'auto', maxHeight: '360px', borderTop: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}><tr>{['Date', 'Type', 'AWB / MAWB', 'HAWB', 'Shipper', 'Route', 'Flight', 'Pcs', 'Gross', 'Chargeable'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>{d.rows.map((r, i) => <tr key={i}><td style={td}>{r.day}</td><td style={td}>{r.kind}</td><td style={td}>{r.no}</td><td style={td}>{r.hawb}</td><td style={td}>{r.customer}</td><td style={td}>{r.origin} → {r.destination}</td><td style={td}>{r.flight}</td><td style={{ ...td, textAlign: 'right' }}>{r.pieces}</td><td style={{ ...td, textAlign: 'right' }}>{n1(r.gross)}</td><td style={{ ...td, textAlign: 'right' }}>{n1(r.chargeable)}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
