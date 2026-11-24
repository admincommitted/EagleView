import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, FileWarning, Unlink, Package, TrendingUp, MapPin, Users, IndianRupee, Activity, Wifi, WifiOff, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { AIRLINE_MASTER } from './mastersData';

// Air Export dashboard: work alerts, AWB stock, business numbers, activity and airline connection (29-Oct-2026).
// All figures come from GET /api/awb/insights (node-backend/utils/awbInsights.js).

const C = { line: '#e2e8f0', text: '#0f172a', mute: '#64748b', red: '#dc2626', amber: '#d97706', green: '#059669', blue: '#2563eb', soft: '#f8fafc' };
const panel = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minWidth: 0 };
const head = { padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontWeight: 800, fontSize: '12px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase' };
const td = { padding: '6px 8px', borderBottom: `1px solid ${C.line}`, fontSize: '11px', whiteSpace: 'nowrap' };
const th = { ...td, fontWeight: 800, color: C.mute, textTransform: 'uppercase', fontSize: '10px', textAlign: 'left', background: C.soft };

const fmtDT = (v) => { if (!v) return '-'; const d = new Date(v); return isNaN(d) ? String(v) : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const ago = (v) => { if (!v) return 'never'; const m = Math.round((Date.now() - new Date(v)) / 60000); if (isNaN(m)) return '-'; if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 48) return `${h} h ago`; return `${Math.round(h / 24)} days ago`; };
const n0 = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const monthName = (k) => { const [y, m] = String(k).split('-'); return new Date(+y, +m - 1, 1).toLocaleString(undefined, { month: 'short' }).toUpperCase(); };
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
const ACTION_LABEL = { AWB_CREATED: 'Created', AWB_UPDATED: 'Updated', AWB_VOIDED: 'Voided', AWB_NUMBER_CHANGED: 'Number changed', AWB_DUPLICATED: 'Duplicated', HAWB_UNLINKED: 'HAWB unlinked', FWB_TRANSMITTED: 'FWB sent', FHL_TRANSMITTED: 'FHL sent' };

function airlineName(prefix) {
  const list = Array.isArray(window.__AIRLINES__) && window.__AIRLINES__.length ? window.__AIRLINES__ : AIRLINE_MASTER;
  const a = list.find((x) => String(x.prefix) === String(prefix));
  return a ? `${prefix} ${a.code2 || a.code || ''} ${a.name}`.replace(/\s+/g, ' ') : `${prefix}`;
}

// one alert card with a count; click shows the rows under it
function AlertBox({ icon, title, hint, count, color, open, onToggle }) {
  return (
    <div onClick={onToggle} style={{ ...panel, cursor: 'pointer', borderLeft: `4px solid ${count ? color : '#cbd5e1'}`, outline: open ? `2px solid ${color}` : 'none' }}>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ color: count ? color : C.mute }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: C.text, textTransform: 'uppercase' }}>{title}</div>
          <div style={{ fontSize: '10px', color: C.mute, marginTop: '2px' }}>{hint}</div>
        </div>
        <div style={{ fontSize: '28px', fontWeight: 900, color: count ? color : '#94a3b8' }}>{count}</div>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
    </div>
  );
}

function Bar({ value, max, color = C.blue }) {
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return <div style={{ background: '#eef2f7', borderRadius: '3px', height: '8px', width: '100%' }}><div style={{ width: `${w}%`, height: '100%', background: color, borderRadius: '3px' }} /></div>;
}

