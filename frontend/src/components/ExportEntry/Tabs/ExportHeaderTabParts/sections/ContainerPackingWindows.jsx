// SB Header > Container / ULD details and Packing details windows (29-Oct-2026, own design).
// Before: Edit did nothing, Cancel kept the changes, "Sr No" wrote into another header field, "Read Excel" was a
// broken label, the windows sat inside the panel (could go off screen), and the package type was picked from the UQC
// list instead of the ICEGATE package codes. Rows are kept as before in exportData.Containers / PackingDetails, so
// saving and the SB JSON (containerModel / packingListModel) are unchanged.
import React, { useEffect, useState } from 'react';
import { Edit2, FileDown, Plus, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import BodyPortal from '../../../../common/BodyPortal';
import ModernDatePicker from '../../../../common/ModernDatePicker';

// ICEGATE package code directory (Customs Online Directory, 25-Oct-2026)
export const PACKAGE_CODES = [['BDL', 'BUNDLE'], ['BLO', 'STEEL BLOCKS'], ['BLS', 'BAILS'], ['BOU', 'BILLIONS OF UNIT'], ['BOX', 'BOXES'], ['BRL', 'BARREL'], ['BUL', 'STEEL BULKS'],
  ['CAS', 'CASES'], ['CBY', 'CARBOYS'], ['CHT', 'CHEST'], ['CLS', 'COILS'], ['COL', 'COLLIES'], ['CON', 'CONTAINER'], ['CRT', 'CRATES'], ['CSK', 'WOODEN CASKS'], ['CTN', 'CARTONS'],
  ['DRM', 'DRUMS'], ['ENV', 'STEEL ENVELOPES'], ['FLK', 'FLASK'], ['HBK', 'HABBUCK'], ['JBL', 'JUMBLE BALE'], ['JTA', 'JOTTA'], ['KEG', 'KEGGS'], ['NGT', 'INGOT'], ['PAL', 'PALLS'],
  ['PCS', 'PIECES'], ['PKG', 'PACKAGES'], ['PLT', 'PALLETS'], ['QDS', 'QUADS'], ['REL', 'REELS'], ['RLS', 'ROOLS'], ['SHT', 'SHEETS'], ['SKD', 'SKID & SKIDDED PKGS'], ['SLB', 'SLABS'],
  ['TBL', 'TABLE'], ['TRK', 'TRUNK'], ['UNT', 'UNITS'], ['VLS', 'VIALS']];

// ISO 6346 check digit of a container number (4 letters + 6 digits + check digit)
export const isoCheckOk = (no) => {
  const s = String(no || '').toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(s)) return false;
  const val = (ch) => { if (/\d/.test(ch)) return +ch; let v = ch.charCodeAt(0) - 55; v += Math.floor((v - 1) / 10); return v; }; // A=10, skips 11, 22, 33
  let sum = 0; for (let i = 0; i < 10; i++) sum += val(s[i]) * (2 ** i);
  return (sum % 11) % 10 === +s[10];
};

const inp = { height: '28px', padding: '0 7px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#cbd5e1', borderRadius: '5px', fontSize: '12px', background: '#fff', width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '3px', whiteSpace: 'nowrap' };
const btn = (bg, color = '#fff', border) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 11px', borderRadius: '6px', border: border || 'none', background: bg, color, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });
const th = { padding: '6px 8px', textAlign: 'left', fontSize: '11px', background: '#f1f5f9', position: 'sticky', top: 0, whiteSpace: 'nowrap' };
const td = { padding: '5px 8px', fontSize: '12px', borderTop: '1px solid #f1f5f9', whiteSpace: 'nowrap' };

