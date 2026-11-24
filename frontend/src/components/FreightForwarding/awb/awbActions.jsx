// Action bar buttons shared by the AWB, MAWB and HAWB screens (29-Oct-2026). Before:
// - DUPLICATE AWB only showed "AWB Duplicated. New AWB Generated." - nothing was copied;
// - SAVE AS TEMPLATE only showed "Saved as Template!" - nothing was kept, and the TEMPLATE list had fixed presets only;
// - SEND XFWB / XFZB sent the last SAVED copy, so changes made after the save were not in the message.
// Now DUPLICATE copies the saved AWB under a new number (server: POST /api/awb/duplicate/:id) and opens the copy,
// templates are kept on the server per screen (AWB / MAWB / HAWB) and show in the TEMPLATE list, and SEND saves first.
import React from 'react';
import axios from 'axios';
import { showSuccessToast, showValidationErrorsModal } from '../printLogic';
import { validateAwbForm, showEdiCheck } from './awbValidate';

// --- AWB number check (11 digits, 8th..10th serial digits mod 7 = last digit) ---
export function awbNoError(no) {
  const b = String(no || '').replace(/\D/g, '');
  if (b.length !== 11) return 'An AWB number has 11 digits (3 prefix + 8 serial), e.g. 176-12345675';
  const want = Number(b.slice(3, 10)) % 7;
  if (want !== Number(b[10])) return `Wrong check digit: ${b.slice(0, 3)}-${b.slice(3, 10)}${b[10]} should end in ${want}`;
  return '';
}
export const fmtAwbNo = (no) => { const b = String(no || '').replace(/\D/g, ''); return b.length === 11 ? `${b.slice(0, 3)}-${b.slice(3)}` : String(no || '').trim(); };
const errText = (e, dflt) => e?.response?.data?.error || e?.response?.data?.message || e?.message || dflt;

// --- DUPLICATE AWB ---
export async function duplicateAwb(ctx, type) {
  const { currentAwbId, handleModifyAWB } = ctx;
  if (!currentAwbId) { showValidationErrorsModal(['Save the AWB (or open it with MODIFY) before duplicating it.']); return; }
  const T = String(type).toUpperCase();
  let newNo = '';
  if (T === 'HAWB') {
    const v = window.prompt('New HAWB number for the copy:', '');
    if (v === null) return;
    newNo = v.trim().toUpperCase();
    if (!newNo) { showValidationErrorsModal(['Give the new HAWB number for the copy.']); return; }
    if (newNo === String(ctx.hawbNumber || '').trim().toUpperCase()) { showValidationErrorsModal(['The copy needs a different HAWB number.']); return; }
  } else {
    const v = window.prompt('New AWB number for the copy (e.g. 176-12345675).\nLeave it blank to take the next free number after this AWB.', '');
    if (v === null) return;
    if (v.trim()) {
      const err = awbNoError(v);
      if (err) { showValidationErrorsModal([err]); return; }
      newNo = fmtAwbNo(v);
    }
  }
  const body = { type: T };
  if (newNo) body.newAwbNumber = newNo;
  if (T === 'HAWB') {
    const master = ctx.awbPrefix && ctx.awbSuffix ? `${ctx.awbPrefix}-${ctx.awbSuffix}` : '';
    if (master) body.keepMaster = window.confirm(`Keep the copy on master ${master}?\nOK = yes (its weight is added to the master), Cancel = copy without a master.`);
  }
  try {
    const res = await axios.post(`/api/awb/duplicate/${currentAwbId}`, body);
    const no = res.data?.newAwbNumber;
    showSuccessToast('Success', `Copied as ${no}. The copy is open now.`);
    if (typeof handleModifyAWB === 'function' && no) await handleModifyAWB(no);
  } catch (e) {
    showValidationErrorsModal([`Duplicate failed: ${errText(e, 'server error')}`]);
  }
}

