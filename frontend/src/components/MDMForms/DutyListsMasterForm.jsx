// Customs Duty Lists master (22-Nov-2026): anti-dumping duty, countervailing duty (CVD), export cess and tariff values.
// One screen, four lists, read from /api/tariff/dutylists (node-backend/routes/dutyLists.js).
//  - 50 rows a page, searched on the server (the anti-dumping list alone has 16,000+ rows)
//  - anti-dumping rows are loaded from iCAFFE, so that list is view only
//  - the other three: add, change, switch off / on. A row is never deleted from here.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Save, X } from 'lucide-react';
import ModernDatePicker from '../common/ModernDatePicker';
import askConfirm from '../common/askConfirm';

const API = '/api/tariff/dutylists';
const num = (v, d = 2) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d }));
const dmy = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(8, 10) + '-' + v.slice(5, 7) + '-' + v.slice(0, 4) : (v || '-'));
const CALC = ['%AGE OF LANDED VALUE', '%AGE OF CIF', 'SPECIFIC ON QTY'];

// f = field in the edit box (w = columns out of 12), c = column in the list
const LISTS = [
  { key: 'add', name: 'Anti-dumping Duty', readOnly: true,
    hint: 'Search notification no, CTH (from the first digits), country code',
    note: 'This list is loaded from iCAFFE and is used on the import item screen (anti-dumping duty look-up by CTH). It is view only here - a fresh load replaces all rows.',
    cols: [['notifNo', 'Notification'], ['notifDate', 'Date', dmy], ['serialNo', 'Sr No'], ['cthSlNo', 'CTH Sl'], ['cth', 'CTH'], ['originCountry', 'Origin'], ['exportCountry', 'Export'], ['rate', 'Rate %', num, 'r'], ['amount', 'Amount', num, 'r'], ['currency', 'Cur'], ['uqc', 'Unit'], ['endDate', 'Valid till', dmy]] },
  { key: 'cvd', name: 'Countervailing Duty (CVD)',
    hint: 'Search notification no, CTH, country code, goods, producer',
    note: 'Countervailing duty rows by notification, CTH, country and producer. A reference list for now - the item screen does not fill from it yet.',
    fields: [['notifNo', 'Notification No', 2, { req: true, max: 20, ph: '001/2024' }], ['serialNo', 'Sr No', 1, { max: 10 }], ['itemSlNo', 'Item Sl', 1, { max: 10 }], ['suppSlNo', 'Supp Sl', 1, { max: 10 }], ['cth', 'CTH', 2, { req: true, max: 8, digits: true, ph: '8 digits' }], ['originCountry', 'Origin Country', 1, { max: 2, ph: 'CN' }], ['exportCountry', 'Export Country', 1, { max: 2, ph: 'CN' }], ['rate', 'Rate', 1, { number: true }], ['calcMethod', 'Calculated On', 2, { options: CALC }],
      ['description', 'Goods', 4, { max: 500 }], ['exporter', 'Exporter', 4, { max: 300 }], ['producer', 'Producer', 4, { max: 300 }]],
    cols: [['notifNo', 'Notification'], ['serialNo', 'Sr No'], ['itemSlNo', 'Item Sl'], ['suppSlNo', 'Supp Sl'], ['cth', 'CTH'], ['originCountry', 'Origin'], ['exportCountry', 'Export'], ['rate', 'Rate', (v) => num(v, 4), 'r'], ['calcMethod', 'Calculated on'], ['description', 'Goods', null, 'w'], ['producer', 'Producer', null, 'w'], ['exporter', 'Exporter', null, 'w']] },
  { key: 'cess', name: 'Export Cess',
    hint: 'Search RITC (from the first digits) or goods',
    note: 'Export cess by RITC: a % rate, or an amount in Rs per unit. A reference list for now - the shipping bill screen does not fill from it yet.',
    fields: [['ritc', 'RITC', 2, { max: 8, digits: true, ph: '8 digits' }], ['serialNo', 'Serial No', 1, { max: 10 }], ['ratePercent', 'Rate %', 2, { number: true }], ['rateRs', 'Rate Rs', 2, { number: true }], ['unit', 'Per Unit', 1, { max: 10, ph: 'KGS' }], ['tariffValue', 'Tariff Value', 2, { number: true }], ['tariffUnit', 'Tariff Unit', 2, { max: 10 }], ['description', 'Goods', 12, { max: 300 }]],
    cols: [['ritc', 'RITC'], ['serialNo', 'Serial No'], ['ratePercent', 'Rate %', (v) => num(v, 4), 'r'], ['rateRs', 'Rate Rs', num, 'r'], ['unit', 'Per unit'], ['tariffValue', 'Tariff value', num, 'r'], ['tariffUnit', 'Tariff unit'], ['description', 'Goods', null, 'w']] },
  { key: 'tariffvalue', name: 'Tariff Values',
    hint: 'Search notification no, CTH or goods',
    note: 'Tariff values fixed by CBIC (36/2001-Cus (N.T.) and its changes) for edible oils, brass scrap, gold, silver and areca nuts. A reference list for now - the item screen does not fill from it yet.',
    fields: [['notifNo', 'Notification No', 2, { req: true, max: 20, ph: '36/2001' }], ['serialNo', 'Sr No', 1, { max: 10 }], ['cth', 'CTH', 2, { req: true, max: 8, digits: true, ph: '8 digits' }], ['tariffValue', 'Tariff Value', 2, { req: true, number: true }], ['currency', 'Currency', 1, { max: 3, ph: 'USD' }], ['uqc', 'Unit', 1, { max: 6, ph: 'MTS' }], ['effectiveDate', 'Effective Date', 3, { date: true }], ['description', 'Goods', 12, { req: true, max: 300 }]],
    cols: [['notifNo', 'Notification'], ['serialNo', 'Sr No'], ['cth', 'CTH'], ['description', 'Goods', null, 'w'], ['tariffValue', 'Tariff value', num, 'r'], ['currency', 'Cur'], ['uqc', 'Unit'], ['effectiveDate', 'Effective', dmy]] },
];