function Shell({ title, sub, width, onCancel, onOk, children, footLeft }) {
  return (
    <BodyPortal>
      <div className="cpw" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: width, maxHeight: 'calc(100vh - 24px)', background: '#f8fafc', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
          <div style={{ flexShrink: 0, padding: '11px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{title}</div><div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div></div>
            <button type="button" onClick={onCancel} title="Close without saving" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
          </div>
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
          <div style={{ flexShrink: 0, padding: '10px 18px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{footLeft}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={onCancel}>Cancel</button>
              <button type="button" style={btn('#16a34a')} onClick={onOk}>OK</button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

const EMPTY_CONT = { ContainerNumber: '', ContainerSize: '', ContainerType: '', ExciseSealNo: '', SealDate: '', SealTypeIndicator: '', SealDeviceID: '', NoOfPktsStuffed: '', VGM: '', MovementDocumentType: '', MovementDocumentNumber: '', EqmntType: '', EqmntQty: '', EqmntQtyCode: '' };
// Excel columns (Sample / Read Excel)
const XL_CONT = [['Container No', 'ContainerNumber'], ['Size', 'ContainerSize'], ['Type', 'ContainerType'], ['Seal No', 'ExciseSealNo'], ['Seal Date', 'SealDate'], ['Seal Type', 'SealTypeIndicator'],
  ['Seal Device ID', 'SealDeviceID'], ['Pkts Stuffed', 'NoOfPktsStuffed'], ['VGM Kgs', 'VGM'], ['Doc Type', 'MovementDocumentType'], ['Doc No', 'MovementDocumentNumber'], ['Equipment Type', 'EqmntType'], ['Equipment Qty', 'EqmntQty'], ['Equipment Qty Code', 'EqmntQtyCode']];
const xlDate = (v) => {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
};

export function ContainerWindow({ open, onClose, list, onSave, mode, totalPackages, factoryStuffed }) {
  const sea = mode !== 'AIR';
  const [rows, setRows] = useState([]);
  const [cur, setCur] = useState(EMPTY_CONT);
  const [editIdx, setEditIdx] = useState(-1);
  useEffect(() => { if (open) { setRows((list || []).map(r => ({ ...EMPTY_CONT, ...r }))); setCur(EMPTY_CONT); setEditIdx(-1); } }, [open]); // eslint-disable-line
  if (!open) return null;
  const set = (k, v) => setCur(p => ({ ...p, [k]: v }));

  const rowErrors = (r, idx) => {
    const e = []; const no = String(r.ContainerNumber || '').trim().toUpperCase();
    if (!no) e.push(sea ? 'Container No is empty' : 'ULD No is empty');
    else if (sea && !/^[A-Z]{4}\d{7}$/.test(no)) e.push(no + ': container No is 4 letters + 7 digits (e.g. CSQU3054383)');
    if (rows.some((x, i) => i !== idx && String(x.ContainerNumber || '').toUpperCase() === no && no)) e.push(no + ' is already in the list');
    if (r.SealDate && new Date(r.SealDate) > new Date()) e.push(no + ': seal date is in the future');
    if (String(r.VGM || '').trim() && !(parseFloat(r.VGM) > 0)) e.push(no + ': VGM must be a number');
    if (String(r.NoOfPktsStuffed || '').trim() && !/^\d+$/.test(String(r.NoOfPktsStuffed).trim())) e.push(no + ': packets stuffed must be a whole number');
    return e;
  };
  const addOrUpdate = () => {
    const r = { ...cur, ContainerNumber: String(cur.ContainerNumber || '').trim().toUpperCase(), ExciseSealNo: String(cur.ExciseSealNo || '').trim().toUpperCase(), SealDeviceID: String(cur.SealDeviceID || '').trim().toUpperCase() };
    const e = rowErrors(r, editIdx);
    if (e.length) { toast.error(e.join('\n')); return; }
    if (sea && !isoCheckOk(r.ContainerNumber)) toast(`${r.ContainerNumber}: the check digit does not match (ISO 6346) - check the number`, { icon: '⚠️', duration: 5000 });
    setRows(p => (editIdx >= 0 ? p.map((x, i) => (i === editIdx ? r : x)) : [...p, r]));
    setCur(EMPTY_CONT); setEditIdx(-1);
  };
  const sample = () => {
    const ws = XLSX.utils.aoa_to_sheet([XL_CONT.map(x => x[0]), ['CSQU3054383', '20', 'GP', 'SEAL123', '01-10-2026', 'RFID', 'DEV001', 10, 2500, '', '', 'CN', 1, 'NOS']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Containers'); XLSX.writeFile(wb, 'Container_Sample.xlsx');
  };
  const readExcel = (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const rd = new FileReader();
    rd.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        const norm = (s) => String(s).toLowerCase().replace(/[^a-z]/g, '');
        const got = data.map(o => { const r = { ...EMPTY_CONT }; Object.entries(o).forEach(([h, v]) => { const c = XL_CONT.find(x => norm(x[0]) === norm(h)); if (c) r[c[1]] = c[1] === 'SealDate' ? xlDate(v) : String(v).trim(); }); r.ContainerNumber = r.ContainerNumber.toUpperCase(); return r; })
          .filter(r => r.ContainerNumber);
        if (!got.length) { toast.error('No container rows found - use the Sample file columns'); return; }
        const merged = [...rows]; let added = 0, updated = 0;
        got.forEach(r => { const i = merged.findIndex(x => String(x.ContainerNumber).toUpperCase() === r.ContainerNumber); if (i >= 0) { merged[i] = r; updated++; } else { merged.push(r); added++; } });
        setRows(merged); toast.success(`${added} added, ${updated} updated from Excel`);
      } catch (err) { toast.error('Could not read the Excel file'); }
    };
    rd.readAsArrayBuffer(f);
  };
  const ok = () => {
    const errs = rows.flatMap((r, i) => rowErrors(r, i));
    if (errs.length) { toast.error(errs.slice(0, 4).join('\n')); return; }
    onSave(rows); // the caller closes the window
  };
  const stuffed = rows.reduce((a, r) => a + (parseInt(r.NoOfPktsStuffed, 10) || 0), 0);
  const fld = (k, l, extra = {}) => (
    <div style={extra.span ? { gridColumn: `span ${extra.span}` } : undefined}>
      <label style={lbl}>{l}</label>
      {extra.opts ? (
        <select style={inp} value={cur[k] || ''} onChange={e => set(k, e.target.value)}><option value="">Select</option>{extra.opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      ) : extra.date ? (
        <ModernDatePicker className="input-field" style={inp} value={cur[k] || ''} onChange={e => set(k, e.target.value)} />
      ) : (
        <input style={{ ...inp, ...(extra.num ? { textAlign: 'right' } : {}) }} maxLength={extra.max} value={cur[k] || ''} placeholder={extra.ph} onChange={e => set(k, extra.upper ? e.target.value.toUpperCase() : e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrUpdate(); } }} />
      )}
    </div>);

  return (
    <Shell title={sea ? 'Container Details' : 'ULD Details'} width={1080} onCancel={onClose} onOk={ok}
      sub={`${rows.length} ${sea ? 'container' : 'ULD'}(s)${stuffed ? ` · ${stuffed} packets stuffed` : ''}${totalPackages ? ` · SB total packages ${totalPackages}` : ''}${factoryStuffed === 'Y' ? ' · factory stuffed: give the e-seal of each container' : ''}`}
      footLeft={stuffed && totalPackages && stuffed !== parseInt(totalPackages, 10) ? `Packets stuffed (${stuffed}) differ from the SB total packages (${totalPackages}).` : 'Enter adds the row. OK keeps the list, Cancel drops the changes.'}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '9px 10px', alignItems: 'end' }}>
        {fld('ContainerNumber', sea ? 'Container No *' : 'ULD No *', { upper: true, max: 15, span: 2, ph: sea ? 'CSQU3054383' : 'AKE12345AI' })}
        {fld('ContainerSize', 'Size', { opts: [['20', '20'], ['40', '40'], ['45', '45']] })}
        {fld('ContainerType', 'Type', { opts: [['GP', 'GP - General'], ['HC', 'HC - High cube'], ['OT', 'OT - Open top'], ['RF', 'RF - Reefer'], ['FR', 'FR - Flat rack'], ['TK', 'TK - Tank']] })}
        {fld('ExciseSealNo', 'Seal No', { upper: true, max: 35 })}
        {fld('SealDate', 'Seal Date', { date: true })}
        {fld('SealTypeIndicator', 'Seal Type', { upper: true, max: 5, ph: 'e.g. RFID' })}
        {fld('SealDeviceID', 'Seal Device ID', { upper: true, max: 35 })}
        {fld('NoOfPktsStuffed', 'Pkts Stuffed', { num: true, max: 8 })}
        {fld('VGM', 'VGM (Kgs)', { num: true, max: 12 })}
        {fld('MovementDocumentType', 'Movement Doc Type', { upper: true, max: 5 })}
        {fld('MovementDocumentNumber', 'Movement Doc No', { upper: true, max: 35 })}
        {fld('EqmntType', 'Equipment Type', { opts: [['CN', 'CN - Container'], ['TE', 'TE - Trailer'], ['RO', 'RO - RoRo']] })}
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: 1 }}><label style={lbl}>Eqp Qty</label><input style={{ ...inp, textAlign: 'right' }} value={cur.EqmntQty || ''} onChange={e => set('EqmntQty', e.target.value.replace(/[^\d.]/g, ''))} /></div>
          <div style={{ flex: 1 }}><label style={lbl}>Qty Code</label><input style={inp} maxLength={3} value={cur.EqmntQtyCode || ''} onChange={e => set('EqmntQtyCode', e.target.value.toUpperCase())} /></div>
        </div>
        <div style={{ gridColumn: 'span 7', display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={btn('#0284c7')} onClick={addOrUpdate}>{editIdx >= 0 ? <><Edit2 size={13} /> Update row {editIdx + 1}</> : <><Plus size={13} /> Add</>}</button>
            {editIdx >= 0 && <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={() => { setCur(EMPTY_CONT); setEditIdx(-1); }}>Clear</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ ...btn('#2563eb'), margin: 0 }}><Upload size={13} /> Read Excel<input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={readExcel} /></label>
            <button type="button" style={btn('#fff', '#2563eb', '1px solid #93c5fd')} onClick={sample}><FileDown size={13} /> Sample</button>
          </div>
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto', maxHeight: 260 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['#', sea ? 'Container No' : 'ULD No', 'Size', 'Type', 'Seal No', 'Seal Date', 'Seal Type', 'Device ID', 'Pkts', 'VGM', 'Doc', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={editIdx === i ? { background: '#eff6ff' } : undefined}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, fontWeight: 700 }}>{r.ContainerNumber}{sea && !isoCheckOk(r.ContainerNumber) && <span title="ISO 6346 check digit does not match" style={{ color: '#d97706', marginLeft: 4 }}>⚠</span>}</td>
                <td style={td}>{r.ContainerSize}</td><td style={td}>{r.ContainerType}</td><td style={td}>{r.ExciseSealNo}</td><td style={td}>{r.SealDate}</td>
                <td style={td}>{r.SealTypeIndicator}</td><td style={td}>{r.SealDeviceID}</td><td style={{ ...td, textAlign: 'right' }}>{r.NoOfPktsStuffed}</td><td style={{ ...td, textAlign: 'right' }}>{r.VGM}</td>
                <td style={td}>{[r.MovementDocumentType, r.MovementDocumentNumber].filter(Boolean).join(' ')}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button type="button" title="Edit" onClick={() => { setCur({ ...EMPTY_CONT, ...r }); setEditIdx(i); }} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}><Edit2 size={14} /></button>
                  <button type="button" title="Remove" onClick={() => { setRows(p => p.filter((_, k) => k !== i)); if (editIdx === i) { setCur(EMPTY_CONT); setEditIdx(-1); } }} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={12} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 16 }}>No {sea ? 'container' : 'ULD'} yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

const EMPTY_PACK = { PackingNumberFrom: '', PackingNumberTo: '', PackingCode: '' };
export function PackingWindow({ open, onClose, list, onSave, totalPackages }) {
  const [rows, setRows] = useState([]);
  const [cur, setCur] = useState(EMPTY_PACK);
  const [editIdx, setEditIdx] = useState(-1);
  useEffect(() => { if (open) { setRows((list || []).map(r => ({ ...EMPTY_PACK, ...r }))); setCur(EMPTY_PACK); setEditIdx(-1); } }, [open]); // eslint-disable-line
  if (!open) return null;
  const count = (r) => { const f = parseInt(r.PackingNumberFrom, 10), t = parseInt(r.PackingNumberTo, 10); return f && t && t >= f ? t - f + 1 : 0; };
  const total = rows.reduce((a, r) => a + count(r), 0);
  const addOrUpdate = () => {
    const f = parseInt(cur.PackingNumberFrom, 10), t = parseInt(cur.PackingNumberTo, 10);
    if (!f || !t) { toast.error('Enter package number From and To'); return; }
    if (t < f) { toast.error('Package number To is below From'); return; }
    if (!cur.PackingCode) { toast.error('Pick the package type'); return; }
    const clash = rows.find((r, i) => i !== editIdx && Math.max(f, parseInt(r.PackingNumberFrom, 10)) <= Math.min(t, parseInt(r.PackingNumberTo, 10)));
    if (clash) { toast.error(`Numbers ${f}-${t} overlap the row ${clash.PackingNumberFrom}-${clash.PackingNumberTo}`); return; }
    const r = { PackingNumberFrom: String(f), PackingNumberTo: String(t), PackingCode: cur.PackingCode };
    setRows(p => (editIdx >= 0 ? p.map((x, i) => (i === editIdx ? r : x)) : [...p, r]));
    setCur(EMPTY_PACK); setEditIdx(-1);
  };
  const ok = () => { onSave(rows); };
  const tp = parseInt(totalPackages, 10) || 0;
  return (
    <Shell title="Packing Details" width={720} onCancel={onClose} onOk={ok}
      sub={`${rows.length} row(s) · ${total} package(s)${tp ? ` · SB total packages ${tp}` : ''}`}
      footLeft={tp && total && total !== tp ? <span style={{ color: '#b45309' }}>Numbered packages ({total}) differ from the SB total packages ({tp}).</span> : 'Package number ranges and the type of packages (ICEGATE package codes).'}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 2fr auto', gap: 10, alignItems: 'end' }}>
        <div><label style={lbl}>Package No From *</label><input style={{ ...inp, textAlign: 'right' }} value={cur.PackingNumberFrom} onChange={e => setCur(p => ({ ...p, PackingNumberFrom: e.target.value.replace(/\D/g, '') }))} /></div>
        <div><label style={lbl}>To *</label><input style={{ ...inp, textAlign: 'right' }} value={cur.PackingNumberTo} onChange={e => setCur(p => ({ ...p, PackingNumberTo: e.target.value.replace(/\D/g, '') }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrUpdate(); } }} /></div>
        <div><label style={lbl}>Type of packages *</label>
          <select style={inp} value={cur.PackingCode} onChange={e => setCur(p => ({ ...p, PackingCode: e.target.value }))}>
            <option value="">Select</option>
            {/* a code saved earlier that is not in the list stays visible */}
            {cur.PackingCode && !PACKAGE_CODES.some(([c]) => c === cur.PackingCode) && <option value={cur.PackingCode}>{cur.PackingCode}</option>}
            {PACKAGE_CODES.map(([c, d]) => <option key={c} value={c}>{c} - {d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={btn('#0284c7')} onClick={addOrUpdate}>{editIdx >= 0 ? <><Edit2 size={13} /> Update</> : <><Plus size={13} /> Add</>}</button>
          {editIdx >= 0 && <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={() => { setCur(EMPTY_PACK); setEditIdx(-1); }}>Clear</button>}
        </div>
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto', maxHeight: 260 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['#', 'From', 'To', 'Packages', 'Type', ''].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={editIdx === i ? { background: '#eff6ff' } : undefined}>
                <td style={td}>{i + 1}</td><td style={td}>{r.PackingNumberFrom}</td><td style={td}>{r.PackingNumberTo}</td><td style={td}>{count(r)}</td>
                <td style={td}>{r.PackingCode}{(PACKAGE_CODES.find(([c]) => c === r.PackingCode) || [])[1] ? ` - ${PACKAGE_CODES.find(([c]) => c === r.PackingCode)[1]}` : ''}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  <button type="button" title="Edit" onClick={() => { setCur({ ...EMPTY_PACK, ...r }); setEditIdx(i); }} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }}><Edit2 size={14} /></button>
                  <button type="button" title="Remove" onClick={() => { setRows(p => p.filter((_, k) => k !== i)); if (editIdx === i) { setCur(EMPTY_PACK); setEditIdx(-1); } }} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#94a3b8', padding: 16 }}>No packing row yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