// --- SEND XFWB / XFZB: save the screen first, then send that saved copy ---
export async function sendAwbMessage(ctx, kind, btn, type = 'AWB') {
  const K = String(kind).toUpperCase();
  const no = ctx.awbPrefix && ctx.awbSuffix ? `${ctx.awbPrefix}-${ctx.awbSuffix}` : 'this AWB';
  // EDI check first: errors stop the send, warnings ask (29-Oct-2026)
  const chk = validateAwbForm(ctx, type);
  if (chk.errors.length) { await showEdiCheck(chk, { title: `${K} NOT SENT - fix the errors first` }); return; }
  if (chk.warnings.length) { if (!(await showEdiCheck(chk, { title: `Save and send ${K} for ${no}?`, goLabel: `SAVE & SEND ${K}` }))) return; }
  else if (!window.confirm(`Save and send ${K} for ${no} to the airline now?`)) return;
  const label = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = 'SAVING...'; }
  try {
    const id = typeof ctx.handleSaveToSQL === 'function' ? await ctx.handleSaveToSQL() : ctx.currentAwbId;
    if (!id) return; // save stopped (its own message is shown)
    if (btn) btn.innerText = 'SENDING...';
    const res = await fetch(`/api/awb/${id}/send-${kind.toLowerCase()}`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      showSuccessToast('Success', `${K} sent. File: ${data.fileName}`);
      if (K === 'XFWB' && typeof ctx.setXfwbSent === 'function') ctx.setXfwbSent(true);
    } else showValidationErrorsModal([`${K} send failed: ${data.error || data.message || res.statusText}`]);
  } catch (err) {
    showValidationErrorsModal([`Network error: ${err.message}`]);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = label; }
  }
}

// --- templates ---
// the reusable part of an AWB; never the AWB / HAWB number, pieces, weights, dimensions or flight dates
const TEMPLATE_KEYS = ['depAirport', 'destAirport', 'destAirportName', 'by1', 'by2', 'by3', 'to1', 'to2', 'to3',
  'agentDetails', 'agentCity', 'agentCountry', 'agentLocationCode', 'parties', 'shipperEmail', 'consigneeEmail',
  'currencyCode', 'chargeCode', 'wtValPC', 'otherPC', 'carriageValue', 'customsValue', 'insuranceValue', 'destinationCurrency',
  'natureOfGoods', 'sphCodes', 'ssrText', 'osiText', 'sci', 'ociRows', 'otherCharges', 'accountingInfo', 'productId',
  'executedPlace', 'densityGroup', 'mcUnit', 'signatureShipper', 'signatureCarrier'];
const setterOf = (k) => 'set' + k.charAt(0).toUpperCase() + k.slice(1);
const copy = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

export function templateSnapshot(ctx) {
  const d = {};
  for (const k of TEMPLATE_KEYS) if (ctx[k] !== undefined && typeof ctx[setterOf(k)] === 'function') d[k] = copy(ctx[k]);
  return d;
}
export function applyTemplateData(ctx, data) {
  let n = 0;
  for (const k of TEMPLATE_KEYS) {
    if (!(data && k in data)) continue;
    const set = ctx[setterOf(k)];
    if (typeof set === 'function') { set(copy(data[k])); n++; }
  }
  return n;
}

const EVT = 'awb-templates-changed';
export function useAwbTemplates(type) {
  const [list, setList] = React.useState([]);
  React.useEffect(() => {
    let live = true;
    const load = () => axios.get(`/api/awb/templates/${type}`).then(r => { if (live) setList(Array.isArray(r.data?.data) ? r.data.data : []); }).catch(() => {});
    load();
    window.addEventListener(EVT, load);
    return () => { live = false; window.removeEventListener(EVT, load); };
  }, [type]);
  return list;
}