export default function AirExportInsights() {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [openAlert, setOpenAlert] = useState('');
  const [cur, setCur] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/awb/insights');
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Could not load');
      setD(j); setErr('');
      setCur((prev) => prev || (j.freightValue.byCurrency[0] && j.freightValue.byCurrency[0].currency) || '');
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, [load]);

  const open = (type, no) => {
    if (!no) return;
    if (type === 'HAWB') navigate('/freight/create-hawb', { state: { loadAwbNumber: no } });
    else if (type === 'MAWB') navigate('/freight/create-mawb', { state: { loadAwbNumber: no } });
    else navigate('/freight/create-awb', { state: { loadAwbNumber: no } });
  };

  if (!d) return <div style={{ ...panel, padding: '14px', fontSize: '12px', color: err ? C.red : C.mute }}>{err ? `Dashboard insights: ${err}` : 'Loading dashboard insights...'}</div>;

  const alerts = [
    { key: 'due', icon: <Clock size={22} />, title: 'Flight today / tomorrow, FWB not sent', hint: 'Send before the airline cut-off', count: d.dueFlights.length, color: C.red },
    { key: 'stuck', icon: <AlertTriangle size={22} />, title: 'Stuck shipments', hint: `RCS > ${d.rules.rcsToDepHours}h no DEP, DEP > ${d.rules.depToArrHours}h no arrival`, count: d.stuck.length, color: C.amber },
    { key: 'fhl', icon: <FileWarning size={22} />, title: 'FHL pending', hint: 'MAWB sent, some house FHL not sent', count: d.fhlPending.length, color: C.amber },
    { key: 'orphan', icon: <Unlink size={22} />, title: 'HAWB without MAWB / empty MAWB', hint: `${d.orphanCount} HAWB · ${d.emptyMawbCount} MAWB`, count: d.orphanCount + d.emptyMawbCount, color: C.blue },
  ];
  const rowStyle = { cursor: 'pointer' };
  const alertTable = () => {
    if (openAlert === 'due') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['When', 'AWB', 'Type', 'Flight', 'Flight date', 'Shipper', 'Route', 'Problem'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{d.dueFlights.map((r) => <tr key={r.type + r.id} style={rowStyle} onDoubleClick={() => open(r.type, r.awbNumber)}>
          <td style={{ ...td, fontWeight: 800, color: r.due === 'MISSED' ? C.red : r.due === 'TODAY' ? C.amber : C.blue }}>{r.due}</td><td style={td}>{r.awbNumber}</td><td style={td}>{r.type}</td><td style={td}>{r.flight || '-'}</td><td style={td}>{fmtDT(r.flightDate)}</td><td style={td}>{r.shipperName}</td><td style={td}>{r.origin} → {r.destination}</td><td style={{ ...td, color: C.red, fontWeight: 700 }}>{r.problem}</td></tr>)}</tbody></table>);
    if (openAlert === 'stuck') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['AWB', 'Type', 'Problem', 'Since', 'Hours', 'Shipper', 'Route'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{d.stuck.map((r) => <tr key={r.type + r.id} style={rowStyle} onDoubleClick={() => open(r.type, r.awbNumber)}>
          <td style={td}>{r.awbNumber}</td><td style={td}>{r.type}</td><td style={{ ...td, color: C.amber, fontWeight: 700 }}>{r.problem}</td><td style={td}>{fmtDT(r.since)}</td><td style={{ ...td, fontWeight: 800 }}>{r.hours}</td><td style={td}>{r.shipperName}</td><td style={td}>{r.origin} → {r.destination}</td></tr>)}</tbody></table>);
    if (openAlert === 'fhl') return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['MAWB', 'Houses', 'FHL not sent', 'HAWB numbers', 'Route'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{d.fhlPending.map((r) => <tr key={r.id} style={rowStyle} onDoubleClick={() => open('MAWB', r.awbNumber)}>
          <td style={td}>{r.awbNumber}</td><td style={td}>{r.houses}</td><td style={{ ...td, color: C.amber, fontWeight: 800 }}>{r.notSent}</td><td style={td}>{r.hawbs.join(', ')}</td><td style={td}>{r.origin} → {r.destination}</td></tr>)}</tbody></table>);
    if (openAlert === 'orphan') return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['HAWB', 'MAWB given', 'Problem', 'Shipper'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.orphanHawbs.map((r) => <tr key={r.id} style={rowStyle} onDoubleClick={() => open('HAWB', r.hawbNumber)}><td style={td}>{r.hawbNumber}</td><td style={td}>{r.masterAwbNumber || '-'}</td><td style={{ ...td, color: C.red }}>{r.problem}</td><td style={td}>{r.shipperName}</td></tr>)}
            {!d.orphanHawbs.length && <tr><td style={td} colSpan={4}>No HAWB without MAWB</td></tr>}</tbody></table>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['MAWB with no HAWB', 'Route', 'Created'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{d.emptyMawbs.map((r) => <tr key={r.id} style={rowStyle} onDoubleClick={() => open('MAWB', r.awbNumber)}><td style={td}>{r.awbNumber}</td><td style={td}>{r.origin} → {r.destination}</td><td style={td}>{fmtDT(r.createdAt)}</td></tr>)}
            {!d.emptyMawbs.length && <tr><td style={td} colSpan={3}>Every MAWB has houses</td></tr>}</tbody></table>
      </div>);
    return null;
  };

  const t = d.tonnage; const tm = t.thisMonth, lm = t.lastMonth;
  const change = pct(tm.chargeableWeight, lm.chargeableWeight);
  const maxAir = Math.max(1, ...t.byAirline.map((x) => x.chargeableWeight));
  const maxDest = Math.max(1, ...d.topDestinations.map((x) => x.shipments));
  const maxCust = Math.max(1, ...d.topCustomers.map((x) => x.shipments));
  const fvCur = d.freightValue.byCurrency.find((x) => x.currency === cur) || d.freightValue.byCurrency[0];
  const maxFv = fvCur ? Math.max(1, ...fvCur.months.map((m) => m.total)) : 1;
  const c = d.connection;
  const stale = c.lastCheckedAt && Date.now() - new Date(c.lastCheckedAt) > 30 * 60000;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* work alerts */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 900, fontSize: '13px', color: C.text, textTransform: 'uppercase' }}>Needs attention</div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer' }}>
          <RefreshCw size={12} className={loading ? 'spin-icon' : ''} /> Updated {ago(d.generatedAt)}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
        {alerts.map(({ key, ...a }) => <AlertBox key={key} {...a} open={openAlert === key} onToggle={() => setOpenAlert((p) => (p === key ? '' : key))} />)}
      </div>
      {openAlert && (
        <div style={{ ...panel, padding: '8px', overflowX: 'auto' }}>
          {alerts.find((a) => a.key === openAlert).count ? alertTable() : <div style={{ padding: '10px', fontSize: '12px', color: C.green, fontWeight: 700 }}>Nothing here - all clear.</div>}
          <div style={{ fontSize: '10px', color: C.mute, padding: '6px 4px 0' }}>Double-click a row to open it.</div>
        </div>
      )}

      {/* stock + tonnage */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px' }}>
        <div style={panel}>
          <div style={head}><Package size={15} /> AWB stock by airline</div>
          <div style={{ padding: '8px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Airline', 'Available', 'Reserved', 'Used', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {d.stock.map((s) => (
                  <tr key={s.prefix}>
                    <td style={{ ...td, fontWeight: 700 }}>{airlineName(s.prefix)}</td>
                    <td style={{ ...td, fontWeight: 900, color: s.low ? C.red : C.green }}>{s.available}</td>
                    <td style={td}>{s.reserved}{s.expiredReservations ? <span style={{ color: C.amber }}> ({s.expiredReservations} over {4}h)</span> : null}</td>
                    <td style={td}>{s.used}</td>
                    <td style={td}>
                      {s.low && <span style={{ background: '#fee2e2', color: C.red, fontWeight: 800, fontSize: '10px', padding: '2px 6px', borderRadius: '8px' }}>LOW STOCK</span>}
                      {s.availableButUsed ? <span title="Shown as available in stock but already saved on an AWB" style={{ marginLeft: '6px', background: '#fef3c7', color: C.amber, fontWeight: 800, fontSize: '10px', padding: '2px 6px', borderRadius: '8px' }}>{s.availableButUsed} USED, NOT MARKED</span> : null}
                    </td>
                  </tr>
                ))}
                {!d.stock.length && <tr><td style={td} colSpan={5}>No AWB stock entered. Add it in Masters → AWB Stock.</td></tr>}
              </tbody>
            </table>
            <div style={{ fontSize: '10px', color: C.mute, padding: '6px 4px 0' }}>Low stock = fewer than {d.rules.lowStock} numbers left.</div>
          </div>
        </div>

        <div style={panel}>
          <div style={head}><TrendingUp size={15} /> Tonnage - {monthName(tm.month)} (airline AWB + MAWB)</div>
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[['AWBs', tm.awbs, lm.awbs, ''], ['Gross wt', tm.grossWeight, lm.grossWeight, ' kg'], ['Chargeable wt', tm.chargeableWeight, lm.chargeableWeight, ' kg']].map(([l, v, p, u]) => {
                const ch = pct(v, p);
                return (
                  <div key={l} style={{ background: C.soft, borderRadius: '4px', padding: '8px' }}>
                    <div style={{ fontSize: '10px', color: C.mute, fontWeight: 800, textTransform: 'uppercase' }}>{l}</div>
                    <div style={{ fontSize: '18px', fontWeight: 900 }}>{n0(v)}{u}</div>
                    <div style={{ fontSize: '10px', color: ch === null ? C.mute : ch >= 0 ? C.green : C.red }}>{ch === null ? `${monthName(lm.month)}: ${n0(p)}${u}` : `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch)}% vs ${monthName(lm.month)}`}</div>
                  </div>
                );
              })}
            </div>
            {t.byAirline.map((x) => (
              <div key={x.prefix} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={airlineName(x.prefix)}>{airlineName(x.prefix)}</span>
                <Bar value={x.chargeableWeight} max={maxAir} />
                <span style={{ textAlign: 'right', fontWeight: 700 }}>{n0(x.chargeableWeight)} kg</span>
              </div>
            ))}
            {!t.byAirline.length && <div style={{ fontSize: '11px', color: C.mute }}>No airline AWB this month yet.</div>}
            {change !== null && <div style={{ fontSize: '10px', color: C.mute }}>Chargeable weight {change >= 0 ? 'up' : 'down'} {Math.abs(change)}% on last month.</div>}
          </div>
        </div>
      </div>

      {/* destinations, customers, freight value */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {[['Top destinations', <MapPin size={15} key="i" />, d.topDestinations, maxDest, C.blue], ['Top customers', <Users size={15} key="i" />, d.topCustomers, maxCust, '#7c3aed']].map(([title, icon, rows, max, color]) => (
          <div key={title} style={panel}>
            <div style={head}>{icon} {title} - {monthName(tm.month)}</div>
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {rows.map((x) => (
                <div key={x.name} style={{ fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }} title={x.name}>{x.name}</span>
                    <span style={{ color: C.mute }}>{x.shipments} shpt · {n0(x.grossWeight)} kg</span>
                  </div>
                  <Bar value={x.shipments} max={max} color={color} />
                </div>
              ))}
              {!rows.length && <div style={{ fontSize: '11px', color: C.mute }}>No shipments this month yet.</div>}
            </div>
          </div>
        ))}
        <div style={panel}>
          <div style={{ ...head, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><IndianRupee size={15} /> Airline freight - 6 months</span>
            {d.freightValue.byCurrency.length > 1 && (
              <select value={cur} onChange={(e) => setCur(e.target.value)} style={{ fontSize: '11px', padding: '1px 4px' }}>
                {d.freightValue.byCurrency.map((x) => <option key={x.currency} value={x.currency}>{x.currency}</option>)}
              </select>
            )}
          </div>
          <div style={{ padding: '12px' }}>
            {fvCur ? (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '110px' }}>
                  {fvCur.months.map((m) => (
                    <div key={m.month} title={`${monthName(m.month)}: PP ${n0(m.prepaid)} / CC ${n0(m.collect)} ${fvCur.currency}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                      <div style={{ background: '#f59e0b', height: `${(m.collect / maxFv) * 100}%` }} />
                      <div style={{ background: C.green, height: `${(m.prepaid / maxFv) * 100}%`, borderRadius: '3px 3px 0 0' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>{fvCur.months.map((m) => <div key={m.month} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: C.mute }}>{monthName(m.month)}</div>)}</div>
                <div style={{ fontSize: '11px', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><span style={{ color: C.green }}>■</span> Prepaid <span style={{ color: '#f59e0b', marginLeft: '6px' }}>■</span> Collect</span>
                  <b>{monthName(fvCur.months[5].month)}: {n0(fvCur.months[5].total)} {fvCur.currency}</b>
                </div>
              </>
            ) : <div style={{ fontSize: '11px', color: C.mute }}>No freight charges saved yet.</div>}
          </div>
        </div>
      </div>

      {/* activity + connection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: '12px' }}>
        <div style={panel}>
          <div style={head}><Activity size={15} /> Recent activity</div>
          <div style={{ padding: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['When', 'AWB / HAWB', 'Action', 'User', 'Details'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {d.activity.map((a, i) => (
                  <tr key={i}>
                    <td style={{ ...td, color: C.mute }} title={fmtDT(a.at)}>{ago(a.at)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{a.awbNumber}</td>
                    <td style={td}>{ACTION_LABEL[a.action] || a.action}</td>
                    <td style={td}>{a.user}</td>
                    <td style={{ ...td, whiteSpace: 'normal', color: C.mute }}>{a.details}</td>
                  </tr>
                ))}
                {!d.activity.length && <tr><td style={td} colSpan={5}>No activity yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div style={panel}>
          <div style={head}>{c.connected ? <Wifi size={15} color={C.green} /> : <WifiOff size={15} color={C.red} />} Airline connection (SFTP / FSU)</div>
          <div style={{ padding: '12px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ fontWeight: 900, fontSize: '13px', color: c.configured === false ? C.amber : c.connected && !stale ? C.green : C.red }}>
              {c.configured === false ? 'NOT SET UP' : c.connected && !stale ? 'CONNECTED' : 'OFFLINE'}{c.env ? ` · ${String(c.env).toUpperCase()}` : ''}
            </div>
            {c.configured === false && <div style={{ color: C.mute }}>SFTP login is not filled in. Set it in Settings → SFTP.</div>}
            {[['Last connected', c.lastConnectedAt], ['Last checked', c.lastCheckedAt], ['Last status (FSU) received', c.lastFsuAt], ['Last FWB / FHL sent', c.lastSentAt]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.line}`, paddingBottom: '4px' }}>
                <span style={{ color: C.mute }}>{l}</span><b title={fmtDT(v)}>{ago(v)}</b>
              </div>
            ))}
            {c.lastSentAwb && <div style={{ color: C.mute }}>Last sent: {c.lastSentAwb}</div>}
            {c.lastError && <div style={{ color: C.red, wordBreak: 'break-word' }}>Last error: {c.lastError}</div>}
            {stale && <div style={{ color: C.amber }}>No check for over 30 minutes - is the poller running?</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
