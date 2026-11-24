// Items tab > Re-Export window (ICEGATE SB "Reexport" table: the import BE each re-exported item came in on).
// Rebuilt 29-Oct-2026:
// - shown on <body> with its own scroll (it ran off the screen); header, form, list and buttons always in view;
// - list columns showed the wrong fields (BE Site showed Inv Sr No, BE No showed Item Sr No ...);
// - Y/N answers are Y/N selects (free text before), BE Qty / Duty / Duty date can be typed (they were read-only and empty);
// - Add checks the fields ICEGATE needs; Edit keeps the row until Update (Edit removed it before, Cancel lost it);
// - Cancel really cancels; OK keeps the rows and sets Re-Export = Y / N on the item;
// - "Find BE" looks up our own import job with that BE No and fills the form from the chosen item (it showed
//   "coming soon"); Sample / Read Excel work (they did nothing).
import React, { useEffect, useState } from 'react';
import { Edit2, FileDown, Plus, Search, Trash2, Upload, X, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ModernDatePicker from '../../../../common/ModernDatePicker';
import BodyPortal from '../../../../common/BodyPortal';

const inp = { height: '30px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', background: '#fff', width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '3px', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const btn = (bg, color = '#fff', border) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 12px', borderRadius: '6px', border: border || 'none', background: bg, color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });
const card = { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', background: '#fff' };
const cardTitle = { fontSize: '11px', fontWeight: 800, color: '#0369a1', marginBottom: '8px', letterSpacing: '.04em' };

const num = (v) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(x) ? x : 0; };
const toIso = (v) => {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const s = String(v).trim(); let m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
};
const showDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : (v || ''); };
const yn = (v) => (/^Y/i.test(String(v || '')) ? 'Y' : /^N/i.test(String(v || '')) ? 'N' : '');

// screen keys (kept from the old window so rows saved with jobs still open) -> labels / Excel headers
const F = {
  site: 'reExpField2', beNo: 'reExpField3', beDate: 'reExpField4', inv: 'reExpField5', item: 'reExpField6', manual: 'reExpField7',
  used: 'reExpField8', desc: 'reExpField9', qty: 'reExpField10', uqc: 'reExpField11', assessed: 'reExpField12', duty: 'reExpField13',
  dutyDate: 'reExpField14', para: 'reExpField15', claim: 'reExpField16',
};
const YN = [['reExpField17', 'BE item used'], ['reExpField18', 'Commissioner permission'], ['reExpField19', 'Input credit availed'], ['reExpField20', 'Personal use'], ['reExpField21', 'Modvat availed'], ['reExpField22', 'Modvat repaid']];
const XL = [['BE Site', F.site], ['BE No', F.beNo], ['BE Date', F.beDate], ['BE Inv Sr', F.inv], ['BE Item Sr', F.item], ['Manual BE', F.manual], ['Qty Utilised', F.used], ['Description', F.desc], ['BE Qty', F.qty], ['BE UQC', F.uqc], ['Assessed Value', F.assessed], ['Duty Paid', F.duty], ['Duty Pay Date', F.dutyDate], ['Other Identifiable Para', F.para], ['Assessable Value Claimed', F.claim], ...YN.map(([k, l]) => [l, k])];
const DATE_KEYS = [F.beDate, F.dutyDate];

const blank = () => ({ [F.manual]: 'N' });

export const reExportErrors = (r) => {
  const e = [];
  if (!/^[A-Z0-9]{6}$/.test(String(r[F.site] || '').trim().toUpperCase())) e.push('BE Site must be the 6-character customs code (e.g. INDEL4)');
  if (!/^\d{1,10}$/.test(String(r[F.beNo] || '').trim())) e.push('BE No must be numeric');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r[F.beDate] || ''))) e.push('BE Date is mandatory');
  if (!(num(r[F.inv]) >= 1)) e.push('BE Inv Sr No is mandatory');
  if (!(num(r[F.item]) >= 1)) e.push('BE Item Sr No is mandatory');
  if (!(num(r[F.used]) > 0)) e.push('Qty Utilised must be more than 0');
  if (num(r[F.qty]) > 0 && num(r[F.used]) > num(r[F.qty])) e.push('Qty Utilised is more than the BE Qty');
  if (r[F.uqc] && !/^[A-Z]{3}$/.test(String(r[F.uqc]).toUpperCase())) e.push('BE UQC must be 3 letters');
  return e;
};