const CSS = `
.dl-wrap { display: flex; flex-direction: column; gap: 10px; height: 100%; min-width: 0; }
.dl-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 2px solid var(--primary-color-end, #0369a1); }
.dl-tabs button { border: 1px solid var(--border-color, #cbd5e1); border-bottom: 0; border-radius: 6px 6px 0 0; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; background: color-mix(in srgb, var(--primary-color-end, #0369a1) 7%, var(--bg-panel, #fff)); color: var(--text-main, #0f172a); display: flex; gap: 8px; align-items: center; }
.dl-tabs button.on { background: var(--primary-color-end, #0369a1); border-color: var(--primary-color-end, #0369a1); color: #fff; }
.dl-tabs button .n { font-size: 11px; font-weight: 700; padding: 0 6px; border-radius: 9px; background: rgba(15, 23, 42, 0.08); }
.dl-tabs button.on .n { background: rgba(255, 255, 255, 0.25); }
.dl-note { font-size: 12px; color: var(--text-muted, #475569); text-transform: none; line-height: 1.45; }
.dl-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.dl-bar .find { position: relative; flex: 1 1 320px; max-width: 520px; }
.dl-bar .find svg { position: absolute; left: 8px; top: 7px; color: var(--text-muted, #64748b); }
.dl-bar .find input { width: 100%; height: 28px; padding-left: 28px; }
.dl-bar label { font-size: 12px; display: flex; gap: 6px; align-items: center; cursor: pointer; text-transform: none; color: var(--text-main, #0f172a); }
.dl-btn { height: 28px; padding: 0 12px; border-radius: 5px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--border-color, #cbd5e1); background: var(--bg-panel, #fff); color: var(--text-main, #0f172a); }
.dl-btn.pri { background: var(--primary-color-end, #0369a1); border-color: var(--primary-color-end, #0369a1); color: #fff; }
.dl-btn:disabled { opacity: 0.5; cursor: default; }
.dl-edit { border: 1px solid var(--primary-color-end, #0369a1); border-radius: 6px; padding: 10px 12px; background: var(--bg-panel, #fff); }
.dl-edit h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--primary-color-end, #0369a1); }
.dl-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 8px 10px; }
.dl-grid label { display: block; font-size: 11px; font-weight: 600; color: var(--text-muted, #475569); margin-bottom: 3px; }
.dl-grid label b { color: #dc2626; }
.dl-grid input, .dl-grid select { width: 100%; height: 28px; }
.dl-err { color: #b91c1c; font-size: 12px; text-transform: none; font-weight: 600; }
.dl-tablebox { flex: 1; min-height: 160px; overflow: auto; border: 1px solid var(--border-color, #cbd5e1); border-radius: 6px; background: var(--bg-panel, #fff); }
.dl-tablebox table { width: 100%; border-collapse: collapse; font-size: 12px; }
.dl-tablebox th { position: sticky; top: 0; z-index: 1; text-align: left; padding: 6px 8px; font-size: 11px; white-space: nowrap; }
.dl-tablebox td { padding: 4px 8px; border-bottom: 1px solid var(--border-color, #e2e8f0); white-space: nowrap; vertical-align: top; }
.dl-tablebox td.w { white-space: normal; min-width: 180px; max-width: 360px; }
.dl-tablebox .r { text-align: right; font-variant-numeric: tabular-nums; }
.dl-tablebox tr.off td { color: #94a3b8; }
.dl-tablebox td.act { text-align: right; }
.dl-link { border: 0; background: none; padding: 0 0 0 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: var(--primary-color-end, #0369a1); }
.dl-link.warn { color: #b45309; }
.dl-empty { padding: 28px; text-align: center; color: var(--text-muted, #64748b); font-size: 12px; text-transform: none; }
.dl-foot { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 0 56px 0 18px; font-size: 12px; color: var(--text-muted, #475569); text-transform: none; }
`;