export async function saveAsTemplate(ctx, type) {
  const sel = String(ctx.selectedTemplate || '');
  const goods = String(ctx.natureOfGoods || '').split('\n')[0].trim();
  const shipper = ctx.parties?.Shipper?.name || '';
  const suggest = sel.startsWith('USER:') ? sel.slice(5) : [shipper, ctx.destAirport].filter(Boolean).join(' - ') || goods;
  const v = window.prompt('Template name:', String(suggest).toUpperCase().slice(0, 60));
  if (v === null) return;
  const name = v.trim().toUpperCase();
  if (!name) { showValidationErrorsModal(['Give the template a name.']); return; }
  const data = templateSnapshot(ctx);
  try {
    const have = await axios.get(`/api/awb/templates/${type}`).then(r => r.data?.data || []).catch(() => []);
    if (have.some(t => t.name === name) && !window.confirm(`Template "${name}" already exists. Replace it?`)) return;
    const res = await axios.put(`/api/awb/templates/${type}/${encodeURIComponent(name)}`, { data });
    window.dispatchEvent(new Event(EVT));
    if (typeof ctx.setSelectedTemplate === 'function') ctx.setSelectedTemplate('USER:' + (res.data?.name || name));
    showSuccessToast('Success', `Template "${res.data?.name || name}" saved.`);
  } catch (e) {
    showValidationErrorsModal([`Template not saved: ${errText(e, 'server error')}`]);
  }
}

// Standard templates (29-Oct-2026). Before, LOAD replaced ALL handling codes and the SSR and wrote a made-up nature of
// goods over the user's ("FRESH VEGETABLES AND FRUITS", "LIFE SAVING DRUGS / MEDICINES" ...), put the non-IATA code
// "DGD" and CAO on every DG shipment and COL (2-8 C) with a 15-25 C instruction on pharma. Now a standard template only
// ADDS its handling codes to the free boxes (the screen writes the SSR / OSI lines of each code itself); the goods
// description is never touched. Dangerous goods has no single code (it depends on the class), so it adds the SSR line.
export const STANDARD_TEMPLATES = {
  'GENERAL CARGO': { sph: ['GEN'], ssr: '' },
  'PERISHABLE GOODS': { sph: ['PER', 'COL'], ssr: '' },
  'DANGEROUS GOODS': { sph: [], ssr: 'DANGEROUS GOODS AS PER ATTACHED SHIPPERS DECLARATION', note: 'Add the DG handling code of the class (RFL, RCL, RNG ...) and fill DOCUMENTS > DGD FORM.' },
  'PHARMACEUTICALS': { sph: ['PIL', 'CRT'], ssr: '' },
  'LIVE ANIMALS': { sph: ['AVI'], ssr: '', note: 'Fill DOCUMENTS > AVI CERT.' },
  'VALUABLE CARGO': { sph: ['VAL'], ssr: '' },
};
export function applyStandardTemplate(ctx, name) {
  const t = STANDARD_TEMPLATES[name];
  if (!t) return null;
  const cur = Array.isArray(ctx.sphCodes) ? ctx.sphCodes.map((c) => String(c || '').toUpperCase()) : [];
  while (cur.length < 9) cur.push('');
  const added = [], full = [];
  for (const c of t.sph) {
    if (cur.includes(c)) continue;
    const i = cur.indexOf('');
    if (i < 0) { full.push(c); continue; }
    cur[i] = c; added.push(c);
  }
  if (typeof ctx.setSphCodes === 'function') ctx.setSphCodes(cur);
  if (t.ssr && typeof ctx.setSsrText === 'function') {
    const ssr = String(ctx.ssrText || '');
    if (!ssr.toUpperCase().includes(t.ssr)) ctx.setSsrText(ssr.trim() ? `${ssr.replace(/\s+$/, '')}\n${t.ssr}` : t.ssr);
  }
  return { added, full, note: t.note || '' };
}

const formHasData = (ctx) => !!(ctx.currentAwbId || (ctx.parties && ctx.parties.Shipper && ctx.parties.Shipper.name) || ctx.depAirport || ctx.destAirport);