export default function ReExportModal({ open, onClose, formData, handleFormChange }) {
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank());
  const [editId, setEditId] = useState(null);
  const [find, setFind] = useState({ beNo: '', beDate: '' });
  const [found, setFound] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let saved = formData.reExports; if (typeof saved === 'string') { try { saved = JSON.parse(saved); } catch (e) { saved = []; } }
    setRows((Array.isArray(saved) ? saved : []).map((r, k) => ({ ...r, id: r.id || `${Date.now()}-${k}` })));
    setF(blank()); setEditId(null); setFound(null); setFind({ beNo: '', beDate: '' });
  }, [open]);

  if (!open) return null;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const formUsed = Object.entries(f).some(([k, v]) => k !== F.manual && String(v || '').trim());

  const addOrUpdate = () => {
    const row = { ...f, [F.site]: String(f[F.site] || '').trim().toUpperCase(), [F.uqc]: String(f[F.uqc] || '').trim().toUpperCase(), [F.beNo]: String(f[F.beNo] || '').trim() };
    const errs = reExportErrors(row);
    if (errs.length) { toast.error(errs.join('\n'), { duration: 5000 }); return; }
    const dup = rows.find((r) => r.id !== editId && String(r[F.beNo]) === row[F.beNo] && num(r[F.inv]) === num(row[F.inv]) && num(r[F.item]) === num(row[F.item]));
    if (dup) { toast.error('This BE invoice / item is already in the list.'); return; }
    if (editId) setRows((p) => p.map((r) => (r.id === editId ? { ...row, id: editId } : r)));
    else setRows((p) => [...p, { ...row, id: `${Date.now()}` }]);
    toast.success(editId ? 'Row updated' : 'Row added');
    setF(blank()); setEditId(null);
  };

  const findBe = async () => {
    const beNo = String(find.beNo || '').trim();
    if (!/^\d{1,10}$/.test(beNo)) { toast.error('Enter the BE No (numbers only).'); return; }
    setBusy(true); setFound(null);
    try {
      const r = await fetch(`/api/import-jobs/by-be?beNo=${encodeURIComponent(beNo)}${find.beDate ? '&beDate=' + encodeURIComponent(find.beDate) : ''}`);
      const d = await r.json();
      const list = (d && d.success && Array.isArray(d.data)) ? d.data : [];
      if (!list.length) { toast('BE not found in the import jobs of this software - fill the details by hand.', { icon: 'ℹ️', duration: 5000 }); setF((p) => ({ ...p, [F.beNo]: beNo, ...(find.beDate ? { [F.beDate]: find.beDate } : {}) })); return; }
      setFound(list);
    } catch (e) { toast.error('Could not search: ' + e.message); } finally { setBusy(false); }
  };

  const pick = (job, it) => {
    setF((p) => ({ ...p, [F.site]: job.beSite || p[F.site] || '', [F.beNo]: job.beNo, [F.beDate]: job.beDate || p[F.beDate] || '', [F.inv]: String(it.invSr), [F.item]: String(it.itemSr),
      [F.desc]: it.desc || '', [F.qty]: it.qty ? String(it.qty) : '', [F.uqc]: it.uqc || '', [F.assessed]: it.assessableValue ? String(it.assessableValue) : '',
      [F.duty]: it.dutyPaid ? String(Math.round(it.dutyPaid * 100) / 100) : '', [F.dutyDate]: job.dutyPaidDate || '', [F.manual]: 'N',
      [F.used]: p[F.used] || (formData.qty ? String(Math.min(num(formData.qty), num(it.qty) || num(formData.qty))) : '') }));
    setFound(null);
    toast.success(`Filled from import job ${job.jobNo || ''}, item ${it.invSr}/${it.itemSr}`);
  };

  const sample = () => {
    const ws = XLSX.utils.aoa_to_sheet([XL.map((x) => x[0]), ['INDEL4', '1234567', '15-09-2026', 1, 1, 'N', 10, 'ITEM DESCRIPTION', 10, 'NOS', 50000, 9000, '16-09-2026', '', 50000, 'N', 'N', 'N', 'N', 'N', 'N']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'ReExport'); XLSX.writeFile(wb, 'ReExport_Sample.xlsx');
  };

  const readExcel = (e) => {
    const input = e.target; const file = input.files && input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const ok = []; const bad = [];
        data.forEach((x, k) => {
          const r = { id: `${Date.now()}-${k}` };
          XL.forEach(([h, key]) => { const v = x[h] ?? x[h.toUpperCase()]; if (v !== undefined && v !== '') r[key] = DATE_KEYS.includes(key) ? toIso(v) : String(v).trim(); });
          [F.site, F.uqc].forEach((key) => { if (r[key]) r[key] = r[key].toUpperCase(); });
          [F.manual, ...YN.map((y) => y[0])].forEach((key) => { if (r[key] !== undefined) r[key] = yn(r[key]); });
          if (!r[F.manual]) r[F.manual] = 'N';
          const errs = reExportErrors(r); (errs.length ? bad : ok).push(errs.length ? `row ${k + 2}: ${errs[0]}` : r);
        });
        if (ok.length) setRows((p) => [...p, ...ok]);
        if (ok.length) toast.success(`${ok.length} row(s) read` + (bad.length ? `; ${bad.length} skipped (${bad.slice(0, 2).join('; ')})` : ''), { duration: 6000 });
        else toast.error(bad.length ? 'No row read: ' + bad.slice(0, 3).join('; ') : 'The sheet has no rows.', { duration: 6000 });
      } catch (err) { toast.error('Could not read the Excel file: ' + err.message); } finally { input.value = ''; }
    };
    reader.readAsArrayBuffer(file);
  };

  const ok = () => {
    if (formUsed) { toast.error(editId ? 'Click Update (or Clear) for the row being edited first.' : 'Click Add (or Clear) for the details typed in the form first.'); return; }
    handleFormChange('reExports', rows);
    handleFormChange('reExport', rows.length ? 'Y' : 'N');
    onClose();
  };

  const T = (label, key, o = {}) => (
    <div style={o.span ? { gridColumn: `span ${o.span}` } : undefined}>
      <label style={lbl}>{label}</label>
      <input style={{ ...inp, ...(o.req && !String(f[key] || '').trim() ? { borderColor: '#fca5a5' } : {}), ...(o.right ? { textAlign: 'right' } : {}) }} value={f[key] || ''} maxLength={o.max} inputMode={o.numeric ? 'decimal' : undefined}
        placeholder={o.ph} onChange={(e) => set(key, o.upper ? e.target.value.toUpperCase() : o.digits ? e.target.value.replace(/\D/g, '') : e.target.value)} />
    </div>
  );
  const D = (label, key, req) => (
    <div><label style={lbl}>{label}</label><ModernDatePicker className="input-field" style={{ ...inp, ...(req && !f[key] ? { borderColor: '#fca5a5' } : {}) }} value={f[key] || ''} onChange={(e) => set(key, e.target.value)} /></div>
  );
  const S = (label, key) => (
    <div><label style={lbl}>{label}</label>
      <select style={inp} value={yn(f[key])} onChange={(e) => set(key, e.target.value)}><option value="">-</option><option value="Y">Y - Yes</option><option value="N">N - No</option></select>
    </div>
  );

  return (
    <BodyPortal>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: '1100px', maxHeight: 'calc(100vh - 24px)', background: '#f8fafc', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
          <div style={{ flexShrink: 0, padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Re-Export Details</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>Item {formData.invSr || 1}/{formData.itemSr || 1} · {formData.desc || 'no description'} · Qty {formData.qty || 0} {formData.unit || ''} · the import BE the goods came in on</div>
            </div>
            <button type="button" onClick={onClose} title="Close without saving" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
          </div>

          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '12px 18px', display: 'grid', gap: '10px', alignContent: 'start' }}>
            <div style={{ ...card, background: '#f0f9ff', borderColor: '#bae6fd', display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ width: 150 }}><label style={lbl}>FIND BE - BE NO</label><input style={inp} value={find.beNo} inputMode="numeric" maxLength={10} onChange={(e) => setFind((p) => ({ ...p, beNo: e.target.value.replace(/\D/g, '') }))} onKeyDown={(e) => { if (e.key === 'Enter') findBe(); }} /></div>
              <div style={{ width: 150 }}><label style={lbl}>BE DATE (optional)</label><ModernDatePicker className="input-field" style={inp} value={find.beDate} onChange={(e) => setFind((p) => ({ ...p, beDate: e.target.value }))} /></div>
              <button type="button" disabled={busy} style={btn(busy ? '#86efac' : '#16a34a')} onClick={findBe}><Search size={13} /> {busy ? 'Searching…' : 'Find in import jobs'}</button>
              <span style={{ fontSize: 11, color: '#64748b', flex: 1, minWidth: 200 }}>Fills the form from our own import job of that BE. If the BE was not filed through this software, type the details below.</span>
              {found && (
                <div style={{ width: '100%', background: '#fff', border: '1px solid #bae6fd', borderRadius: 6, maxHeight: 170, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead><tr style={{ background: '#e0f2fe', color: '#075985' }}>{['Job', 'BE date', 'Inv/Item', 'Description', 'Qty', 'Assessable', 'Duty', ''].map((h) => <th key={h} style={{ padding: '5px 8px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {found.flatMap((job) => job.items.map((it) => (
                        <tr key={`${job.jobId}-${it.invSr}-${it.itemSr}`} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => pick(job, it)}>
                          <td style={{ padding: '4px 8px' }}>{job.jobNo}</td><td style={{ padding: '4px 8px' }}>{showDate(job.beDate)}</td><td style={{ padding: '4px 8px' }}>{it.invSr}/{it.itemSr}</td>
                          <td style={{ padding: '4px 8px', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.desc}</td>
                          <td style={{ padding: '4px 8px' }}>{it.qty} {it.uqc}</td><td style={{ padding: '4px 8px' }}>{it.assessableValue || '-'}</td><td style={{ padding: '4px 8px' }}>{it.dutyPaid || '-'}</td>
                          <td style={{ padding: '4px 8px', color: '#0369a1', fontWeight: 700 }}>Use</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={card}>
              <div style={cardTitle}>IMPORT BILL OF ENTRY {editId && <span style={{ color: '#b45309' }}>· EDITING A ROW</span>}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '8px 10px' }}>
                {T('BE SITE *', F.site, { max: 6, upper: true, req: true, ph: 'INDEL4' })}
                {T('BE NO *', F.beNo, { max: 10, digits: true, req: true })}
                {D('BE DATE *', F.beDate, true)}
                {T('BE INV SR NO *', F.inv, { max: 5, digits: true, req: true })}
                {T('BE ITEM SR NO *', F.item, { max: 4, digits: true, req: true })}
                {S('MANUAL BE', F.manual)}
                {T('DESCRIPTION (AS IN BE)', F.desc, { max: 120, span: 6 })}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>QUANTITY, VALUE AND DUTY</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '8px 10px' }}>
                {T('BE QTY', F.qty, { numeric: true, right: true })}
                {T('BE UQC', F.uqc, { max: 3, upper: true, ph: 'NOS' })}
                {T('QTY UTILISED *', F.used, { numeric: true, right: true, req: true })}
                {T('BE ASSESSED VALUE ₹', F.assessed, { numeric: true, right: true })}
                {T('ASS. VALUE CLAIMED ₹', F.claim, { numeric: true, right: true })}
                {T('BE DUTY PAID ₹', F.duty, { numeric: true, right: true })}
                {D('DUTY PAYMENT DATE', F.dutyDate)}
                {T('OTHER IDENTIFIABLE PARAMETER', F.para, { max: 120, span: 5 })}
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>DECLARATIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: '8px 10px' }}>
                {YN.map(([k, l]) => <React.Fragment key={k}>{S(l.toUpperCase(), k)}</React.Fragment>)}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={() => { setF(blank()); setEditId(null); }}><RotateCcw size={13} /> Clear</button>
                <button type="button" style={btn(editId ? '#d97706' : '#0284c7')} onClick={addOrUpdate}><Plus size={13} /> {editId ? 'Update row' : 'Add to list'}</button>
              </div>
            </div>

            <div style={{ ...card, padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                <thead><tr style={{ background: '#f1f5f9', color: '#334155' }}>
                  {['#', 'BE Site', 'BE No', 'BE Date', 'Inv/Item', 'Description', 'Qty Utilised', 'BE Qty', 'Assessed ₹', 'Duty ₹', ''].map((h) => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map((r, k) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9', background: r.id === editId ? '#fffbeb' : '#fff' }}>
                      <td style={{ padding: '5px 8px' }}>{k + 1}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.site]}</td>
                      <td style={{ padding: '5px 8px', fontWeight: 700 }}>{r[F.beNo]}</td>
                      <td style={{ padding: '5px 8px' }}>{showDate(r[F.beDate])}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.inv]}/{r[F.item]}</td>
                      <td style={{ padding: '5px 8px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r[F.desc]}>{r[F.desc] || '-'}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.used]} {r[F.uqc] || ''}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.qty] || '-'}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.assessed] || '-'}</td>
                      <td style={{ padding: '5px 8px' }}>{r[F.duty] || '-'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                        <button type="button" title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0284c7' }} onClick={() => { const { id, ...rest } = r; setF({ ...blank(), ...rest }); setEditId(id); }}><Edit2 size={14} /></button>
                        <button type="button" title="Remove" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }} onClick={() => { setRows((p) => p.filter((x) => x.id !== r.id)); if (editId === r.id) { setEditId(null); setF(blank()); } }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={11} style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>No BE yet - fill the form and click Add to list, or Read Excel.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ flexShrink: 0, padding: '10px 18px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ ...btn('#2563eb'), margin: 0 }}><Upload size={13} /> Read Excel<input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={readExcel} /></label>
              <button type="button" style={btn('#fff', '#2563eb', '1px solid #93c5fd')} onClick={sample}><FileDown size={13} /> Sample</button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748b' }}>{rows.length} BE row(s)</span>
              <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={onClose}>Cancel</button>
              <button type="button" style={btn('#16a34a')} onClick={ok}>OK - keep {rows.length} row(s)</button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
