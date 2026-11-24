import React, { useEffect, useState } from 'react';
import { Search, Printer, FileSpreadsheet } from 'lucide-react';
import AirExportActionTabs from './AirExportActionTabs';
import { exportRowsToExcel } from './awbExcel';

// CSR statement - Cargo Sales Report per airline for a CASS period (1-15 / 16-end), 29-Oct-2026.
// GET /api/reports/csr, /api/reports/csr-periods (node-backend/utils/awbReports.js)
const m2 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const lab = { display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '2px', textTransform: 'uppercase' };
const inp = { padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', height: '26px', width: '100%', boxSizing: 'border-box', background: '#fff' };
const th = { padding: '5px 6px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap', textAlign: 'right' };
const td = { padding: '4px 6px', fontSize: '11px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', textAlign: 'right' };
const btn = { display: 'flex', alignItems: 'center', gap: '6px', border: 'none', borderRadius: '5px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, color: '#fff', cursor: 'pointer' };
const L = { ...td, textAlign: 'left' };
const LH = { ...th, textAlign: 'left' };

// detail columns (key, header, money?)
const COLS = [['date', 'Date'], ['awbNumber', 'AWB No'], ['destination', 'Dest'], ['ppcc', 'P/C'], ['pieces', 'Pcs'], ['chargeableWeight', 'Chg Wt'], ['rate', 'Rate', 1], ['weightPP', 'Wt Chg PP', 1], ['weightCC', 'Wt Chg CC', 1], ['valuationPP', 'Val PP', 1], ['taxPP', 'Tax PP', 1], ['dueCarrierPP', 'Due Carr PP', 1], ['dueCarrierCC', 'Due Carr CC', 1], ['dueAgentPP', 'Due Agt PP', 1], ['dueAgentCC', 'Due Agt CC', 1], ['commission', 'Commission', 1], ['payable', 'Payable', 1], ['receivable', 'Receivable', 1], ['net', 'Net to Airline', 1]];
const val = (r, k) => (k === 'commission' ? (r.commissionPP || 0) + (r.commissionCC || 0) : r[k]);

export default function CsrStatement() {
  const [periods, setPeriods] = useState([]);
  const [airlines, setAirlines] = useState([]);
  const [f, setF] = useState({ period: '', airline: 'ALL', agent: 'ALL' });
  const [agents, setAgents] = useState([]);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/reports/csr-periods').then((r) => r.json()).then((j) => { if (j.success) { setPeriods(j.periods); setF((p) => ({ ...p, period: p.period || (j.periods[1] || j.periods[0]).period })); } }).catch(() => {});
    fetch('/api/masters/airlines?all=1').then((r) => r.json()).then((a) => setAirlines(Array.isArray(a) ? a.filter((x) => x.prefix) : [])).catch(() => {});
    fetch('/api/reports/awb-agents').then((r) => r.json()).then((j) => setAgents(j && Array.isArray(j.agents) ? j.agents : [])).catch(() => {});
  }, []);
  const run = async (filters = f) => {
    if (!filters.period) return;
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/reports/csr?${new URLSearchParams(filters)}`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Could not load');
      setD(j);
    } catch (e) { setErr(e.message); setD(null); } finally { setLoading(false); }
  };
  useEffect(() => { if (f.period) run(f); }, [f.period]); // eslint-disable-line

  // one statement per IATA agent code + airline + currency
  const byAirline = d ? d.airlineSummary.map((s) => ({ ...s, items: d.items.filter((i) => i.agentKey === s.agentKey && i.airlinePrefix === s.airlinePrefix && i.currency === s.currency) })) : [];

  const excel = () => {
    if (!d) return;
    exportRowsToExcel(`CSR_${d.airline}_${d.from}_${d.to}`, `CSR ${d.label}`,
      [['agent', 'IATA Agent'], ['agentCode', 'IATA Code'], ['airline', 'Airline'], ['airlinePrefix', 'Prefix'], ['currency', 'Cur'], ...COLS.map(([k, h]) => [k, h, (r) => val(r, k)]), ['shipper', 'Shipper'], ['flight', 'Flight'], ['commRate', 'Comm %']],
      d.items);
  };
  const print = () => {
    if (!d) return;
    const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const sec = byAirline.map((s) => `<h3>${esc(s.agent)} · ${esc(s.airlinePrefix)} ${esc(s.airline)} - ${esc(s.currency)} <small>(commission ${s.commType === 'NET' ? 'NET - none' : s.commRate + '% of weight charge'})</small></h3>
      <table><thead><tr>${COLS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${s.items.map((r) => `<tr>${COLS.map(([k, , m]) => `<td class="${m ? 'r' : ''}">${esc(m ? m2(val(r, k)) : r[k])}</td>`).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td colspan=4>TOTAL ${s.awbs} AWB</td><td>${s.pieces}</td><td>${n1(s.chargeableWeight)}</td><td></td>${['weightPP', 'weightCC', 'valuationPP', 'taxPP', 'dueCarrierPP', 'dueCarrierCC', 'dueAgentPP', 'dueAgentCC'].map((k) => `<td class=r>${m2(s[k])}</td>`).join('')}<td class=r>${m2(s.commissionPP + s.commissionCC)}</td><td class=r>${m2(s.payable)}</td><td class=r>${m2(s.receivable)}</td><td class=r><b>${m2(s.net)}</b></td></tr></tfoot></table>
      <div class=net>${s.net >= 0 ? 'Payable to airline' : 'Receivable from airline'}: <b>${esc(s.currency)} ${m2(Math.abs(s.net))}</b></div>`).join('');
    const html = `<!doctype html><html><head><title>CSR ${esc(d.label)}</title><style>body{font-family:Arial,sans-serif;font-size:9px;margin:10px}h2{margin:0}h3{margin:14px 0 4px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:2px 4px}th{background:#eee}.r{text-align:right}tfoot td{font-weight:bold;background:#f5f5f5}.net{margin-top:4px;font-size:11px}@page{size:landscape;margin:8mm}</style></head><body><h2>Cargo Sales Report (CSR)</h2><div>Period ${esc(d.label)} (${esc(d.from)} to ${esc(d.to)}) · Airline ${esc(d.airline)} · Agent ${esc(d.agent || 'ALL')} · printed ${esc(new Date().toLocaleString())}</div>${sec || '<p>No AWB in this period.</p>'}<p style="margin-top:12px;color:#555">Figures are from the AWBs saved in the system. Check against the airline / CASS billing before payment.</p></body></html>`;
    const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;width:0;height:0;border:0'; document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } finally { setTimeout(() => fr.remove(), 1000); } }, 300);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <AirExportActionTabs activeTab="" />
      <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <b style={{ fontSize: '14px', marginRight: 'auto' }}>CSR STATEMENT (CARGO SALES REPORT)</b>
            <button onClick={() => run()} style={{ ...btn, background: '#3b82f6' }}><Search size={13} /> SHOW</button>
            <button onClick={print} disabled={!d} style={{ ...btn, background: '#0f766e', opacity: d ? 1 : 0.5 }}><Printer size={13} /> PRINT</button>
            <button onClick={excel} disabled={!d} style={{ ...btn, background: '#15803d', opacity: d ? 1 : 0.5 }}><FileSpreadsheet size={13} /> EXCEL</button>
          </div>
          <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px 10px' }}>
            <div><span style={lab}>CASS period</span><select value={f.period} onChange={(e) => setF((p) => ({ ...p, period: e.target.value }))} style={inp}>{periods.map((p) => <option key={p.period} value={p.period}>{p.label}</option>)}</select></div>
            <div><span style={lab}>Airline</span><select value={f.airline} onChange={(e) => { const nf = { ...f, airline: e.target.value }; setF(nf); run(nf); }} style={inp}><option value="ALL">All airlines</option>{airlines.map((a) => <option key={a.id} value={a.prefix}>{a.prefix} {a.code2} {a.name}</option>)}</select></div>
            <div><span style={lab}>IATA agent (forwarder)</span><select value={f.agent} onChange={(e) => { const nf = { ...f, agent: e.target.value }; setF(nf); run(nf); }} style={inp}><option value="ALL">All agents</option>{agents.map((a) => <option key={(a.iataCode || '') + a.name} value={a.iataCode || a.name}>{a.name || '(no name)'}{a.iataCode ? ` (${a.iataCode})` : ''}{a.inMaster ? '' : ' - on AWB only'}</option>)}</select></div>
          </div>
        </div>

        {err && <div style={{ color: '#dc2626', fontSize: '12px' }}>{err}</div>}
        {loading && <div style={{ fontSize: '12px', color: '#64748b' }}>Loading...</div>}
        {d && !loading && (
          <>
            <div style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflowX: 'auto' }}>
              <div style={{ padding: '6px 12px', fontWeight: 800, fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>SUMMARY - {d.label}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={LH}>IATA Agent</th><th style={LH}>Airline</th><th style={LH}>Cur</th><th style={th}>AWBs</th><th style={th}>Chg Wt</th><th style={th}>Wt Chg PP</th><th style={th}>Wt Chg CC</th><th style={th}>Due Carrier</th><th style={th}>Due Agent</th><th style={th}>Commission</th><th style={th}>Payable</th><th style={th}>Receivable</th><th style={th}>Net</th></tr></thead>
                <tbody>
                  {d.airlineSummary.map((s) => (
                    <tr key={s.agentKey + s.airlinePrefix + s.currency}>
                      <td style={L}>{s.agent}</td>
                      <td style={{ ...L, fontWeight: 700 }}>{s.airlinePrefix} {s.airline} <span style={{ color: '#64748b', fontWeight: 400 }}>({s.commType === 'NET' ? 'NET' : `${s.commRate}%`})</span></td><td style={L}>{s.currency}</td>
                      <td style={td}>{s.awbs}</td><td style={td}>{n1(s.chargeableWeight)}</td><td style={td}>{m2(s.weightPP)}</td><td style={td}>{m2(s.weightCC)}</td>
                      <td style={td}>{m2(s.dueCarrierPP + s.dueCarrierCC)}</td><td style={td}>{m2(s.dueAgentPP + s.dueAgentCC)}</td><td style={td}>{m2(s.commissionPP + s.commissionCC)}</td>
                      <td style={td}>{m2(s.payable)}</td><td style={td}>{m2(s.receivable)}</td>
                      <td style={{ ...td, fontWeight: 800, color: s.net >= 0 ? '#b91c1c' : '#15803d' }} title={s.net >= 0 ? 'Payable to airline' : 'Receivable from airline'}>{m2(s.net)}</td>
                    </tr>
                  ))}
                  {!d.airlineSummary.length && <tr><td colSpan={13} style={{ ...L, textAlign: 'center', color: '#64748b' }}>No AWB in this period.</td></tr>}
                </tbody>
              </table>
              <div style={{ padding: '6px 12px', fontSize: '11px', color: '#64748b' }}>
                Net = payable (PP weight charge + valuation + tax + due carrier − commission on PP) − receivable (CC due agent + commission on CC). <b style={{ color: '#b91c1c' }}>Red</b> = pay the airline, <b style={{ color: '#15803d' }}>green</b> = airline owes you.
                Commission % and NET / GROSS come from Masters → Airline. AWB date = execution date on the AWB (else flight date). Check against the airline / CASS billing before payment.
              </div>
            </div>

            {byAirline.map((s) => (
              <div key={s.agentKey + s.airlinePrefix + s.currency} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', overflowX: 'auto' }}>
                <div style={{ padding: '6px 12px', fontWeight: 800, fontSize: '12px', borderBottom: '1px solid #e2e8f0' }}>{s.agent} · {s.airlinePrefix} {s.airline} - {s.currency} · {s.awbs} AWB</div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{COLS.map(([k, h]) => <th key={k} style={['date', 'awbNumber', 'destination', 'ppcc'].includes(k) ? LH : th}>{h}</th>)}</tr></thead>
                  <tbody>{s.items.map((r) => <tr key={r.id}>{COLS.map(([k, , m]) => <td key={k} style={['date', 'awbNumber', 'destination', 'ppcc'].includes(k) ? L : { ...td, ...(k === 'net' ? { fontWeight: 700 } : {}) }}>{m ? m2(val(r, k)) : k === 'chargeableWeight' ? n1(r[k]) : r[k]}</td>)}</tr>)}</tbody>
                  <tfoot><tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <td style={L} colSpan={4}>TOTAL</td><td style={td}>{s.pieces}</td><td style={td}>{n1(s.chargeableWeight)}</td><td style={td}></td>
                    {['weightPP', 'weightCC', 'valuationPP', 'taxPP', 'dueCarrierPP', 'dueCarrierCC', 'dueAgentPP', 'dueAgentCC'].map((k) => <td key={k} style={td}>{m2(s[k])}</td>)}
                    <td style={td}>{m2(s.commissionPP + s.commissionCC)}</td><td style={td}>{m2(s.payable)}</td><td style={td}>{m2(s.receivable)}</td><td style={{ ...td, color: s.net >= 0 ? '#b91c1c' : '#15803d' }}>{m2(s.net)}</td>
                  </tr></tfoot>
                </table>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