// TEMPLATE box of the screen header: standard templates + the saved templates, LOAD and delete
export function TemplatePicker({ ctx, type }) {
  const { selectedTemplate, setSelectedTemplate } = ctx;
  const list = useAwbTemplates(type);
  const sel = String(selectedTemplate || 'SELECT');
  const userName = sel.startsWith('USER:') ? sel.slice(5) : '';
  const load = () => {
    if (sel === 'SELECT') { showValidationErrorsModal(['Pick a template first.']); return; }
    if (userName) {
      const t = list.find(x => x.name === userName);
      if (!t) { showValidationErrorsModal([`Template "${userName}" is not on the server any more.`]); return; }
      if (formHasData(ctx) && !window.confirm(`Template "${userName}" replaces the routing, parties, agent, charges and handling on screen (not the AWB number, pieces or weights). Continue?`)) return;
      const n = applyTemplateData(ctx, t.data || {});
      showSuccessToast('Success', `Template "${userName}" loaded (${n} fields).`);
      return;
    }
    const r = applyStandardTemplate(ctx, sel);
    if (!r) { showValidationErrorsModal([`Unknown template "${sel}".`]); return; }
    const parts = [r.added.length ? `Handling codes added: ${r.added.join(', ')}.` : 'Handling codes already there.'];
    if (r.full.length) parts.push(`No free handling box for ${r.full.join(', ')}.`);
    if (r.note) parts.push(r.note);
    showSuccessToast(r.full.length ? 'Check' : 'Success', `${sel}: ${parts.join(' ')}`, !!r.full.length);
  };
  const remove = async () => {
    if (!userName || !window.confirm(`Delete template "${userName}"?`)) return;
    try {
      await axios.delete(`/api/awb/templates/${type}/${encodeURIComponent(userName)}`);
      setSelectedTemplate('SELECT');
      window.dispatchEvent(new Event(EVT));
      showSuccessToast('Success', `Template "${userName}" deleted.`);
    } catch (e) { showValidationErrorsModal([`Not deleted: ${errText(e, 'server error')}`]); }
  };
  const btn = { color: 'white', border: 'none', borderRadius: '3px', padding: '4px 12px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', border: '1px solid #94a3b8', borderRadius: '4px', padding: '2px', paddingLeft: '8px' }}>
      <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-main, #0f172a)', marginRight: '8px' }}>TEMPLATE</label>
      <select value={sel} onChange={(e) => setSelectedTemplate(e.target.value)} style={{ width: '170px', border: 'none', outline: 'none', fontSize: '12px', fontWeight: 'bold', color: '#0f172a', backgroundColor: 'transparent' }}>
        <option value="SELECT">SELECT</option>
        <optgroup label="Standard">
          {Object.keys(STANDARD_TEMPLATES).map(o => <option key={o} value={o}>{o}</option>)}
        </optgroup>
        {list.length > 0 && (
          <optgroup label="Saved">
            {list.map(t => <option key={t.name} value={'USER:' + t.name}>{t.name}</option>)}
          </optgroup>
        )}
        {userName && !list.some(t => t.name === userName) && <option value={sel}>{userName}</option>}
      </select>
      <button type="button" onClick={load} style={{ ...btn, backgroundColor: '#0284c7' }}>LOAD</button>
      {userName && <button type="button" title="Delete this saved template" onClick={remove} style={{ ...btn, backgroundColor: '#dc2626', padding: '4px 8px' }}>✕</button>}
    </div>
  );
}

// AWB log window (the MAWB screen had the logs code but no window / button)
export function AwbLogsModal({ open, logs, onClose }) {
  if (!open) return null;
  const td = { padding: '8px', textAlign: 'left' };
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '600px', maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ccc', paddingBottom: '10px', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main, #0f172a)' }}>AWB Logs</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>&times;</button>
        </div>
        {!logs || !logs.length ? <p>No logs found.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ borderBottom: '2px solid #94a3b8' }}><th style={td}>Date</th><th style={td}>Action</th><th style={td}>User</th><th style={td}>Details</th></tr></thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={td}>{new Date(log.createdAt).toLocaleString('en-IN')}</td><td style={{ ...td, fontWeight: 'bold' }}>{log.action}</td><td style={td}>{log.user}</td><td style={td}>{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