export default function DutyListsMasterForm() {
  const [kind, setKind] = useState('add');
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, limit: 50 });
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [edit, setEdit] = useState(null); // null = closed; { id?, ...values }
  const [saveErr, setSaveErr] = useState('');
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);
  const list = LISTS.find((l) => l.key === kind);

  const loadCounts = useCallback(async () => {
    try { const r = await fetch(API); if (r.ok) setCounts(await r.json()); } catch { /* the tabs just show no count */ }
  }, []);
  const load = useCallback(async (k, text, pg, off) => {
    const my = ++seq.current; setLoading(true); setLoadErr('');
    try {
      const r = await fetch(`${API}/${k}?q=${encodeURIComponent(text)}&page=${pg}&limit=50${off ? '&inactive=1' : ''}`);
      const j = await r.json().catch(() => ({}));
      if (my !== seq.current) return; // an older answer - a newer search is already out
      if (!r.ok) { setLoadErr(j.error || ('The list could not be read (HTTP ' + r.status + ')')); setData({ rows: [], total: 0, limit: 50 }); }
      else setData({ rows: Array.isArray(j.rows) ? j.rows : [], total: j.total || 0, limit: j.limit || 50 });
    } catch (e) { if (my === seq.current) { setLoadErr('The list could not be read: ' + e.message); setData({ rows: [], total: 0, limit: 50 }); } }
    if (my === seq.current) setLoading(false);
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  // typing waits 300 ms before it asks the server
  useEffect(() => { const t = setTimeout(() => load(kind, q.trim(), page, showOff), q ? 300 : 0); return () => clearTimeout(t); }, [kind, q, page, showOff, load]);

  const pickTab = (k) => { if (k === kind) return; setKind(k); setQ(''); setPage(1); setEdit(null); setSaveErr(''); setShowOff(false); };
  const openNew = () => { const v = {}; list.fields.forEach(([n]) => { v[n] = ''; }); setEdit(v); setSaveErr(''); };
  const openRow = (row) => { const v = { id: row.id }; list.fields.forEach(([n]) => { v[n] = row[n] === null || row[n] === undefined ? '' : String(row[n]); }); setEdit(v); setSaveErr(''); };
  const setF = (n, val, o) => { let x = val; if (o.digits) x = x.replace(/\D/g, ''); if (o.max) x = x.slice(0, o.max); setEdit((e) => ({ ...e, [n]: x })); setSaveErr(''); };

  const save = async () => {
    for (const [n, label, , o] of list.fields) { if (o.req && !String(edit[n] || '').trim()) return setSaveErr(label + ' is required.'); }
    if (kind === 'cess' && edit.ratePercent === '' && edit.rateRs === '') return setSaveErr('Fill Rate % or Rate Rs.');
    setSaving(true); setSaveErr('');
    try {
      const r = await fetch(edit.id ? `${API}/${kind}/${edit.id}` : `${API}/${kind}`, { method: edit.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edit) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setSaveErr('Not saved: ' + (j.error || j.message || ('HTTP ' + r.status)));
      else { setEdit(null); load(kind, q.trim(), page, showOff); loadCounts(); }
    } catch (e) { setSaveErr('Not saved: ' + e.message); }
    setSaving(false);
  };

  const toggle = async (row) => {
    const on = !row.isActive;
    if (!on) {
      const go = await askConfirm({ title: 'Switch off this row?', message: `${list.name}: ${row.notifNo || row.ritc || ''} ${row.cth || ''}`.trim(), note: 'The row stays in the list and can be switched on again. Tick "Show switched-off rows" to see it.', okLabel: 'Switch off', cancelLabel: 'Keep it on' });
      if (!go) return;
    }
    try {
      const r = await fetch(`${API}/${kind}/${row.id}/active`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: on }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setLoadErr('Not changed: ' + (j.error || ('HTTP ' + r.status)));
      else { load(kind, q.trim(), page, showOff); loadCounts(); }
    } catch (e) { setLoadErr('Not changed: ' + e.message); }
  };

  const pages = Math.max(1, Math.ceil(data.total / data.limit));
  const from = data.total ? (page - 1) * data.limit + 1 : 0, to = Math.min(page * data.limit, data.total);

  return (
    <div className="dl-wrap">
      <style>{CSS}</style>
      <div className="dl-tabs" role="tablist">
        {LISTS.map((l) => (
          <button key={l.key} type="button" role="tab" aria-selected={l.key === kind} className={l.key === kind ? 'on' : ''} onClick={() => pickTab(l.key)}>
            {l.name}{counts[l.key] ? <span className="n">{Number(counts[l.key].active).toLocaleString('en-IN')}</span> : null}
          </button>
        ))}
      </div>
      <div className="dl-note">{list.note}</div>

      <div className="dl-bar">
        <div className="find"><Search size={14} /><input type="text" className="input-field" aria-label={'Search ' + list.name} placeholder={list.hint} style={{ textTransform: 'none' }} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        {!list.readOnly && <label><input type="checkbox" checked={showOff} onChange={(e) => { setShowOff(e.target.checked); setPage(1); }} /> Show switched-off rows</label>}
        <span style={{ flex: 1 }} />
        {!list.readOnly && <button type="button" className="dl-btn pri" onClick={openNew}><Plus size={14} /> Add row</button>}
      </div>

      {edit && (
        <div className="dl-edit">
          <h4>{edit.id ? 'Change row' : 'Add row'} - {list.name}</h4>
          <div className="dl-grid">
            {list.fields.map(([n, label, w, o]) => (
              <div key={n} style={{ gridColumn: 'span ' + w }}>
                <label htmlFor={'dl-' + n}>{label}{o.req ? <b> *</b> : null}</label>
                {o.date ? <ModernDatePicker id={'dl-' + n} className="input-field" value={edit[n] || ''} onChange={(e) => setF(n, (e && e.target ? e.target.value : e) || '', o)} />
                  : o.options ? <select id={'dl-' + n} className="input-field" value={edit[n] || ''} onChange={(e) => setF(n, e.target.value, o)}><option value="">Select</option>{[...new Set([...o.options, edit[n]].filter(Boolean))].map((x) => <option key={x} value={x}>{x}</option>)}</select>
                    : <input id={'dl-' + n} type={o.number ? 'number' : 'text'} min={o.number ? 0 : undefined} step={o.number ? 'any' : undefined} className="input-field" placeholder={o.ph || ''} value={edit[n] || ''} onChange={(e) => setF(n, e.target.value, o)} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <button type="button" className="dl-btn pri" disabled={saving} onClick={save}><Save size={14} /> {edit.id ? 'Save changes' : 'Add row'}</button>
            <button type="button" className="dl-btn" onClick={() => { setEdit(null); setSaveErr(''); }}><X size={14} /> Cancel</button>
            {saveErr && <span className="dl-err" role="alert">{saveErr}</span>}
          </div>
        </div>
      )}

      {loadErr && <div className="dl-err" role="alert">{loadErr}</div>}
      <div className="dl-tablebox">
        <table>
          <thead><tr>{list.cols.map(([n, label, , cls]) => <th key={n} className={cls === 'r' ? 'r' : ''}>{label}</th>)}{!list.readOnly && <th className="r">Action</th>}</tr></thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className={row.isActive ? '' : 'off'}>
                {list.cols.map(([n, , fmt, cls]) => <td key={n} className={cls || ''}>{fmt ? fmt(row[n]) : (row[n] === null || row[n] === undefined || row[n] === '' ? '-' : row[n])}</td>)}
                {!list.readOnly && <td className="act"><button type="button" className="dl-link" onClick={() => openRow(row)}>EDIT</button><button type="button" className="dl-link warn" onClick={() => toggle(row)}>{row.isActive ? 'SWITCH OFF' : 'SWITCH ON'}</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !data.rows.length && !loadErr && (
          <div className="dl-empty">{q.trim() ? 'No row matches "' + q.trim() + '".' : (list.readOnly ? 'No rows loaded yet.' : 'No rows yet. Use "Add row", or run load_logisys_duty_lists.bat to bring in the rows downloaded from Logisys.')}</div>
        )}
      </div>
      <div className="dl-foot">
        <span>{loading ? 'Reading...' : (data.total ? `${from.toLocaleString('en-IN')} - ${to.toLocaleString('en-IN')} of ${data.total.toLocaleString('en-IN')} rows` : '0 rows')}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" className="dl-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages.toLocaleString('en-IN')}</span>
          <button type="button" className="dl-btn" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </span>
      </div>
    </div>
  );
}
