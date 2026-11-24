// Detail windows of the Items tab Y/N chips (29-Oct-2026). Before, Cess / Third Party / Accessory / SW Constituent /
// SW Production / SW Control could be set to Y but had no place for their details, so the ICEGATE tables
// (cessModel, thirdPartyModel, itemAccessModel, constituentFinal, production, controlType) always went empty;
// the Manufacturer window saved fields the SB builder did not read. Field lengths follow the SB CACHE01 schema v1.2.
import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import BodyPortal from '../../../../common/BodyPortal';
import ModernDatePicker from '../../../../common/ModernDatePicker';

const inp = { height: '30px', padding: '0 8px', borderWidth: '1px', borderStyle: 'solid', borderColor: '#cbd5e1', borderRadius: '5px', fontSize: '12px', background: '#fff', width: '100%', boxSizing: 'border-box' };
const lbl = { display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#475569', marginBottom: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const btn = (bg, color = '#fff', border) => ({ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '30px', padding: '0 12px', borderRadius: '6px', border: border || 'none', background: bg, color, fontSize: '12px', fontWeight: 700, cursor: 'pointer' });
const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

// ---- window definitions ----
export const WINDOWS = {
  manf: {
    title: 'Manufacturer / Producer / Grower', flag: 'manfDetails', kind: 'form', cols: 4,
    hint: 'Goods not made by the exporter: the maker of this item (ICEGATE item manufacturer fields).',
    fields: [
      { k: 'manfProdName', l: 'Name (for checklist)', max: 70, span: 2 },
      { k: 'manfProdCdType', l: 'Code type *', max: 1, req: true, upper: true, ph: 'e.g. G', title: 'Manufacturer code type (1 character, as per the ICEGATE code list)' },
      { k: 'manfProdCode', l: 'Code *', max: 17, req: true, upper: true, ph: 'GSTIN / PAN / IEC' },
      { k: 'manfProdAddress1', l: 'Address 1 *', max: 70, req: true, span: 2 },
      { k: 'manfProdAddress2', l: 'Address 2', max: 35, span: 2 },
      { k: 'manfProdCity', l: 'City *', max: 35, req: true },
      { k: 'manfProdSubDiv', l: 'State / subdivision', max: 35 },
      { k: 'manfProdPin', l: 'PIN', max: 10 },
      { k: 'manfProdCountry', l: 'Country (2 letters) *', max: 2, req: true, upper: true, re: /^[A-Z]{2}$/, ph: 'IN' },
      { k: 'transitCountry', l: 'Transit country (2 letters)', max: 2, upper: true, re: /^[A-Z]{2}$/ },
    ],
  },
  thirdParty: {
    title: 'Third Party Exporter', flag: 'thirdParty', kind: 'form', cols: 4,
    hint: 'Item exported on behalf of another exporter (ICEGATE THIRD PARTY table).',
    fields: [
      { k: 'tpExpIec', l: 'IEC *', max: 10, req: true, upper: true, re: /^[A-Z0-9]{10}$/ },
      { k: 'tpExpBranch', l: 'Branch Sr No *', max: 3, req: true, digits: true },
      { k: 'tpExpName', l: 'Exporter name *', max: 50, req: true, upper: true, span: 2 },
      { k: 'tpExpAddress1', l: 'Address 1 *', max: 50, req: true, upper: true, span: 2 },
      { k: 'tpExpAddress2', l: 'Address 2', max: 35, upper: true, span: 2 },
      { k: 'tpExpCity', l: 'City *', max: 35, req: true, upper: true },
      { k: 'tpExpPin', l: 'PIN *', max: 6, req: true, digits: true, re: /^[1-9][0-9]{5}$/ },
      { k: 'tpExpGstnType', l: 'GSTN type *', req: true, options: [['GSN', 'GSN - GSTIN'], ['GSG', 'GSG - GST Govt'], ['GSD', 'GSD - GST Diplomat'], ['PAN', 'PAN'], ['TAN', 'TAN'], ['PSP', 'PSP - Passport'], ['ADH', 'ADH - Aadhaar']] },
      { k: 'tpExpGstnId', l: 'GSTN id *', max: 20, req: true, upper: true },
      { k: 'tpExpValue', l: 'Value of third party (Y/N)', yn: true },
    ],
  },
  accessory: {
    title: 'Accessories', flag: 'accessory', kind: 'form', cols: 4,
    hint: 'Accessories sent with this item.',
    fields: [
      { k: 'accessoryStatus', l: 'Accessory status *', req: true, options: [['1', '1 - Included in the item price'], ['2', '2 - Invoiced separately']] },
      { k: 'accessoryValue', l: 'Accessories have value (Y/N)', yn: true },
      { k: 'accessoryDesc', l: 'Description of accessories *', max: 500, req: true, span: 4, area: true },
    ],
  },
  cess: {
    title: 'Export Cess', flag: 'cess', kind: 'grid', rowsKey: 'cessRows', max: 99,
    hint: 'Cess act code and quantity for each cess on this item (ICEGATE CESS table).',
    fields: [
      { k: 'cessActCode', l: 'Cess act code *', max: 10, req: true, upper: true, w: 160 },
      { k: 'quantity', l: 'Quantity *', num: true, req: true, w: 120 },
      { k: 'itemCessValue', l: 'Cess on value (Y/N)', yn: true, w: 140 },
    ],
  },
  swConst: {
    title: 'SW Constituents', flag: 'swConst', kind: 'grid', rowsKey: 'constRows', max: 99,
    hint: 'Constituents of the item (single window: chemicals, food, drugs).',
    fields: [
      { k: 'name', l: 'Element name *', max: 256, req: true, w: 220 },
      { k: 'code', l: 'Element code', max: 17, upper: true, w: 120 },
      { k: 'pct', l: 'Percentage *', num: true, req: true, w: 100 },
      { k: 'yieldPct', l: 'Yield %', num: true, w: 90 },
      { k: 'active', l: 'Active ingredient', yn: true, w: 120 },
    ],
  },
  swProd: {
    title: 'SW Production Batches', flag: 'swProd', kind: 'grid', rowsKey: 'prodRows', max: 99,
    hint: 'Production batch details (single window: food, drugs, cosmetics).',
    fields: [
      { k: 'batch', l: 'Batch id *', max: 17, req: true, upper: true, w: 140 },
      { k: 'qty', l: 'Batch qty *', num: true, req: true, w: 100 },
      { k: 'uqc', l: 'UQC *', max: 3, req: true, upper: true, w: 70 },
      { k: 'mfgDate', l: 'Mfg date *', date: true, req: true, w: 130 },
      { k: 'expDate', l: 'Expiry date', date: true, w: 130 },
      { k: 'bestBefore', l: 'Best before', date: true, w: 130 },
    ],
  },
  swCtrl: {
    title: 'SW Control', flag: 'swCtrl', kind: 'grid', rowsKey: 'ctrlRows', max: 99,
    hint: 'Controls / tests done on the item (single window).',
    fields: [
      { k: 'typeCode', l: 'Control type code *', max: 17, req: true, upper: true, w: 140 },
      { k: 'location', l: 'Location', max: 17, upper: true, w: 120 },
      { k: 'startDate', l: 'Start date', date: true, w: 130 },
      { k: 'endDate', l: 'End date', date: true, w: 130 },
      { k: 'resultCode', l: 'Result code', max: 17, upper: true, w: 110 },
      { k: 'remarks', l: 'Remarks', max: 4000, w: 220 },
    ],
  },
};

const fieldErr = (f, v) => {
  if (isEmpty(v)) return f.req ? `${f.l.replace(' *', '')} is mandatory` : '';
  if (f.re && !f.re.test(String(v).trim().toUpperCase())) return `${f.l.replace(' *', '')} is not valid`;
  if (f.num && !(parseFloat(v) > 0)) return `${f.l.replace(' *', '')} must be more than 0`;
  return '';
};

// count of filled details (shown on the chip)
export const detailCount = (key, formData) => {
  const w = WINDOWS[key]; if (!w) return 0;
  if (w.kind === 'grid') return arr(formData[w.rowsKey]).length;
  return w.fields.some(f => f.req && !isEmpty(formData[f.k])) ? 1 : 0;
};
// what is missing for a chip set to Y (used by the Save check of the item)
export const detailMissing = (key, formData) => {
  const w = WINDOWS[key]; if (!w || String(formData[w.flag] || 'N').toUpperCase() !== 'Y') return '';
  if (w.kind === 'grid') { const rows = arr(formData[w.rowsKey]); return !rows.length ? `${w.title}: add at least one row` : (rows.some(r => w.fields.some(f => fieldErr(f, r[f.k]))) ? `${w.title}: complete the rows` : ''); }
  return w.fields.some(f => fieldErr(f, formData[f.k])) ? `${w.title}: fill the details` : '';
};

export default function ItemDetailWindow({ which, onClose, formData, setFormData }) {
  const w = WINDOWS[which];
  const [vals, setVals] = useState({});
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!w) return;
    if (w.kind === 'grid') setRows(arr(formData[w.rowsKey]).map((r, i) => ({ ...r, _id: r._id || `${Date.now()}-${i}` })));
    else setVals(Object.fromEntries(w.fields.map(f => [f.k, formData[f.k] ?? (f.yn ? 'N' : '')])));
  }, [which]); // eslint-disable-line
  if (!w) return null;

  const norm = (f, v) => (f.upper ? String(v).toUpperCase() : f.digits ? String(v).replace(/\D/g, '') : v);
  const control = (f, v, set, key) => {
    const bad = !!fieldErr(f, v) && (f.req || !isEmpty(v));
    const st = { ...inp, ...(bad ? { borderColor: '#fca5a5' } : {}) };
    if (f.yn) return <select key={key} style={st} value={v || 'N'} onChange={e => set(e.target.value)}><option value="N">N - No</option><option value="Y">Y - Yes</option></select>;
    if (f.options) return <select key={key} style={st} value={v || ''} onChange={e => set(e.target.value)}><option value="">Select</option>{f.options.map(([o, t]) => <option key={o} value={o}>{t}</option>)}</select>;
    if (f.date) return <ModernDatePicker className="input-field" style={st} value={v || ''} onChange={e => set(e.target.value)} />;
    if (f.area) return <textarea key={key} style={{ ...st, height: '64px', padding: '6px 8px', resize: 'vertical' }} maxLength={f.max} value={v || ''} onChange={e => set(norm(f, e.target.value))} />;
    return <input key={key} style={{ ...st, ...(f.num ? { textAlign: 'right' } : {}) }} inputMode={f.num || f.digits ? 'decimal' : undefined} maxLength={f.max} placeholder={f.ph} title={f.title} value={v ?? ''} onChange={e => set(norm(f, e.target.value))} />;
  };

  // Cancel / close: nothing saved; a switch turned Y with no details yet goes back to N
  const cancel = () => { if (!detailCount(which, formData)) setFormData(prev => ({ ...prev, [w.flag]: 'N' })); onClose(); };
  const ok = () => {
    if (w.kind === 'grid') {
      const clean = rows.filter(r => w.fields.some(f => !isEmpty(r[f.k])));
      const errs = clean.flatMap((r, i) => w.fields.map(f => fieldErr(f, r[f.k])).filter(Boolean).map(e => `Row ${i + 1}: ${e}`));
      if (errs.length) { toast.error(errs.slice(0, 4).join('\n'), { duration: 5000 }); return; }
      setFormData(prev => ({ ...prev, [w.rowsKey]: clean.map(({ _id, ...r }) => r), [w.flag]: clean.length ? 'Y' : 'N' }));
    } else {
      const errs = w.fields.map(f => fieldErr(f, vals[f.k])).filter(Boolean);
      const anything = w.fields.some(f => !f.yn && !isEmpty(vals[f.k]));
      if (anything && errs.length) { toast.error(errs.slice(0, 4).join('\n'), { duration: 5000 }); return; }
      setFormData(prev => ({ ...prev, ...vals, [w.flag]: anything ? 'Y' : 'N' }));
    }
    onClose();
  };

  return (
    <BodyPortal>
      <div className="idw" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: w.kind === 'grid' ? 980 : 820, maxHeight: 'calc(100vh - 24px)', background: '#f8fafc', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}>
          <div style={{ flexShrink: 0, padding: '12px 18px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{w.title}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Item {formData.invSr || 1}/{formData.itemSr || 1} · {formData.desc || 'no description'} · {w.hint}</div>
            </div>
            <button type="button" onClick={cancel} title="Close without saving" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
          </div>
          <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', padding: '12px 18px' }}>
            {w.kind === 'form' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${w.cols}, minmax(0, 1fr))`, gap: '10px 12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
                {w.fields.map(f => (
                  <div key={f.k} style={f.span ? { gridColumn: `span ${f.span}` } : undefined}>
                    <label style={lbl} title={f.l}>{f.l}</label>
                    {control(f, vals[f.k], v => setVals(p => ({ ...p, [f.k]: v })), f.k)}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', width: 34 }}>#</th>
                    {w.fields.map(f => <th key={f.k} style={{ padding: '6px 8px', textAlign: 'left', minWidth: f.w, fontSize: 11 }}>{f.l}</th>)}
                    <th style={{ width: 40 }} />
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r._id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '4px 8px' }}>{i + 1}</td>
                        {w.fields.map(f => <td key={f.k} style={{ padding: '4px 6px' }}>{control(f, r[f.k], v => setRows(p => p.map(x => (x._id === r._id ? { ...x, [f.k]: v } : x))), r._id + f.k)}</td>)}
                        <td style={{ padding: '4px 6px' }}><button type="button" title="Remove row" onClick={() => setRows(p => p.filter(x => x._id !== r._id))} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                    {!rows.length && <tr><td colSpan={w.fields.length + 2} style={{ padding: 14, textAlign: 'center', color: '#94a3b8' }}>No row yet - click Add row.</td></tr>}
                  </tbody>
                </table>
                <div style={{ padding: 8 }}>
                  <button type="button" disabled={rows.length >= w.max} style={btn('#0284c7')} onClick={() => setRows(p => [...p, { _id: String(Date.now()), ...Object.fromEntries(w.fields.filter(f => f.yn).map(f => [f.k, 'N'])) }])}><Plus size={13} /> Add row</button>
                </div>
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, padding: '10px 18px', background: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>* needed by ICEGATE. OK with nothing filled sets the switch back to N.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={btn('#fff', '#334155', '1px solid #cbd5e1')} onClick={cancel}>Cancel</button>
              <button type="button" style={btn('#16a34a')} onClick={ok}>OK</button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
