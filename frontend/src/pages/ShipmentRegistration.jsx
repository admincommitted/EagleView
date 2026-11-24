// 05-Nov-2026: Shipment Registration - iCAFFE's Operation > Shipment Registration, for the four divisions
// (Import Air, Import Sea, Export Air, Export Sea), branch-wise. Route /freight/shipment/:div (ai, si, ae, se).
// Tabs: Shipment, Search, Receiving Documents, Shipment Status, Complete/Cancel, Activity Details, Provisional Cost
// Sheet (shared with GST Invoice), Due Dates, Document List. Backend: /api/shipments (routes/shipments.js).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, Pencil, RotateCcw, Copy, Search, Plus, Trash2, X, CheckCircle2, Ban, FileText, Receipt, Upload, MapPin, Mail, Paperclip, Package, ExternalLink } from 'lucide-react';
import { T, inr, fmtDate, todayIso, api, postJson, Box, Btn, ActionBar, inputStyle as uiInput, Sheet, Grid, Badge } from './AccountsHubParts/ui';
import { ProvisionalSheet } from './AccountsHubParts/GstInvoiceDesk';
import { useGlobalContext } from '../GlobalContext';

const BASE = '/api/shipments';
const inputStyle = { ...uiInput, height: 25, padding: '0 6px', fontSize: 11.5, boxSizing: 'border-box' };
const roStyle = { ...inputStyle, background: '#eef2f6', color: '#334155' };
const mandStyle = { ...inputStyle, borderColor: '#f87171' };
function F({ label, children, required, span = 1, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, gridColumn: `span ${span}`, minWidth: 0, ...style }}>
      <label style={{ margin: 0, fontSize: 10.5, fontWeight: 700, lineHeight: '13px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}{required && <span style={{ color: T.dr }}> *</span>}</label>
      {children}
    </div>
  );
}
const Chk = ({ label, checked, onChange, disabled }) => <label style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0, fontSize: 11, fontWeight: 600, height: 25, whiteSpace: 'nowrap', cursor: 'pointer', opacity: disabled ? 0.55 : 1 }}><input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /> {label}</label>;
const grid = (n) => ({ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: '5px 8px', alignItems: 'end' });
const DIVKEY = { ai: 'AI', si: 'SI', ae: 'AE', se: 'SE' };
const n = (v) => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
const fyStartIso = () => { const d = new Date(); return (d.getMonth() < 3 ? d.getFullYear() - 1 : d.getFullYear()) + '-04-01'; };

// typeahead on the masters (Master Directory): party, airport, port, airline, shipping line, vessel, user, cost centre,
// CHA, warehouse, UQC, country, state, currency, quotation, customs job. "+" opens that master in a new tab to add a name.
const MASTER_PAGE = { party: 'party', airport: 'port', port: 'port', airline: 'airline', line: 'shipping-line', vessel: 'vessel', user: 'users', cha: 'party', warehouse: 'warehouse', uqc: 'uqc', country: 'country', state: 'country', currency: 'currency' };
const miniBtn = { width: 22, minWidth: 22, height: 25, border: `1px solid ${T.headBorder}`, borderRadius: 5, background: '#f8fafc', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, color: T.inkSoft };
function Look({ value, onText, onPick, what, type, placeholder, mandatory, disabled, upper, noAdd, addr }) {
  const [list, setList] = useState([]); const [open, setOpen] = useState(false); const tm = useRef(null); const [hi, setHi] = useState(0);
  const ask = (s, force) => { clearTimeout(tm.current); if (!force && String(s).trim().length < (what === 'state' || what === 'uqc' || what === 'currency' || what === 'country' ? 1 : 2)) { setList([]); return; } tm.current = setTimeout(() => api(`${BASE}/lookup/${what}?q=${encodeURIComponent(s)}${type ? '&type=' + type : ''}`).then(r => { setList(r || []); setHi(0); setOpen(true); }).catch(() => setList([])), force ? 0 : 250); };
  const pick = (it) => { onPick(it); setOpen(false); };
  const page = MASTER_PAGE[what];
  return (
    <div style={{ display: 'flex', gap: 3, position: 'relative' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input value={value || ''} disabled={disabled} placeholder={placeholder} title="Type 2 letters to pick from the master; F2 lists all" style={{ ...(mandatory && !value ? mandStyle : inputStyle), width: '100%' }}
          onChange={e => { const v = upper ? e.target.value.toUpperCase() : e.target.value; onText(v); ask(v); }} onBlur={() => setTimeout(() => setOpen(false), 180)} onFocus={() => list.length && setOpen(true)}
          onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); ask(value || '', true); } else if (open && list.length && e.key === 'ArrowDown') { e.preventDefault(); setHi(Math.min(hi + 1, list.length - 1)); } else if (open && list.length && e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hi - 1, 0)); } else if (open && list.length && e.key === 'Enter') { e.preventDefault(); pick(list[hi]); } else if (e.key === 'Escape') setOpen(false); }} />
        {open && list.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 30, top: 27, left: 0, minWidth: '100%', width: 360, maxHeight: 260, overflow: 'auto', background: '#fff', border: `1px solid ${T.headBorder}`, borderRadius: 6, boxShadow: '0 8px 20px rgba(15,23,42,.14)' }}>
            {list.map((it, i) => <div key={i} onMouseDown={() => pick(it)} onMouseEnter={() => setHi(i)} style={{ padding: '5px 8px', cursor: 'pointer', fontSize: 11.5, borderBottom: '1px solid #f1f5f9', background: i === hi ? '#eff6ff' : '#fff' }}>
              <b>{it.code ? it.code + ' - ' : ''}{it.name}</b>{it.partyCode && <span style={{ marginLeft: 6, fontSize: 9.5, color: T.muted, fontWeight: 600 }}>{it.partyCode}</span>}{it.src && it.src !== 'Party Master' && <span style={{ marginLeft: 6, fontSize: 9.5, color: '#b45309', fontWeight: 700 }}>{it.src}</span>}
              {(it.country || it.address || it.dir || it.prefix) && <div style={{ fontSize: 10, color: T.muted }}>{it.address || it.dir || it.country || 'Prefix ' + it.prefix}{it.gstin ? ' - ' + it.gstin : ''}{it.branches > 1 ? ' (' + it.branches + ' addresses)' : ''}</div>}</div>)}
          </div>
        )}
      </div>
      {addr && <AddrPick name={value} onPick={addr} />}
      {page && !noAdd && !disabled && <button type="button" style={miniBtn} title={'Add / edit in the master (Master Directory > ' + page + ')'} onClick={() => window.open('/master/' + page, '_blank')}><Plus size={12} /></button>}
    </div>
  );
}
// the party's addresses (party master branches) - like iCAFFE's "i" next to each party
function AddrPick({ name, onPick }) {
  const [list, setList] = useState(null); const [err, setErr] = useState(''); const btn = useRef(null); const [side, setSide] = useState({ left: 0 });
  const load = () => { const r = btn.current && btn.current.getBoundingClientRect(); setSide(r && r.left + 380 > window.innerWidth ? { right: 0 } : { left: 0 }); setErr(''); if (!String(name || '').trim()) { setErr('Pick the party first'); setList([]); return; } api(`${BASE}/lookup/branches?name=${encodeURIComponent(name)}`).then(r => { setList(r || []); if (!(r || []).length) setErr('No address of "' + name + '" in the party master'); }).catch(e => { setErr(e.message); setList([]); }); };
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btn} type="button" style={miniBtn} title="Pick the address from the party master" onClick={() => (list ? setList(null) : load())}><MapPin size={12} /></button>
      {list && (
        <div style={{ position: 'absolute', zIndex: 31, top: 27, ...side, width: 380, maxHeight: 280, overflow: 'auto', background: '#fff', border: `1px solid ${T.headBorder}`, borderRadius: 6, boxShadow: '0 8px 20px rgba(15,23,42,.14)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: '#f8fafc', fontSize: 11, fontWeight: 700 }}>Addresses {err ? '' : '(' + list.length + ')'}<span style={{ cursor: 'pointer' }} onClick={() => setList(null)}><X size={12} /></span></div>
          {err && <div style={{ padding: 8, fontSize: 11, color: T.dr }}>{err}</div>}
          {list.map(b => <div key={b.id} onMouseDown={() => { onPick(b); setList(null); }} style={{ padding: '5px 8px', cursor: 'pointer', fontSize: 11.5, borderBottom: '1px solid #f1f5f9' }}>
            <b>{b.name}</b>{b.isDefault && <span style={{ marginLeft: 6, fontSize: 9.5, color: T.cr, fontWeight: 700 }}>default</span>}<div style={{ fontSize: 10, color: T.muted }}>{b.address}{b.gstin ? ' - GSTIN ' + b.gstin : ''}</div></div>)}
        </div>
      )}
    </div>
  );
}
// party typeahead: a name from the iCAFFE directory is copied into the party master when picked
const takeParty = async (p) => {
  if (p && !p.id && p.icaffeId) { try { const r = await postJson(BASE + '/party-from-directory', { icaffeId: p.icaffeId }); return { ...p, id: r.id, src: 'Party Master' }; } catch (e) { return p; } }
  return p;
};
function PartyLook({ onPick, ...rest }) { return <Look what="party" {...rest} onPick={async (p) => onPick(await takeParty(p))} />; }

const empty = (div, branch) => ({ division: div, branchCode: branch || '', docketNo: '', docketDate: todayIso(), clearanceDate: '', customsOnly: false, jobType: '', shipmentType: 'Consol', houseType: 'House', cargoType: 'General',
  freightTerm: 'Prepaid', nomination: '', shipmentTerm: '', mainParty: '', mainPartyId: null, mainAddress: '', otherParty: '', overseasAgent: '', subAgent: '', billingType: '', billingParty: '', billingAddress: '',
  notifyParty: '', cha: '', mawbNo: '', mawbDate: '', hawbNo: '', hawbDate: '', carrier: '', flightVessel: '', voyage: '', etd: '', eta: '', igmNo: '', igmDate: '', originPort: '', destinationPort: '', dischargePort: '',
  clearanceAt: '', pkgs: '', pkgUnit: 'PKG', grossWeight: '', chargeableWeight: '', volume: '', goodsDesc: '', stage: 'Register', currentStatus: '', docketOwner: '', referenceNo: '', remarks: '', marketingPerson: '',
  quotationNo: '', placeOfSupply: '', costCentre: '', ediJobNo: '', poNo: '', containers: [], dimensions: [], docs: {},
  data: { otherAddress: '', broker: '', subAgent2: '', subAgentAddress: '', overseasAddress: '', overseasAgent2: '', notifyAddress: '', notifySame: false, seller: '', sellerSame: false, billingSame: false,
    actualShipper: '', actualConsignee: '', routedBy: '', oblType: '', forwarder: '', doCollected: false, doNo: '', doDate: '', lrNo: '', lrDate: '', grnNo: '', segment: '', grossUnit: 'KGS', netWeight: '',
    goodsType: '', marks: '', carrier2: '', inwardDate: '', rotationNo: '', atd: '', ata: '', sobDate: '', destuffAt: '', stuffAt: '', cutOff: '', assValue: '', totalDuty: '', referenceNo2: '', bro: false, approvalVerified: false } });

// ================================================================== screen
export default function ShipmentRegistration() {
  const { div: divParam } = useParams(); const [params, setParams] = useSearchParams(); const nav = useNavigate();
  const div = DIVKEY[String(divParam || 'ai').toLowerCase()] || 'AI';
  const g = useGlobalContext() || {};
  const myBranch = (g.activeBranch && !g.activeBranch.isAll && (g.activeBranch.branchCode || g.activeBranch.branch_code)) || ''; // 'All branches' = pick one on the form
  const [meta, setMeta] = useState(null); const [tab, setTab] = useState('shipment');
  const [h, setH] = useState(() => empty(div, myBranch)); const [id, setId] = useState(null); const [nextNo, setNextNo] = useState('');
  const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false); const [invoices, setInvoices] = useState([]);
  const D = meta ? meta.divisions[div] : { label: '', side: div.endsWith('I') ? 'Import' : 'Export', mode: div.startsWith('A') ? 'Air' : 'Sea' };
  const imp = D.side === 'Import', air = D.mode === 'Air';
  useEffect(() => { api(BASE + '/meta').then(setMeta).catch(e => setMsg({ bad: true, t: e.message })); }, []);
  useEffect(() => { setH(empty(div, myBranch)); setId(null); setTab('shipment'); setMsg(null); }, [div]);
  useEffect(() => { if (!id) api(`${BASE}/next-no?division=${div}&branch=${encodeURIComponent(h.branchCode || myBranch)}&date=${h.docketDate}`).then(r => setNextNo(r.no)).catch(() => setNextNo('')); }, [div, h.docketDate, h.branchCode, id]);
  useEffect(() => { const no = params.get('docket'); if (no) api(BASE + '/by-no?no=' + encodeURIComponent(no)).then(r => r && open(r.id)).catch(() => null); }, [params.get('docket')]);
  const set = (k) => (v) => setH(o => ({ ...o, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }));
  const setD = (k) => (v) => setH(o => ({ ...o, data: { ...o.data, [k]: v && v.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v } }));
  const up = (k) => (e) => set(k)(e.target.value.toUpperCase());

  const open = async (sid) => {
    try { const r = await api(BASE + '/' + sid);
      if (r.division !== div) { nav('/freight/shipment/' + r.division.toLowerCase() + '?docket=' + encodeURIComponent(r.docketNo)); return; }
      setH({ ...empty(div, myBranch), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined)), customsOnly: !!r.customsOnly, data: { ...empty(div).data, ...(r.data || {}) } });
      setId(r.id); setInvoices(r.invoices || []); setTab('shipment'); setMsg({ t: 'Opened ' + r.docketNo + (r.stage && r.stage !== 'Register' ? ' - ' + r.stage : '') });
    } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const clear = () => { setH(empty(div, myBranch)); setId(null); setInvoices([]); setMsg(null); if (params.get('docket')) setParams({}); };
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const body = { ...h, division: div, branchCode: h.branchCode || myBranch };
      const r = id ? await postJson(BASE + '/' + id, body, 'PUT') : await postJson(BASE, body);
      setId(r.id); setH(o => ({ ...o, docketNo: r.docketNo })); setMsg({ ok: true, t: (id ? 'Modified ' : 'Saved - docket ') + r.docketNo + (r.notInMaster && r.notInMaster.length ? '. Not in the party master: ' + r.notInMaster.join(', ') + ' - add them with + (needed for billing)' : '') });
    } catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false);
  };
  const del = async () => {
    const reason = window.prompt('Delete docket ' + h.docketNo + '? Its status, activities, papers, uploaded files and provisional cost sheet go with it (a copy is kept). Reason:');
    if (reason === null) return;
    setBusy(true);
    try { const r = await api(BASE + '/' + id, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); const no = h.docketNo; clear(); setMsg({ ok: true, t: 'Docket ' + no + ' deleted' + (r && r.sheet ? ', with its provisional cost sheet' : '') + ' - a copy is kept' }); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false);
  };
  const duplicate = async () => { try { const r = await postJson(BASE + '/' + id + '/duplicate', {}); setH({ ...empty(div, myBranch), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined)), customsOnly: !!r.customsOnly, data: { ...empty(div).data, ...(r.data || {}) } }); setId(null); setMsg({ t: 'Copy made - change it and Save for a new docket' }); } catch (e) { setMsg({ bad: true, t: e.message }); } };

  // volume weight from dimensions (air: L x W x H / 6000 cm or / 366 inch per piece)
  const [dim, setDim] = useState({ l: '', w: '', h: '', p: '', unit: 'CM' });
  const volWt = useMemo(() => Math.round(h.dimensions.reduce((s, d) => s + n(d.l) * n(d.w) * n(d.h) * n(d.p) / (d.unit === 'IN' ? 366 : 6000), 0) * 100) / 100, [h.dimensions]);
  const cbm = useMemo(() => Math.round(h.dimensions.reduce((s, d) => s + n(d.l) * n(d.w) * n(d.h) * n(d.p) / (d.unit === 'IN' ? 61023.7 : 1000000), 0) * 1000) / 1000, [h.dimensions]);
  const [cn, setCn] = useState({ no: '', size: '20', type: 'GP', seal: '', pkgs: '', weight: '' });
  const [subOpen, setSubOpen] = useState(false);

  const L = { main: imp ? 'Importer' : 'Shipper', other: imp ? 'Supplier' : 'Consignee', m: air ? 'MAWB' : 'MBL', hs: air ? 'HAWB' : 'HBL', carrier: air ? 'AirLine' : 'Shipping Line', fv: air ? '1st Carrier (Flight)' : 'Vessel', gm: imp ? 'IGM' : 'EGM' };
  const portWhat = air ? 'airport' : 'port';
  const tabs = [['shipment', 'Shipment'], ['search', 'Search'], ['recv', 'Receiving Documents'], ['status', 'Shipment Status'], ['stage', 'Complete/Cancel'], ['activity', 'Activity Details'], ['cost', 'Provisional Cost Sheet'], ['due', 'Due Dates'], ['docs', 'Document List']];
  const needDocket = (el) => (id ? el : <Box><div style={{ color: T.muted, padding: 14 }}>Open a docket first - save a new one on the Shipment tab, or pick one on the Search tab.</div></Box>);

  return (
    <div className="ship-reg" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{D.label || 'Shipment'} - Shipment Registration</h2>
        <div style={{ display: 'flex', gap: 4 }}>{Object.entries(DIVKEY).map(([k, v]) => <Btn key={k} small kind={v === div ? 'primary' : 'ghost'} onClick={() => nav('/freight/shipment/' + k)}>{meta ? meta.divisions[v].label : v}</Btn>)}</div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.muted }}>Branch {h.branchCode || myBranch || '-'}{id ? ' - docket ' + h.docketNo : ''}</span>
      </div>
      <Sheet tabs={tabs.map(([k, l]) => ({ id: k, label: l }))} tab={tab} onTab={setTab}>
        {tab === 'shipment' && <>
          <Box pad={8} title={<span>Shipment Option {id && <Badge tone={h.stage === 'Cancelled' ? 'bad' : h.stage === 'Complete' ? 'ok' : 'brand'}>{h.stage || 'Register'}</Badge>} {h.currentStatus && <Badge tone="muted">{h.currentStatus}</Badge>}</span>}>
            <div style={grid(9)}>
              <F label="Docket No"><input style={roStyle} readOnly value={id ? h.docketNo : nextNo ? nextNo + ' (on Save)' : ''} /></F>
              <F label="Docket Date" required><input type="date" style={inputStyle} value={h.docketDate} onChange={set('docketDate')} /></F>
              <F label="Clearance Date"><input type="date" style={inputStyle} value={h.clearanceDate} onChange={set('clearanceDate')} /></F>
              <F label="Job Type" required><select style={h.jobType ? inputStyle : mandStyle} value={h.jobType} onChange={set('jobType')}><option value="">Select</option>{['CC-FF', 'FF', 'CC', 'MISC', 'GTA'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Shipment Type"><select style={inputStyle} value={h.shipmentType} onChange={set('shipmentType')}>{['Consol', 'Non Consol'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Type"><select style={inputStyle} value={h.houseType} onChange={set('houseType')}>{['House', 'Master'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Cargo Type"><select style={inputStyle} value={h.cargoType} onChange={set('cargoType')}>{['General', 'Valuable', 'Hazardous', 'Perishable', 'Others'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label={(air ? 'HAWB' : 'HBL') + ' Nature'}><select style={inputStyle} value={h.freightTerm} onChange={set('freightTerm')}>{['Prepaid', 'Collect'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Branch"><select style={inputStyle} value={h.branchCode || myBranch} onChange={set('branchCode')} disabled={!!id}>{(meta ? meta.branches : []).map(b => <option key={b.code} value={b.code}>{b.code} - {b.name}</option>)}</select></F>
              <F label="Mode"><select style={inputStyle} value={h.nomination} onChange={set('nomination')}><option value="">Select</option>{['Direct', 'Nominated To Us', 'Nominated To Others'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Shipment Term"><select style={inputStyle} value={h.shipmentTerm} onChange={set('shipmentTerm')}><option value="">Select</option>{['EXW', 'FCA', 'CPT', 'CIP', 'DAT', 'DAP', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="EDI Job No (customs)" span={2}><Look what="edijob" value={h.ediJobNo} onText={set('ediJobNo')} onPick={j => set('ediJobNo')(j.code)} placeholder="map to the BE / SB job" /></F>
              <div style={{ gridColumn: 'span 2' }}><Chk label="Customs Clearance Only" checked={h.customsOnly} onChange={set('customsOnly')} /></div>
            </div>
          </Box>
          <Box pad={8} title="Party Details">
            <div style={grid(8)}>
              <F label={L.main} required span={2}><PartyLook type={imp ? 'consignee' : 'shipper'} value={h.mainParty} mandatory onText={v => setH(o => ({ ...o, mainParty: v, mainPartyId: null, ...(o.data.notifySame ? { notifyParty: v } : {}), ...(o.billingType === L.main ? { billingParty: v } : {}) }))} addr={b => setH(o => ({ ...o, mainAddress: b.address, ...(o.data.notifySame ? { data: { ...o.data, notifyAddress: b.address } } : {}), ...(o.billingParty === o.mainParty ? { billingAddress: b.address } : {}), ...(!o.placeOfSupply && b.state ? { placeOfSupply: String(b.state).toUpperCase() } : {}) }))}
                onPick={p => setH(o => ({ ...o, mainParty: p.name, mainPartyId: p.id, mainAddress: p.address, ...(!o.marketingPerson && p.marketingPerson ? { marketingPerson: p.marketingPerson } : {}), ...(!o.placeOfSupply && p.state ? { placeOfSupply: String(p.state).toUpperCase() } : {}), ...(o.data.notifySame ? { notifyParty: p.name, data: { ...o.data, notifyAddress: p.address } } : {}), ...(o.data.billingSame || !o.billingParty || o.billingType === L.main ? { billingParty: p.name, billingAddress: p.address, billingType: o.billingType || L.main } : {}) }))} /></F>
              <F label="Address" span={2}><input style={inputStyle} value={h.mainAddress} onChange={e => { const v = e.target.value; setH(o => ({ ...o, mainAddress: v, ...(o.data.notifySame ? { data: { ...o.data, notifyAddress: v } } : {}), ...(o.billingType === L.main ? { billingAddress: v } : {}) })); }} /></F>
              <F label={L.other} span={2}><PartyLook type={imp ? 'foreign' : 'foreign'} value={h.otherParty} onText={v => setH(o => ({ ...o, otherParty: v, ...(o.billingType === L.other ? { billingParty: v } : {}), ...(o.data.sellerSame ? { data: { ...o.data, seller: v } } : {}) }))} addr={b => setD('otherAddress')(b.address)} onPick={p => setH(o => ({ ...o, otherParty: p.name, ...(o.billingType === L.other ? { billingParty: p.name, billingAddress: p.address } : {}), data: { ...o.data, otherAddress: p.address, ...(o.data.sellerSame ? { seller: p.name } : {}) } }))} /></F>
              <F label={imp ? 'Broker' : 'Buyer'} span={2}><PartyLook type={imp ? '' : 'buyer'} value={h.data.broker} onText={setD('broker')} onPick={p => setD('broker')(p.name)} /></F>
              <F label="Sub Agent1" span={2}><PartyLook type="subagent" value={h.subAgent} onText={set('subAgent')} addr={b => setD('subAgentAddress')(b.address)} onPick={p => setH(o => ({ ...o, subAgent: p.name, data: { ...o.data, subAgentAddress: p.address } }))} /></F>
              <F label="Address" span={2}><input style={inputStyle} value={h.data.subAgentAddress} onChange={setD('subAgentAddress')} /></F>
              <F label="Sub Agent2" span={2}><PartyLook type="subagent" value={h.data.subAgent2} onText={setD('subAgent2')} onPick={p => setD('subAgent2')(p.name)} /></F>
              <F label="CHA" span={2}><Look what="cha" value={h.cha} onText={set('cha')} onPick={p => set('cha')(p.name)} placeholder="CHA master" /></F>
              <F label="OverSeas Agt" span={2}><PartyLook type="overseas" value={h.overseasAgent} onText={set('overseasAgent')} addr={b => setD('overseasAddress')(b.address)} onPick={p => setH(o => ({ ...o, overseasAgent: p.name, data: { ...o.data, overseasAddress: p.address } }))} /></F>
              <F label="Address" span={2}><input style={inputStyle} value={h.data.overseasAddress} onChange={setD('overseasAddress')} /></F>
              <F label="OverSeas Agt2" span={2}><PartyLook type="overseas" value={h.data.overseasAgent2} onText={setD('overseasAgent2')} onPick={p => setD('overseasAgent2')(p.name)} /></F>
              <F label="Routed By" span={2}><PartyLook value={h.data.routedBy} onText={setD('routedBy')} onPick={p => setD('routedBy')(p.name)} /></F>
              <F label={<span>Notify <label style={{ fontWeight: 600, marginLeft: 6 }}><input type="checkbox" style={{ margin: 0 }} checked={!!h.data.notifySame} onChange={e => setH(o => ({ ...o, notifyParty: e.target.checked ? o.mainParty : o.notifyParty, data: { ...o.data, notifySame: e.target.checked, notifyAddress: e.target.checked ? o.mainAddress : o.data.notifyAddress } }))} /> same as {L.main}</label></span>} span={2}>
                <PartyLook type="notify" value={h.notifyParty} disabled={!!h.data.notifySame} onText={set('notifyParty')} addr={b => setD('notifyAddress')(b.address)} onPick={p => setH(o => ({ ...o, notifyParty: p.name, data: { ...o.data, notifyAddress: p.address } }))} /></F>
              <F label="Notify Address" span={2}><input style={inputStyle} value={h.data.notifyAddress} onChange={setD('notifyAddress')} /></F>
              <F label={<span>{imp ? 'Seller' : 'Manufacturer'} <label style={{ fontWeight: 600, marginLeft: 6 }}><input type="checkbox" style={{ margin: 0 }} checked={!!h.data.sellerSame} onChange={e => setH(o => ({ ...o, data: { ...o.data, sellerSame: e.target.checked, seller: e.target.checked ? o.otherParty : o.data.seller } }))} /> same as {L.other}</label></span>} span={2}>
                <PartyLook type={imp ? 'foreign' : 'shipper'} value={h.data.seller} disabled={!!h.data.sellerSame} onText={setD('seller')} onPick={p => setD('seller')(p.name)} /></F>
              <F label="Billing Type"><select style={inputStyle} value={h.billingType} onChange={e => { const v = e.target.value; setH(o => ({ ...o, billingType: v, ...(v === L.main ? { billingParty: o.mainParty, billingAddress: o.mainAddress } : v === L.other ? { billingParty: o.otherParty, billingAddress: o.data.otherAddress } : v === 'Overseas Agent' ? { billingParty: o.overseasAgent, billingAddress: o.data.overseasAddress } : v === 'SubAgent' ? { billingParty: o.subAgent, billingAddress: o.data.subAgentAddress } : {}) })); }}><option value="">Select</option>{[L.main, L.other, 'Overseas Agent', 'SubAgent', 'Other'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Billing Cust." span={2}><PartyLook value={h.billingParty} onText={set('billingParty')} addr={b => setH(o => ({ ...o, billingAddress: b.address, ...(b.state ? { placeOfSupply: String(b.state).toUpperCase() } : {}) }))} onPick={p => setH(o => ({ ...o, billingParty: p.name, billingAddress: p.address, ...(p.state ? { placeOfSupply: String(p.state).toUpperCase() } : {}) }))} /></F>
              <F label="Billing Address" span={3}><input style={inputStyle} value={h.billingAddress} onChange={set('billingAddress')} /></F>
              <F label="Cost Center"><Look what="costcentre" value={h.costCentre} onText={set('costCentre')} onPick={c => set('costCentre')(c.name)} noAdd /></F>
              <F label="Actl Shipper" span={2}><PartyLook type={imp ? 'foreign' : 'shipper'} value={h.data.actualShipper} onText={setD('actualShipper')} onPick={p => setD('actualShipper')(p.name)} /></F>
              <F label="Actl Consignee" span={2}><PartyLook type={imp ? 'consignee' : 'foreign'} value={h.data.actualConsignee} onText={setD('actualConsignee')} onPick={p => setD('actualConsignee')(p.name)} /></F>
              <F label="OBL Type"><select style={inputStyle} value={h.data.oblType} onChange={setD('oblType')}><option value="">Select</option>{['Original', 'Seaway Bill', 'Telex Release', 'Express Release', 'Surrender'].map(o => <option key={o}>{o}</option>)}</select></F>
              <F label="Forwarder" span={2}><PartyLook value={h.data.forwarder} onText={setD('forwarder')} onPick={p => setD('forwarder')(p.name)} /></F>
            </div>
          </Box>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
            <Box pad={8} title="Shipment Details">
              <div style={grid(4)}>
                <F label={L.m + ' No.'} required={!h.customsOnly} span={2}><input style={!h.customsOnly && !h.mawbNo ? mandStyle : inputStyle} value={h.mawbNo} onChange={up('mawbNo')} placeholder={air ? '176-12345675' : 'MBL NO'} /></F>
                <F label={L.m + ' Date'}><input type="date" style={inputStyle} value={h.mawbDate} onChange={set('mawbDate')} /></F>
                <F label="PO NO."><input style={inputStyle} value={h.poNo} onChange={set('poNo')} /></F>
                <F label={L.hs + ' No'} span={2}><input style={inputStyle} value={h.hawbNo} onChange={up('hawbNo')} /></F>
                <F label={L.hs + ' Date'}><input type="date" style={inputStyle} value={h.hawbDate} onChange={set('hawbDate')} /></F>
                <F label="Segment"><input style={inputStyle} value={h.data.segment} onChange={setD('segment')} /></F>
                <F label={L.carrier} span={2}><Look what={air ? 'airline' : 'line'} value={h.carrier} onText={set('carrier')} onPick={a => setH(o => ({ ...o, carrier: a.name, ...(air && a.prefix && !o.mawbNo ? { mawbNo: a.prefix + '-' } : {}) }))} /></F>
                {imp ? <>
                  <F label="DO No"><input style={inputStyle} value={h.data.doNo} onChange={setD('doNo')} /></F>
                  <F label="DO Date"><input type="date" style={inputStyle} value={h.data.doDate} onChange={setD('doDate')} /></F>
                </> : <>
                  <F label="Cut-off"><input type="datetime-local" style={inputStyle} value={h.data.cutOff} onChange={setD('cutOff')} /></F>
                  <F label="Stuffing At"><Look what="warehouse" value={h.data.stuffAt} upper onText={setD('stuffAt')} onPick={w => setD('stuffAt')(w.code + ' - ' + w.name)} placeholder="CFS / warehouse" /></F>
                </>}
                <F label="LR No."><input style={inputStyle} value={h.data.lrNo} onChange={setD('lrNo')} /></F>
                <F label="LR No. Date"><input type="date" style={inputStyle} value={h.data.lrDate} onChange={setD('lrDate')} /></F>
                <F label="GRN No."><input style={inputStyle} value={h.data.grnNo} onChange={setD('grnNo')} /></F>
                {imp && <div><Chk label={'DO Collected ' + (air ? 'AirLine' : 'Line')} checked={h.data.doCollected} onChange={setD('doCollected')} /></div>}
              </div>
            </Box>
            <Box pad={8} title="Goods Details">
              <div style={grid(6)}>
                <F label="No. Of Pkgs."><div style={{ display: 'flex', gap: 3 }}><input style={{ ...inputStyle, flex: 1, minWidth: 0 }} value={h.pkgs} onChange={set('pkgs')} /><button type="button" style={{ ...miniBtn, ...((h.data.subPkgs || []).length ? { background: '#eff6ff', color: T.head } : {}) }} title={'Sub Pkgs - package break-up' + ((h.data.subPkgs || []).length ? ' (' + h.data.subPkgs.map(x2 => x2.pkgs + ' ' + x2.unit).join(' + ') + ')' : '')} onClick={() => setSubOpen(!subOpen)}><Package size={12} /></button></div></F>
                <F label="Unit"><Look what="uqc" value={h.pkgUnit} upper onText={set('pkgUnit')} onPick={u => set('pkgUnit')(u.code)} /></F>
                <F label="Gross Weight"><input style={inputStyle} value={h.grossWeight} onChange={set('grossWeight')} /></F>
                <F label="Unit"><Look what="uqc" value={h.data.grossUnit} upper onText={setD('grossUnit')} onPick={u => setD('grossUnit')(u.code)} /></F>
                <F label="Net Weight"><input style={inputStyle} value={h.data.netWeight} onChange={setD('netWeight')} /></F>
                {air ? <F label={'Chargable Wt.' + (volWt ? ' (vol ' + volWt + ')' : '')}><input style={inputStyle} value={h.chargeableWeight} onChange={set('chargeableWeight')} placeholder={volWt ? String(Math.max(volWt, n(h.grossWeight))) : ''} /></F>
                  : <F label="Volume (CBM)"><input style={inputStyle} value={h.volume} onChange={set('volume')} placeholder={cbm ? String(cbm) : ''} /></F>}
                <F label="Goods Type" span={2}><select style={inputStyle} value={h.data.goodsType} onChange={setD('goodsType')}><option value="">Select</option>{['Active cool container', 'Envirotainer', 'Aircraft on ground', '15 to 25 Degree C', 'Charter', 'Dangerous goods', 'Exhibition & Promotion material', 'Garment on Hanger', 'High dense', 'Odd dimensions cargo', 'Pharmaceutical', 'Re-export', 'Personal effects', 'General'].map(o => <option key={o}>{o}</option>)}</select></F>
                <F label="Goods Desc" span={4}><input style={inputStyle} value={h.goodsDesc} onChange={set('goodsDesc')} /></F>
                <F label="Marks & Nos" span={6}><input style={inputStyle} value={h.data.marks} onChange={setD('marks')} /></F>
                {subOpen && <div style={{ gridColumn: 'span 6' }}><SubPkgs rows={h.data.subPkgs || []} total={h.pkgs} onChange={r => setH(o => ({ ...o, data: { ...o.data, subPkgs: r }, ...(r.length ? { pkgs: String(r.reduce((t, x2) => t + n(x2.pkgs), 0)), pkgUnit: r.length === 1 ? r[0].unit : 'PKG' } : {}) }))} onClose={() => setSubOpen(false)} /></div>}
              </div>
            </Box>
            <Box pad={8} title={air ? 'Flight Details' : 'Vessel Details'}>
              <div style={grid(4)}>
                <F label={L.fv} span={air ? 1 : 2}>{air ? <input style={inputStyle} value={h.flightVessel} onChange={up('flightVessel')} placeholder="EK 512" /> : <Look what="vessel" value={h.flightVessel} onText={set('flightVessel')} onPick={v => set('flightVessel')(v.name)} />}</F>
                {air ? <F label="2nd Carrier"><Look what="airline" value={h.data.carrier2} upper onText={setD('carrier2')} onPick={a => setD('carrier2')(a.code || a.name)} noAdd /></F> : <F label="Voyage"><input style={inputStyle} value={h.voyage} onChange={up('voyage')} /></F>}
                <F label="ETD"><input type="date" style={inputStyle} value={h.etd} onChange={set('etd')} /></F>
                <F label="ETA"><input type="date" style={inputStyle} value={h.eta} onChange={set('eta')} /></F>
                <F label={L.gm + ' No.'}><input style={inputStyle} value={h.igmNo} onChange={up('igmNo')} /></F>
                <F label={L.gm + ' Date'}><input type="date" style={inputStyle} value={h.igmDate} onChange={set('igmDate')} /></F>
                {imp ? <F label="Inward Date"><input type="date" style={inputStyle} value={h.data.inwardDate} onChange={setD('inwardDate')} /></F> : <F label="SOB Date"><input type="date" style={inputStyle} value={h.data.sobDate} onChange={setD('sobDate')} /></F>}
                <F label={air ? 'Rotation No' : 'Line / Rotation No'}><input style={inputStyle} value={h.data.rotationNo} onChange={setD('rotationNo')} /></F>
                <F label="ATD"><input type="date" style={inputStyle} value={h.data.atd} onChange={setD('atd')} /></F>
                <F label="ATA"><input type="date" style={inputStyle} value={h.data.ata} onChange={setD('ata')} /></F>
                {imp && <F label="SOB Date"><input type="date" style={inputStyle} value={h.data.sobDate} onChange={setD('sobDate')} /></F>}
              </div>
            </Box>
            <Box pad={8} title="Port Details">
              <div style={grid(4)}>
                <F label="Origin Port" required={!h.customsOnly} span={2}><Look what={portWhat} value={h.originPort} mandatory={!h.customsOnly} onText={v => set('originPort')(v.toUpperCase())} onPick={p => set('originPort')(p.code + ' - ' + p.name)} /></F>
                <F label="Destination Port" required={!h.customsOnly} span={2}><Look what={portWhat} value={h.destinationPort} mandatory={!h.customsOnly} onText={v => set('destinationPort')(v.toUpperCase())} onPick={p => set('destinationPort')(p.code + ' - ' + p.name)} /></F>
                <F label={imp ? 'Discharge Port' : 'Port of Loading'} span={2}><Look what={portWhat} value={h.dischargePort} onText={v => set('dischargePort')(v.toUpperCase())} onPick={p => set('dischargePort')(p.code + ' - ' + p.name)} /></F>
                <F label="Clearance At" span={2}><Look what="port" value={h.clearanceAt} onText={v => set('clearanceAt')(v.toUpperCase())} onPick={p => set('clearanceAt')(p.code + ' - ' + p.name)} /></F>
                {imp && <F label="Destuffing At" span={2}><Look what="warehouse" value={h.data.destuffAt} upper onText={setD('destuffAt')} onPick={w => setD('destuffAt')(w.code + ' - ' + w.name)} placeholder="CFS / warehouse" /></F>}
              </div>
            </Box>
            {air ? (
              <Box pad={8} title={'Dimension Details' + (h.dimensions.length ? ' - volume weight ' + volWt + ' kg, ' + cbm + ' CBM' : '')}>
                <div style={grid(7)}>
                  <F label="Length"><input style={inputStyle} value={dim.l} onChange={e => setDim({ ...dim, l: e.target.value })} /></F>
                  <F label="Width"><input style={inputStyle} value={dim.w} onChange={e => setDim({ ...dim, w: e.target.value })} /></F>
                  <F label="Height"><input style={inputStyle} value={dim.h} onChange={e => setDim({ ...dim, h: e.target.value })} /></F>
                  <F label="Pkgs"><input style={inputStyle} value={dim.p} onChange={e => setDim({ ...dim, p: e.target.value })} /></F>
                  <F label="Unit"><select style={inputStyle} value={dim.unit} onChange={e => setDim({ ...dim, unit: e.target.value })}><option value="CM">Centimeter</option><option value="IN">Inch</option></select></F>
                  <Btn kind="primary" onClick={() => { if (!(n(dim.l) && n(dim.w) && n(dim.h) && n(dim.p))) { setMsg({ bad: true, t: 'Length, width, height and pkgs are required' }); return; } setH(o => ({ ...o, dimensions: [...o.dimensions, dim] })); setDim({ ...dim, l: '', w: '', h: '', p: '' }); }}><Plus size={12} /> Add</Btn>
                </div>
                {h.dimensions.length > 0 && <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{h.dimensions.map((d, i) => <span key={i} style={{ border: `1px solid ${T.headBorder}`, borderRadius: 6, padding: '2px 7px', fontSize: 11, background: '#fff' }}>{d.l} x {d.w} x {d.h} {d.unit.toLowerCase()} x {d.p} <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => setH(o => ({ ...o, dimensions: o.dimensions.filter((_, j) => j !== i) }))}><X size={10} /></span></span>)}</div>}
              </Box>
            ) : (
              <Box pad={8} title={'Container Details (' + h.containers.length + ')'}>
                <div style={grid(7)}>
                  <F label="Container No" span={2}><input style={inputStyle} value={cn.no} onChange={e => setCn({ ...cn, no: e.target.value.toUpperCase() })} placeholder="ABCU1234567" /></F>
                  <F label="Size"><select style={inputStyle} value={cn.size} onChange={e => setCn({ ...cn, size: e.target.value })}>{['20', '40', '40HC', '45'].map(o => <option key={o}>{o}</option>)}</select></F>
                  <F label="Type"><select style={inputStyle} value={cn.type} onChange={e => setCn({ ...cn, type: e.target.value })}>{['GP', 'HC', 'RF', 'OT', 'FR', 'TK', 'LCL'].map(o => <option key={o}>{o}</option>)}</select></F>
                  <F label="Seal No"><input style={inputStyle} value={cn.seal} onChange={e => setCn({ ...cn, seal: e.target.value.toUpperCase() })} /></F>
                  <F label="Pkgs"><input style={inputStyle} value={cn.pkgs} onChange={e => setCn({ ...cn, pkgs: e.target.value })} /></F>
                  <Btn kind="primary" onClick={() => { if (!/^[A-Z]{4}\d{7}$/.test(cn.no)) { setMsg({ bad: true, t: 'Container no should be 4 letters + 7 digits' }); return; } if (h.containers.some(c => c.no === cn.no)) { setMsg({ bad: true, t: cn.no + ' is already added' }); return; } setH(o => ({ ...o, containers: [...o.containers, cn] })); setCn({ ...cn, no: '', seal: '', pkgs: '' }); }}><Plus size={12} /> Add</Btn>
                </div>
                {h.containers.length > 0 && <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{h.containers.map((c, i) => <span key={i} style={{ border: `1px solid ${T.headBorder}`, borderRadius: 6, padding: '2px 7px', fontSize: 11, background: '#fff' }}><b>{c.no}</b> {c.size}{c.type} {c.seal ? 'seal ' + c.seal : ''} {c.pkgs ? c.pkgs + ' pkgs' : ''} <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => setH(o => ({ ...o, containers: o.containers.filter((_, j) => j !== i) }))}><X size={10} /></span></span>)}</div>}
              </Box>
            )}
            <Box pad={8} title="Other Details">
              <div style={grid(4)}>
                <F label="Docket Owner"><Look what="user" value={h.docketOwner} onText={set('docketOwner')} onPick={u => set('docketOwner')(u.name)} /></F>
                <F label="Reference No/PO"><input style={inputStyle} value={h.referenceNo} onChange={set('referenceNo')} /></F>
                <F label="Marketing Person"><Look what="salesperson" value={h.marketingPerson} onText={set('marketingPerson')} onPick={u => set('marketingPerson')(u.name)} /></F>
                <F label="Quotation / Contract"><Look what="quotation" value={h.quotationNo} onText={set('quotationNo')} onPick={qt => set('quotationNo')(qt.code)} noAdd placeholder="blank = customer's contract" /></F>
                <F label="Ass. Value"><input style={inputStyle} value={h.data.assValue} onChange={setD('assValue')} /></F>
                <F label="Total Duty"><input style={inputStyle} value={h.data.totalDuty} onChange={setD('totalDuty')} /></F>
                <F label="Place of Supply"><Look what="state" value={h.placeOfSupply} upper onText={set('placeOfSupply')} onPick={st => set('placeOfSupply')(st.name)} placeholder="state (GST)" noAdd /></F>
                <div style={{ display: 'flex', gap: 12 }}><Chk label="BRO" checked={h.data.bro} onChange={setD('bro')} /><Chk label="Approval Verified" checked={h.data.approvalVerified} onChange={setD('approvalVerified')} /></div>
                <F label="Remarks" span={4}><input style={inputStyle} value={h.remarks} onChange={set('remarks')} /></F>
              </div>
            </Box>
          </div>
          <ActionBar note={msg && <span style={{ color: msg.bad ? T.dr : msg.ok ? T.cr : T.inkSoft, fontWeight: 700 }}>{msg.t}</span>}>
            <Btn kind="save" onClick={save} disabled={busy || h.stage === 'Cancelled'}><Save size={13} /> {busy ? 'Saving' : id ? 'Save changes' : 'Save'}</Btn>
            <Btn kind="plain" onClick={() => setTab('search')}><Pencil size={13} /> Modify</Btn>
            <Btn kind="plain" onClick={duplicate} disabled={!id}><Copy size={13} /> Duplicate</Btn>
            <Btn kind="plain" onClick={() => setTab('cost')} disabled={!id}><FileText size={13} /> Cost Sheet</Btn>
            <Btn kind="plain" onClick={() => setTab('docs')} disabled={!id} title="Attach the papers of this docket"><Paperclip size={13} /> Upload Docs</Btn>
            <Btn kind="plain" onClick={() => setTab('status')} disabled={!id} title="Status update and the status mail to the customer"><Mail size={13} /> Status / Mail</Btn>
            <Btn kind="clear" onClick={clear}><RotateCcw size={13} /> Clear</Btn>
            {id && <Btn kind="danger" onClick={del} disabled={busy}><Trash2 size={13} /> Delete</Btn>}
            {/* 08-Nov-2026: GST Invoice button removed from Shipment Registration (user's choice) - invoices are made in Accounts */}
            {id && h.ediJobNo && <Btn kind="ghost" onClick={async () => { try { const r = await postJson(BASE + '/' + id + '/sync-customs', {}); const x2 = await api(BASE + '/' + id); setH(o => ({ ...o, currentStatus: x2.currentStatus })); setMsg({ ok: true, t: r.milestones + ' customs milestone(s) taken from job ' + h.ediJobNo }); } catch (e) { setMsg({ bad: true, t: e.message }); } }}><Upload size={12} /> Customs status</Btn>}
            {invoices.length > 0 && <span style={{ fontSize: 11, color: T.muted }}>Billed: {invoices.map(i => i.invoiceNo + ' (' + inr(i.total) + ')').join(', ')}</span>}
          </ActionBar>
        </>}
        {tab === 'search' && <SearchTab div={div} D={D} L={L} branch={h.branchCode || myBranch} onOpen={(r) => open(r.id)} />}
        {tab === 'recv' && needDocket(<ReceivingTab sid={id} imp={imp} />)}
        {tab === 'status' && needDocket(<StatusTab sid={id} docketNo={h.docketNo} levels={meta ? meta.statusLevels[div] : []} onChanged={() => api(BASE + '/' + id).then(r => setH(o => ({ ...o, currentStatus: r.currentStatus, stage: r.stage })))} />)}
        {tab === 'stage' && <StageTab div={div} L={L} branch={h.branchCode || myBranch} stages={meta ? meta.stages : []} onChanged={() => id && api(BASE + '/' + id).then(r => setH(o => ({ ...o, stage: r.stage, currentStatus: r.currentStatus }))).catch(() => null)} />}
        {tab === 'activity' && needDocket(<ActivityTab sid={id} />)}
        {tab === 'cost' && needDocket(<ProvisionalSheet key={h.docketNo} jobNo={h.docketNo} partyName={h.billingParty || h.mainParty} embedded />)}
        {tab === 'due' && <DueTab sid={id} docketNo={h.docketNo} div={div} branch={h.branchCode || myBranch} types={meta ? meta.dueTypes : []} />}
        {tab === 'docs' && needDocket(<><FilesPanel sid={id} names={meta ? meta.docList[D.side] : []} /><DocListTab sid={id} list={meta ? meta.docList[D.side] : []} docs={h.docs} onSaved={(docs) => setH(o => ({ ...o, docs }))} /></>)}
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------ Search (iCAFFE columns)
function SearchTab({ div, D, L, branch, onOpen }) {
  const [f, setF] = useState({ from: fyStartIso(), to: todayIso(), stage: '', ediJobNo: '', docketNo: '', mainParty: '', subAgent: '', otherParty: '', overseasAgent: '', originPort: '', destinationPort: '', referenceNo: '', mawbNo: '', hawbNo: '', docketOwner: '', createdBy: '', poNo: '' });
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const [color, setColor] = useState('all');
  const run = async () => { setErr(''); const qs = new URLSearchParams({ division: div, branch }); Object.entries(f).forEach(([k, v]) => v && qs.set(k, v)); try { setRows(await api(BASE + '?' + qs.toString())); } catch (e) { setErr(e.message); setRows([]); } };
  useEffect(() => { run(); }, [div]);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const imp = L.gm === 'IGM';   // 08-Nov-2026: import grid shows the Bill of Entry, export the Shipping Bill
  const one = (v, w) => <span title={v || ''} style={{ display: 'inline-block', maxWidth: w, overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>{v || ''}</span>;
  const list = (rows || []).filter(r => color === 'all' || (color === 'none' ? !r.currentStatus : color === 'some' ? !!r.currentStatus && r.stage !== 'Complete' : true));
  return (
    <>
      <Box pad={8} title="Search">
        <div style={grid(8)}>
          <F label="From"><input type="date" style={inputStyle} value={f.from} onChange={s('from')} /></F>
          <F label="To"><input type="date" style={inputStyle} value={f.to} onChange={s('to')} /></F>
          <F label="Operation Type"><select style={inputStyle} value={f.stage} onChange={s('stage')}><option value="">Select</option>{['Hand Over To Carrier', 'Register', 'Cancelled', 'Complete'].map(o => <option key={o}>{o}</option>)}</select></F>
          <F label="EDI Job No"><input style={inputStyle} value={f.ediJobNo} onChange={s('ediJobNo')} /></F>
          {[['docketNo', 'Docket No'], ['mainParty', L.main], ['subAgent', 'Sub Agt'], ['otherParty', L.other], ['overseasAgent', 'OverSeas Agt'], ['originPort', 'Origin Port'], ['destinationPort', 'Dstn Port'], ['referenceNo', 'Reference No.'],
            ['mawbNo', L.m + ' No.'], ['hawbNo', L.hs + ' No'], ['docketOwner', 'Docket Owner'], ['createdBy', 'Entered By'], ['poNo', 'Po No.']].map(([k, l]) => <F key={k} label={l}><input style={inputStyle} value={f[k]} onChange={s(k)} onKeyDown={e => e.key === 'Enter' && run()} /></F>)}
          <div style={{ display: 'flex', gap: 6 }}><Btn kind="primary" onClick={run}><Search size={13} /> Search</Btn></div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>{[['all', 'ALL'], ['some', 'Status updated, not complete'], ['none', 'No Status Updated']].map(([k, l]) => <Btn key={k} small kind={color === k ? 'primary' : 'ghost'} onClick={() => setColor(k)}>{l}</Btn>)}</div>
        {err && <div style={{ color: T.dr, fontWeight: 700 }}>{err}</div>}
      </Box>
      <Grid title={D.label + ' Shipments (' + list.length + ')' + ((rows || []).length >= 500 ? ' - only the latest 500; narrow the dates or filters' : '')} maxHeight={460} minHeight={200} onRow={onOpen} empty={rows ? 'No docket for this search' : 'Loading'} rowKey={r => r.id}
        cols={[
          { label: 'Docket Date', render: r => fmtDate(r.docketDate) }, { label: 'Docket No', render: r => <b style={{ color: T.head }}>{r.docketNo}</b> }, { label: 'EDI Job No', key: 'ediJobNo' },
          // 08-Nov-2026: every cell on one line (no wrapping); Bill of Entry no./date after the EDI job
          { label: imp ? 'BE No' : 'SB No', render: r => (imp ? r.beNo : r.sbNo) || '' }, { label: imp ? 'BE Date' : 'SB Date', render: r => fmtDate(imp ? r.beDate : r.sbDate) },
          { label: L.main, key: 'mainParty' }, { label: L.other, key: 'otherParty' }, { label: 'No Of Pkgs', right: true, key: 'pkgs' }, { label: 'Gross Weight', right: true, key: 'grossWeight' },
          { label: 'Over Seas Agent', key: 'overseasAgent' }, { label: 'Sub Agent', key: 'subAgent' }, { label: 'Type', key: 'houseType' },
          { label: 'Status', render: r => <Badge tone={r.stage === 'Cancelled' ? 'bad' : r.stage === 'Complete' ? 'ok' : 'brand'}>{r.stage || 'Register'}</Badge> }, { label: 'Current Status', key: 'currentStatus' },
          { label: 'Job Type', key: 'jobType' }, { label: L.hs + ' No', key: 'hawbNo' }, { label: L.hs + ' Date', render: r => fmtDate(r.hawbDate) }, { label: L.m + ' No', key: 'mawbNo' }, { label: L.m + ' Date', render: r => fmtDate(r.mawbDate) },
          { label: 'Chargeable Weight', right: true, key: 'chargeableWeight' }, { label: 'Origin Port', key: 'originPort' }, { label: 'Destination', key: 'destinationPort' }, { label: 'Discharge Port', key: 'dischargePort' },
          { label: 'Clearance At', key: 'clearanceAt' }, { label: 'Docket Owner', key: 'docketOwner' }, { label: 'Remark', render: r => one(r.remarks, 280) }, { label: 'Shipment Term', key: 'shipmentTerm' },
          { label: 'Entered By', key: 'createdBy' }, { label: 'Entered Date', render: r => fmtDate(r.createdAt) }, { label: 'Modified By', key: 'modifiedBy' }, { label: 'Modify Date', render: r => (r.modifiedBy ? fmtDate(r.updatedAt) : '') }]}
        rows={list} />
    </>
  );
}

// ------------------------------------------------------------------ events (shared loader)
function useEvents(sid) {
  const [ev, setEv] = useState([]); const load = () => sid && api(BASE + '/' + sid + '/events').then(setEv).catch(() => setEv([]));
  useEffect(() => { load(); }, [sid]); return [ev, load];
}
const saveEv = (sid, body) => postJson(BASE + '/' + sid + '/events', body);
const delEv = (sid, eid) => api(BASE + '/' + sid + '/events/' + eid, { method: 'DELETE' });
const nowTime = () => new Date().toTimeString().slice(0, 5);

function ReceivingTab({ sid, imp }) {
  const [ev, load] = useEvents(sid); const [msg, setMsg] = useState(null);
  const [inv, setInv] = useState({ title: '', date: '', currency: 'USD', value: '', payMode: '', recDate: todayIso(), recTime: nowTime() });
  const [boe, setBoe] = useState({ title: '', date: '', recDate: todayIso(), recTime: nowTime() });
  const [doc, setDoc] = useState({ title: '', no: '', recDate: todayIso(), recTime: nowTime() });
  const add = async (kind, o, data) => { try { await saveEv(sid, { kind, title: o.title, eventDate: o.recDate, eventTime: o.recTime, data }); setMsg(null); load(); return true; } catch (e) { setMsg({ bad: true, t: e.message }); return false; } };
  const del = (e) => window.confirm('Remove ' + e.title + '?') && delEv(sid, e.id).then(load);
  const list = (k) => ev.filter(e => e.kind === k);
  const DelCell = { label: '', render: e => <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => del(e)}><Trash2 size={12} /></span> };
  return (
    <>
      <Box pad={8} title="Invoice Details">
        <div style={grid(9)}>
          <F label="Invoice No" required><input style={inv.title ? inputStyle : mandStyle} value={inv.title} onChange={e => setInv({ ...inv, title: e.target.value })} /></F>
          <F label="Invoice Date"><input type="date" style={inputStyle} value={inv.date} onChange={e => setInv({ ...inv, date: e.target.value })} /></F>
          <F label="Currency"><Look what="currency" value={inv.currency} upper onText={v => setInv({ ...inv, currency: v })} onPick={c => setInv({ ...inv, currency: c.code })} noAdd /></F>
          <F label="Value"><input style={inputStyle} value={inv.value} onChange={e => setInv({ ...inv, value: e.target.value })} /></F>
          <F label="Pay Mode"><select style={inputStyle} value={inv.payMode} onChange={e => setInv({ ...inv, payMode: e.target.value })}><option value="">Select</option>{['Advance', 'DP', 'DA', 'LC', 'TT', 'FOC', 'Others'].map(o => <option key={o}>{o}</option>)}</select></F>
          <F label="Receiving Date"><input type="date" style={inputStyle} value={inv.recDate} onChange={e => setInv({ ...inv, recDate: e.target.value })} /></F>
          <F label="Time"><input type="time" style={inputStyle} value={inv.recTime} onChange={e => setInv({ ...inv, recTime: e.target.value })} /></F>
          <Btn kind="primary" onClick={async () => { if (await add('recv_invoice', inv, { invoiceDate: inv.date, currency: inv.currency, value: inv.value, payMode: inv.payMode })) setInv({ ...inv, title: '', date: '', value: '' }); }}><Plus size={12} /> Add</Btn>
        </div>
      </Box>
      <Grid maxHeight={150} empty="No invoice received yet" rows={list('recv_invoice')} cols={[{ label: 'Invoice No', key: 'title' }, { label: 'Invoice Date', render: e => fmtDate(e.data.invoiceDate) }, { label: 'Currency', render: e => e.data.currency }, { label: 'Value', right: true, render: e => inr(e.data.value) }, { label: 'Pay Mode', render: e => e.data.payMode }, { label: 'Received Date', render: e => fmtDate(e.eventDate) }, { label: 'Received Time', key: 'eventTime' }, DelCell]} />
      <Box pad={8} title={imp ? 'BOE Details' : 'Shipping Bill Details'}>
        <div style={grid(9)}>
          <F label={imp ? 'BOE No' : 'SB No'} required><input style={boe.title ? inputStyle : mandStyle} value={boe.title} onChange={e => setBoe({ ...boe, title: e.target.value })} /></F>
          <F label={imp ? 'BOE Date' : 'SB Date'}><input type="date" style={inputStyle} value={boe.date} onChange={e => setBoe({ ...boe, date: e.target.value })} /></F>
          <F label="Receiving Date"><input type="date" style={inputStyle} value={boe.recDate} onChange={e => setBoe({ ...boe, recDate: e.target.value })} /></F>
          <F label="Time"><input type="time" style={inputStyle} value={boe.recTime} onChange={e => setBoe({ ...boe, recTime: e.target.value })} /></F>
          <Btn kind="primary" onClick={async () => { if (await add('recv_boe', boe, { docDate: boe.date })) setBoe({ ...boe, title: '', date: '' }); }}><Plus size={12} /> Add</Btn>
        </div>
      </Box>
      <Grid maxHeight={150} empty="Nothing yet" rows={list('recv_boe')} cols={[{ label: imp ? 'BOE No' : 'SB No', key: 'title' }, { label: 'Date', render: e => fmtDate(e.data.docDate) }, { label: 'Received Date', render: e => fmtDate(e.eventDate) }, { label: 'Received Time', key: 'eventTime' }, DelCell]} />
      <Box pad={8} title="Document Details">
        <div style={grid(9)}>
          <F label="Doc. Name" required span={2}><input style={doc.title ? inputStyle : mandStyle} value={doc.title} onChange={e => setDoc({ ...doc, title: e.target.value })} /></F>
          <F label="Document No"><input style={inputStyle} value={doc.no} onChange={e => setDoc({ ...doc, no: e.target.value })} /></F>
          <F label="Receiving Date"><input type="date" style={inputStyle} value={doc.recDate} onChange={e => setDoc({ ...doc, recDate: e.target.value })} /></F>
          <F label="Time"><input type="time" style={inputStyle} value={doc.recTime} onChange={e => setDoc({ ...doc, recTime: e.target.value })} /></F>
          <Btn kind="primary" onClick={async () => { if (await add('recv_doc', doc, { docNo: doc.no })) setDoc({ ...doc, title: '', no: '' }); }}><Plus size={12} /> Add</Btn>
        </div>
      </Box>
      <Grid maxHeight={150} empty="Nothing yet" rows={list('recv_doc')} cols={[{ label: 'Document Name', key: 'title' }, { label: 'Document No', render: e => e.data.docNo }, { label: 'Received Date', render: e => fmtDate(e.eventDate) }, { label: 'Received Time', key: 'eventTime' }, DelCell]} />
      {msg && <div style={{ color: T.dr, fontWeight: 700 }}>{msg.t}</div>}
    </>
  );
}

function StatusTab({ sid, docketNo, levels, onChanged }) {
  const [mail, setMail] = useState(false);
  const [ev, load] = useEvents(sid); const [edit, setEdit] = useState({}); const [msg, setMsg] = useState(null);
  const got = (lvl) => ev.find(e => e.kind === 'status' && e.title === lvl);
  const save = async (lvl) => {
    const e = edit[lvl] || {}; const old = got(lvl);
    if (!(e.date || (old && old.eventDate))) { setMsg({ bad: true, t: 'Status date is required for ' + lvl }); return; }
    try { await saveEv(sid, { kind: 'status', id: old ? old.id : undefined, title: lvl, eventDate: e.date || old.eventDate, eventTime: e.time != null ? e.time : old ? old.eventTime : '', remarks: e.remarks != null ? e.remarks : old ? old.remarks : '' });
      setEdit({ ...edit, [lvl]: undefined }); setMsg({ ok: true, t: lvl + ' saved' }); load(); onChanged && onChanged(); } catch (er) { setMsg({ bad: true, t: er.message }); }
  };
  return (
    <>
    <Box pad={0} title="Shipment Status" right={<>{msg && <span style={{ color: msg.bad ? T.dr : T.cr, fontWeight: 700, marginRight: 8 }}>{msg.t}</span>}<Btn small kind="primary" onClick={() => setMail(!mail)}><Mail size={11} /> Send Mail</Btn></>}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Level', 'Day', 'Status Date', 'Status Time', 'Remark', 'User', ''].map(x2 => <th key={x2} style={{ background: '#f8fafc', textAlign: 'left' }}>{x2}</th>)}</tr></thead>
        <tbody>{levels.map((lvl, i) => { const o = got(lvl); const e = edit[lvl] || {}; const d = e.date != null ? e.date : o ? o.eventDate : '';
          return (
            <tr key={lvl} style={{ borderTop: '1px solid #f1f5f9', background: o ? '#f0fdf4' : '#fff' }}>
              <td style={{ fontWeight: 700 }}>{i + 1}. {lvl}</td><td style={{ color: T.muted }}>{d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }) : ''}</td>
              <td><input type="date" style={{ ...inputStyle, width: 140 }} value={d || ''} onChange={ev2 => setEdit({ ...edit, [lvl]: { ...e, date: ev2.target.value } })} /></td>
              <td><input type="time" style={{ ...inputStyle, width: 100 }} value={e.time != null ? e.time : o ? o.eventTime || '' : ''} onChange={ev2 => setEdit({ ...edit, [lvl]: { ...e, time: ev2.target.value } })} /></td>
              <td><input style={inputStyle} value={e.remarks != null ? e.remarks : o ? o.remarks || '' : ''} onChange={ev2 => setEdit({ ...edit, [lvl]: { ...e, remarks: ev2.target.value } })} /></td>
              <td style={{ fontSize: 11, color: T.muted }}>{o ? o.modifiedBy || o.createdBy || '' : ''}</td>
              <td style={{ whiteSpace: 'nowrap' }}><Btn small kind={edit[lvl] ? 'save' : 'ghost'} onClick={() => save(lvl)}><Save size={11} /> Save</Btn>{o && <span style={{ cursor: 'pointer', color: T.dr, marginLeft: 6 }} onClick={() => window.confirm('Remove the status ' + lvl + '?') && delEv(sid, o.id).then(() => { load(); onChanged && onChanged(); })}><Trash2 size={12} /></span>}</td>
            </tr>); })}</tbody>
      </table>
    </Box>
    {mail && <StatusMail sid={sid} docketNo={docketNo} onClose={() => setMail(false)} />}
    </>
  );
}

function StageTab({ div, L, branch, stages, onChanged }) {
  const [f, setF] = useState({ from: fyStartIso(), to: todayIso(), stage: 'Register', docketNo: '', party: '', originPort: '', destinationPort: '' });
  const [rows, setRows] = useState([]); const [sel, setSel] = useState({}); const [op, setOp] = useState(''); const [reason, setReason] = useState(''); const [msg, setMsg] = useState(null);
  const run = async () => { const qs = new URLSearchParams({ division: div, branch, from: f.from, to: f.to }); if (f.stage) qs.set('stage', f.stage); if (f.docketNo) qs.set('docketNo', f.docketNo); if (f.party) qs.set('mainParty', f.party); if (f.originPort) qs.set('originPort', f.originPort); if (f.destinationPort) qs.set('destinationPort', f.destinationPort);
    try { setRows(await api(BASE + '?' + qs.toString())); setSel({}); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  useEffect(() => { run(); }, [div]);
  const ids = rows.filter(r => sel[r.id]).map(r => r.id);
  const go = async () => { if (!op) { setMsg({ bad: true, t: 'Choose the Operation Type' }); return; }
    try { const r = await postJson(BASE + '/stage', { ids, stage: op, reason }); setMsg({ ok: !r.skipped.length, bad: !!r.skipped.length, t: (r.done.length ? op + ': ' + r.done.join(', ') : '') + (r.skipped.length ? (r.done.length ? '. ' : '') + 'Not changed: ' + r.skipped.join('; ') : '') }); run(); onChanged && onChanged(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Box pad={8} title="Complete / Cancel">
        <div style={grid(8)}>
          <F label="Operation Type" required><select style={op ? inputStyle : mandStyle} value={op} onChange={e => setOp(e.target.value)}><option value="">Select</option>{stages.map(o => <option key={o}>{o}</option>)}</select></F>
          {op === 'Cancelled' && <F label="Reason" required span={3}><input style={reason ? inputStyle : mandStyle} value={reason} onChange={e => setReason(e.target.value)} /></F>}
          <Btn kind="save" onClick={go} disabled={!ids.length}><Save size={13} /> Save ({ids.length})</Btn>
          {msg && <span style={{ gridColumn: 'span 3', fontWeight: 700, color: msg.bad ? T.dr : T.cr, fontSize: 11 }}>{msg.t}</span>}
        </div>
      </Box>
      <Box pad={8} title="Search Panel">
        <div style={grid(8)}>
          <F label="From Date"><input type="date" style={inputStyle} value={f.from} onChange={s('from')} /></F>
          <F label="To Date"><input type="date" style={inputStyle} value={f.to} onChange={s('to')} /></F>
          <F label="Docket Stage"><select style={inputStyle} value={f.stage} onChange={s('stage')}><option value="">All</option>{stages.map(o => <option key={o}>{o}</option>)}</select></F>
          <F label="Docket No"><input style={inputStyle} value={f.docketNo} onChange={s('docketNo')} /></F>
          <F label={L.main}><input style={inputStyle} value={f.party} onChange={s('party')} /></F>
          <F label="Origin Port"><input style={inputStyle} value={f.originPort} onChange={s('originPort')} /></F>
          <F label="Dstn Port"><input style={inputStyle} value={f.destinationPort} onChange={s('destinationPort')} /></F>
          <Btn kind="primary" onClick={run}><Search size={13} /> Search</Btn>
        </div>
      </Box>
      <Grid title={'Shipment Details (' + rows.length + ')' + (rows.length >= 500 ? ' - only the latest 500; narrow the dates or filters' : '')} maxHeight={380} minHeight={160} rowKey={r => r.id} onRow={r => setSel({ ...sel, [r.id]: !sel[r.id] })} empty="No docket"
        cols={[{ label: <input type="checkbox" checked={rows.length > 0 && ids.length === rows.length} onChange={e => setSel(e.target.checked ? Object.fromEntries(rows.map(r => [r.id, true])) : {})} />, render: r => <input type="checkbox" readOnly checked={!!sel[r.id]} /> },
          { label: 'Docket Date', render: r => fmtDate(r.docketDate) }, { label: 'Docket No', render: r => <b>{r.docketNo}</b> }, { label: 'Status', render: r => <Badge tone={r.stage === 'Cancelled' ? 'bad' : r.stage === 'Complete' ? 'ok' : 'brand'}>{r.stage || 'Register'}</Badge> },
          { label: L.main, key: 'mainParty', wrap: true }, { label: L.m, key: 'mawbNo' }, { label: L.hs, key: 'hawbNo' }, { label: 'Current Status', key: 'currentStatus' }]} rows={rows} />
    </>
  );
}

function ActivityTab({ sid }) {
  const [ev, load] = useEvents(sid); const [f, setF] = useState({ title: '', date: todayIso(), time: nowTime(), remarks: '' }); const [msg, setMsg] = useState(null); const [done, setDone] = useState(null);
  const acts = ev.filter(e => e.kind === 'activity');
  const add = async () => { try { await saveEv(sid, { kind: 'activity', title: f.title, eventDate: f.date, eventTime: f.time, remarks: f.remarks, status: 'Pending' }); setF({ ...f, title: '', remarks: '' }); load(); setMsg(null); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  const complete = async () => { try { await saveEv(sid, { kind: 'activity', id: done.id, title: done.title, eventDate: done.eventDate, eventTime: done.eventTime, doneDate: done.doneDate, doneTime: done.doneTime, remarks: done.remarks, status: 'Done' }); setDone(null); load(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  return (
    <>
      <Grid title={'Activity List (' + acts.length + ')'} maxHeight={300} minHeight={140} rows={acts} rowKey={r => r.id} onRow={r => r.status !== 'Done' && setDone({ ...r, doneDate: todayIso(), doneTime: nowTime() })} empty="No activity yet"
        cols={[{ label: 'User', render: r => r.createdBy || '' }, { label: 'Activity', render: r => <b>{r.title}</b> }, { label: 'Activity Date', render: r => fmtDate(r.eventDate) }, { label: 'Activity Time', key: 'eventTime' }, { label: 'Remarks', key: 'remarks', wrap: true },
          { label: 'Complete Date', render: r => fmtDate(r.doneDate) }, { label: 'Complete Time', key: 'doneTime' }, { label: 'Status', render: r => <Badge tone={r.status === 'Done' ? 'ok' : 'warn'}>{r.status || 'Pending'}</Badge> }]} />
      {done && (
        <Box pad={8} title={'Update Pending Activity - ' + done.title} right={<Btn small kind="ghost" onClick={() => setDone(null)}><X size={11} /> Close</Btn>}>
          <div style={grid(6)}>
            <F label="Activity Complete Date"><input type="date" style={inputStyle} value={done.doneDate} onChange={e => setDone({ ...done, doneDate: e.target.value })} /></F>
            <F label="Time"><input type="time" style={inputStyle} value={done.doneTime} onChange={e => setDone({ ...done, doneTime: e.target.value })} /></F>
            <F label="Remarks" span={3}><input style={inputStyle} value={done.remarks || ''} onChange={e => setDone({ ...done, remarks: e.target.value })} /></F>
            <Btn kind="save" onClick={complete}><CheckCircle2 size={13} /> Save</Btn>
          </div>
        </Box>
      )}
      <Box pad={8} title="New Activity">
        <div style={grid(6)}>
          <F label="Activity" required span={2}><input style={f.title ? inputStyle : mandStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Follow up importer for documents" /></F>
          <F label="Date"><input type="date" style={inputStyle} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></F>
          <F label="Time"><input type="time" style={inputStyle} value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></F>
          <F label="Remarks"><input style={inputStyle} value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></F>
          <Btn kind="primary" onClick={add}><Plus size={12} /> Add</Btn>
        </div>
        {msg && <div style={{ color: T.dr, fontWeight: 700, marginTop: 4 }}>{msg.t}</div>}
      </Box>
    </>
  );
}

function DueTab({ sid, docketNo, div, branch, types }) {
  const [ev, load] = useEvents(sid); const [f, setF] = useState({ title: '', date: todayIso(), remarks: '' }); const [msg, setMsg] = useState(null); const [all, setAll] = useState([]);
  const loadAll = () => api(`${BASE}/due?division=${div}&branch=${encodeURIComponent(branch)}`).then(setAll).catch(() => setAll([]));
  useEffect(() => { loadAll(); }, [div]);
  const dues = ev.filter(e => e.kind === 'duedate');
  const add = async () => { if (!f.title) { setMsg({ bad: true, t: 'Select Document Type' }); return; } try { await saveEv(sid, { kind: 'duedate', title: f.title, eventDate: f.date, remarks: f.remarks, status: 'Open' }); load(); loadAll(); setMsg(null); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  const mark = async (e) => { await saveEv(sid, { kind: 'duedate', id: e.id, title: e.title, eventDate: e.eventDate, remarks: e.remarks, status: e.status === 'Done' ? 'Open' : 'Done' }); load(); loadAll(); };
  const late = (d) => d && d < todayIso();
  return (
    <>
      {sid && <Box pad={8} title={'Set Due Dates for Documents - ' + docketNo}>
        <div style={grid(6)}>
          <F label="Select Document Type" required span={2}><select style={f.title ? inputStyle : mandStyle} value={f.title} onChange={e => setF({ ...f, title: e.target.value })}><option value="">Select Document Type</option>{types.map(o => <option key={o}>{o}</option>)}</select></F>
          <F label="Due Date"><input type="date" style={inputStyle} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></F>
          <F label="Remarks" span={2}><input style={inputStyle} value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></F>
          <Btn kind="save" onClick={add}><Save size={13} /> Set Due Date</Btn>
        </div>
        {msg && <div style={{ color: T.dr, fontWeight: 700, marginTop: 4 }}>{msg.t}</div>}
      </Box>}
      {sid && <Grid title="Due Date" maxHeight={220} minHeight={100} rows={dues} rowKey={r => r.id} empty="No due date set"
        cols={[{ label: 'Docket No', render: () => docketNo }, { label: 'Bill Type', render: r => <b>{r.title}</b> }, { label: 'Due Date', render: r => <span style={{ color: r.status !== 'Done' && late(r.eventDate) ? T.dr : undefined, fontWeight: 700 }}>{fmtDate(r.eventDate)}</span> }, { label: 'Remarks', key: 'remarks' },
          { label: 'Enter By', key: 'createdBy' }, { label: 'Enter Date', render: r => fmtDate(r.createdAt) }, { label: 'Modified By', key: 'modifiedBy' }, { label: 'Modified Date', render: r => (r.modifiedBy ? fmtDate(r.updatedAt) : '') },
          { label: '', render: r => <Btn small kind={r.status === 'Done' ? 'ghost' : 'plain'} onClick={() => mark(r)}>{r.status === 'Done' ? 'Re-open' : 'Mark done'}</Btn> }, { label: '', render: r => <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => window.confirm('Remove the due date ' + r.title + '?') && delEv(sid, r.id).then(() => { load(); loadAll(); })}><Trash2 size={12} /></span> }]} />}
      <Grid title={'Open due dates - all dockets of this division (' + all.length + ')'} maxHeight={260} rows={all} rowKey={r => r.id} empty="Nothing due"
        cols={[{ label: 'Due Date', render: r => <span style={{ color: late(r.eventDate) ? T.dr : undefined, fontWeight: 700 }}>{fmtDate(r.eventDate)}</span> }, { label: 'Docket No', render: r => <b>{r.docketNo}</b> }, { label: 'Party', key: 'mainParty' }, { label: 'Bill Type', key: 'title' }, { label: 'Remarks', key: 'remarks' }]} />
    </>
  );
}

function DocListTab({ sid, list, docs, onSaved }) {
  const [d, setD] = useState(docs || {}); const [msg, setMsg] = useState(null); const [extra, setExtra] = useState('');
  useEffect(() => { setD(docs || {}); }, [sid]);
  const names = [...new Set([...list, ...Object.keys(d)])];
  const save = async () => { try { await postJson(BASE + '/' + sid + '/doclist', { docs: d }, 'PUT'); onSaved(d); setMsg({ ok: true, t: 'Saved' }); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  return (
    <Box pad={0} title={'Document List - ' + names.filter(x2 => d[x2] && d[x2].status === 'Received').length + ' of ' + names.length + ' received'} right={<>{msg && <span style={{ color: msg.bad ? T.dr : T.cr, fontWeight: 700 }}>{msg.t}</span>}<Btn small kind="save" onClick={save}><Save size={11} /> Save</Btn></>}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Document Name', 'Status', 'Date', 'Remarks'].map(x2 => <th key={x2} style={{ background: '#f8fafc', textAlign: 'left' }}>{x2}</th>)}</tr></thead>
        <tbody>{names.map(nm => { const r = d[nm] || {}; const setR = (k, v) => setD({ ...d, [nm]: { ...r, [k]: v, ...(k === 'status' && v === 'Received' && !r.date ? { date: todayIso() } : {}) } });
          return (
            <tr key={nm} style={{ borderTop: '1px solid #f1f5f9', background: r.status === 'Received' ? '#f0fdf4' : '#fff' }}>
              <td style={{ fontWeight: 700 }}>{nm}</td>
              <td><select style={{ ...inputStyle, width: 130 }} value={r.status || ''} onChange={e => setR('status', e.target.value)}><option value="">Pending</option><option>Received</option><option>Not Applicable</option></select></td>
              <td><input type="date" style={{ ...inputStyle, width: 140 }} value={r.date || ''} onChange={e => setR('date', e.target.value)} /></td>
              <td><input style={inputStyle} value={r.remarks || ''} onChange={e => setR('remarks', e.target.value)} /></td>
            </tr>); })}
          <tr><td colSpan={4} style={{ padding: 6 }}><div style={{ display: 'flex', gap: 6 }}><input style={{ ...inputStyle, width: 260 }} value={extra} onChange={e => setExtra(e.target.value.toUpperCase())} placeholder="Add another document" /><Btn small kind="ghost" onClick={() => { if (extra.trim()) { setD({ ...d, [extra.trim()]: {} }); setExtra(''); } }}><Plus size={11} /> Add</Btn></div></td></tr>
        </tbody>
      </table>
    </Box>
  );
}

// ------------------------------------------------------------------ Sub Pkgs (package break-up, e.g. 10 CTN + 2 PLT)
function SubPkgs({ rows, total, onChange, onClose }) {
  const [r, setR] = useState({ pkgs: '', unit: '' });
  const sum = rows.reduce((t, x2) => t + n(x2.pkgs), 0);
  return (
    <div style={{ border: `1px dashed ${T.headBorder}`, borderRadius: 6, padding: 6, background: '#fafcff' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'end', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 11, alignSelf: 'center' }}>Sub Pkgs</b>
        <F label="Pkgs" style={{ width: 80 }}><input style={inputStyle} value={r.pkgs} onChange={e => setR({ ...r, pkgs: e.target.value })} /></F>
        <F label="Unit (UQC)" style={{ width: 150 }}><Look what="uqc" value={r.unit} upper onText={v => setR({ ...r, unit: v })} onPick={u => setR({ ...r, unit: u.code })} noAdd /></F>
        <Btn small kind="primary" onClick={() => { if (!(n(r.pkgs) > 0) || !r.unit) return; onChange([...rows, r]); setR({ pkgs: '', unit: '' }); }}><Plus size={11} /> Add</Btn>
        {rows.map((x2, i) => <span key={i} style={{ border: `1px solid ${T.headBorder}`, borderRadius: 6, padding: '2px 7px', fontSize: 11, background: '#fff', alignSelf: 'center' }}>{x2.pkgs} {x2.unit} <span style={{ cursor: 'pointer', color: T.dr }} onClick={() => onChange(rows.filter((_, j) => j !== i))}><X size={10} /></span></span>)}
        <span style={{ fontSize: 11, color: rows.length && n(total) && sum !== n(total) ? T.dr : T.muted, alignSelf: 'center' }}>{rows.length ? 'Total ' + sum + ' pkgs (fills No. Of Pkgs)' : 'Break-up of the packages'}</span>
        <span style={{ marginLeft: 'auto', cursor: 'pointer', alignSelf: 'center' }} onClick={onClose}><X size={12} /></span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Send Mail (status mail to the customer)
function StatusMail({ sid, docketNo, onClose }) {
  const [f, setF] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const load = () => api(BASE + '/' + sid + '/mail').then(r => setF(o => ({ to: r.to, cc: '', subject: r.subject, message: '', ...(o || {}), html: r.html, log: r.log }))).catch(e => setMsg({ bad: true, t: e.message }));
  useEffect(() => { load(); }, [sid]);
  const send = async () => { setBusy(true); setMsg(null);
    try { const r = await postJson(BASE + '/' + sid + '/mail', { to: f.to, cc: f.cc, subject: f.subject, message: f.message }); setMsg({ ok: true, t: 'Mail sent to ' + r.to.join(', ') }); load(); } catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false); };
  return (
    <Box pad={8} title={'Send Mail - status of ' + docketNo} right={<Btn small kind="ghost" onClick={onClose}><X size={11} /> Close</Btn>}>
      {!f ? <div style={{ color: T.muted }}>{msg ? msg.t : 'Loading'}</div> : <>
        <div style={grid(6)}>
          <F label="To" required span={3}><input style={f.to ? inputStyle : mandStyle} value={f.to} onChange={e => setF({ ...f, to: e.target.value })} placeholder="from the party master e-mail; comma between two" /></F>
          <F label="CC" span={3}><input style={inputStyle} value={f.cc} onChange={e => setF({ ...f, cc: e.target.value })} /></F>
          <F label="Subject" span={6}><input style={inputStyle} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></F>
          <F label="Message (on top of the status table)" span={6}><textarea style={{ ...inputStyle, height: 50, padding: 6 }} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} /></F>
        </div>
        <div style={{ border: `1px solid ${T.headBorder}`, borderRadius: 6, padding: 8, margin: '6px 0', maxHeight: 260, overflow: 'auto', background: '#fff', fontSize: 12 }} dangerouslySetInnerHTML={{ __html: f.html }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Btn kind="save" onClick={send} disabled={busy}><Mail size={13} /> {busy ? 'Sending' : 'Send Mail'}</Btn>
          {msg && <span style={{ fontWeight: 700, color: msg.bad ? T.dr : T.cr }}>{msg.t}</span>}
        </div>
        {f.log && f.log.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: T.muted }}>Sent before: {f.log.map((l, i) => <div key={i}>{fmtDate(l.eventDate)} {l.eventTime} - {l.remarks}{l.createdBy ? ' (' + l.createdBy + ')' : ''}</div>)}</div>}
      </>}
    </Box>
  );
}

// ------------------------------------------------------------------ Upload Docs (files of the docket)
function FilesPanel({ sid, names }) {
  const [rows, setRows] = useState([]); const [type, setType] = useState(''); const [remarks, setRemarks] = useState(''); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false); const inp = useRef(null);
  const load = () => api(BASE + '/' + sid + '/files').then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, [sid]);
  const upload = async (files) => {
    if (!files || !files.length) return; setBusy(true); setMsg(null);
    try { const fd = new FormData(); [...files].forEach(f => fd.append('files', f)); fd.append('docType', type || 'OTHER'); fd.append('remarks', remarks);
      const r = await api(BASE + '/' + sid + '/files', { method: 'POST', body: fd }); setMsg({ ok: true, t: r.count + ' file(s) uploaded' }); setRemarks(''); load(); }
    catch (e) { setMsg({ bad: true, t: e.message }); }
    setBusy(false); if (inp.current) inp.current.value = '';
  };
  const del = async (f) => { if (!window.confirm('Remove ' + f.originalName + ' from this docket?')) return; try { await api(BASE + '/' + sid + '/files/' + f.id, { method: 'DELETE' }); load(); } catch (e) { setMsg({ bad: true, t: e.message }); } };
  return (
    <Box pad={8} title={'Uploaded Documents (' + rows.length + ')'}>
      <div style={grid(8)}>
        <F label="Document Type" span={2}><select style={inputStyle} value={type} onChange={e => setType(e.target.value)}><option value="">Other</option>{names.map(o => <option key={o}>{o}</option>)}</select></F>
        <F label="Remarks" span={3}><input style={inputStyle} value={remarks} onChange={e => setRemarks(e.target.value)} /></F>
        <input ref={inp} type="file" multiple style={{ display: 'none' }} accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.doc,.docx,.xls,.xlsx,.csv,.txt,.eml,.msg" onChange={e => upload(e.target.files)} />
        <Btn kind="primary" disabled={busy} onClick={() => inp.current && inp.current.click()}><Upload size={13} /> {busy ? 'Uploading' : 'Upload Docs'}</Btn>
        {msg && <span style={{ gridColumn: 'span 2', fontWeight: 700, fontSize: 11, color: msg.bad ? T.dr : T.cr }}>{msg.t}</span>}
      </div>
      {rows.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <thead><tr>{['Document Type', 'File', 'Size', 'Remarks', 'Uploaded By', 'Date', ''].map(x2 => <th key={x2} style={{ background: '#f8fafc', textAlign: 'left' }}>{x2}</th>)}</tr></thead>
        <tbody>{rows.map(f => <tr key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
          <td style={{ fontWeight: 700 }}>{f.docType}</td>
          <td><a href={f.filePath} target="_blank" rel="noreferrer" style={{ color: T.head }}>{f.originalName} <ExternalLink size={10} /></a></td>
          <td>{Math.max(1, Math.round((f.size || 0) / 1024))} KB</td><td>{f.remarks || ''}</td><td>{f.uploadedBy || ''}</td><td>{fmtDate(String(f.createdAt || '').slice(0, 10))}</td>
          <td><span style={{ cursor: 'pointer', color: T.dr }} onClick={() => del(f)}><Trash2 size={12} /></span></td></tr>)}</tbody>
      </table>}
    </Box>
  );
}
