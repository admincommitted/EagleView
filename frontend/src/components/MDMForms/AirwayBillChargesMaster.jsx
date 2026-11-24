import React, { useEffect, useState } from 'react';
import { Save, RefreshCw, Search } from 'lucide-react';
import switchRow from './switchRow';

/*
 * Airway Bill Charges Master (table Charge, API /api/masters/charges).
 * 28-Oct-2026: the old screen was only a layout - Save / Reset / List did nothing and the values were fixed text.
 * Now: add / edit / delete charges, list with search, GST details (SAC, rate), active flag. The AWB screens read
 * this table for the "Other Charges" code list (inactive charges are hidden there).
 */
const CHARGE_TYPES = ['Taxable(Due Agent)', 'Taxable(Due Carrier)', 'Non-Taxable'];
const EMPTY = { id: null, chargeType: 'Taxable(Due Agent)', chargeName: '', awbChargeName: '', awbChargeCode: '', entitlement: 'DUE_AGENT', sacCode: '', gstRate: '18', isActive: true };

export default function AirwayBillChargesMaster() {
  const [form, setForm] = useState(EMPTY);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const inputStyle = { width: '100%', padding: '4px 8px', borderRadius: '4px', border: '1px solid #94a3b8', fontSize: '12px', outline: 'none', boxSizing: 'border-box' };
  const mandatoryStyle = { ...inputStyle, border: '1px solid #ef4444' };
  const labelStyle = { fontSize: '12px', color: '#1e293b', whiteSpace: 'nowrap', minWidth: '110px' };
  const btn = (bg, fg = '#fff', border = 'none') => ({ display: 'flex', alignItems: 'center', gap: '6px', background: bg, color: fg, border, padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' });

  const show = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000); };
  const load = async () => {
    try {
      const res = await fetch('/api/masters/charges');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load charges');
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { show(e.message, 'err'); }
  };
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === 'chargeType') {
      if (v === 'Non-Taxable') next.gstRate = '0';
      if (v === 'Taxable(Due Carrier)') next.entitlement = 'DUE_CARRIER';
      if (v === 'Taxable(Due Agent)') next.entitlement = 'DUE_AGENT';
    }
    return next;
  });

  const save = async () => {
    const f = { ...form, chargeName: form.chargeName.trim().toUpperCase(), awbChargeName: (form.awbChargeName || form.chargeName).trim().toUpperCase(), awbChargeCode: form.awbChargeCode.trim().toUpperCase(), sacCode: String(form.sacCode || '').trim() };
    if (!f.chargeName) return show('Charge Name is mandatory', 'err');
    if (!f.awbChargeName) return show('AWB Charge Name is mandatory', 'err');
    if (f.awbChargeCode && !/^[A-Z]{2}[AC]?$/.test(f.awbChargeCode)) return show('AWB Charge Code: 2 letters (IATA other-charge code, e.g. MY, SC, XR), optional A / C for agent / carrier', 'err');
    if (f.sacCode && !/^\d{6}$/.test(f.sacCode)) return show('SAC code must be 6 digits (e.g. 996531)', 'err');
    const rate = f.gstRate === '' || f.gstRate == null ? 0 : Number(f.gstRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 28) return show('GST rate must be 0 - 28 %', 'err');
    if (f.chargeType !== 'Non-Taxable' && rate === 0) return show('Taxable charge needs a GST rate (or choose Non-Taxable)', 'err');
    if (rows.some(r => r.id !== f.id && String(r.awbChargeName || '').toUpperCase() === f.awbChargeName)) return show('Duplicate: this AWB Charge Name already exists', 'err');
    const { id, createdAt, updatedAt, ...body } = f;
    body.gstRate = rate;
    setBusy(true);
    try {
      const res = await fetch(id ? `/api/masters/charges/${id}` : '/api/masters/charges', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      show(id ? 'Charge updated' : 'Charge added');
      setForm(EMPTY);
      load();
    } catch (e) { show(e.message, 'err'); } finally { setBusy(false); }
  };

  // 22-Nov-2026: a charge is switched off / on, not deleted (off = not shown in AWB screens)
  const flip = async (row) => {
    const done = await switchRow('charges', { ...row, isActive: row.isActive !== false }, 'charge ' + (row.awbChargeName || row.chargeName || ''));
    if (done) { show(row.isActive !== false ? 'Charge switched off' : 'Charge switched on'); if (form.id === row.id) setForm(EMPTY); load(); }
  };

  const edit = (r) => setForm({ ...EMPTY, ...r, chargeName: r.chargeName || r.awbChargeName || '', awbChargeCode: r.awbChargeCode || '', sacCode: r.sacCode || '', gstRate: r.gstRate == null ? '' : String(r.gstRate), entitlement: r.entitlement || (r.chargeType === 'Taxable(Due Carrier)' ? 'DUE_CARRIER' : 'DUE_AGENT'), isActive: r.isActive !== false });

  const q = search.trim().toUpperCase();
  const list = rows.filter(r => !q || `${r.awbChargeCode || ''} ${r.awbChargeName || ''} ${r.chargeName || ''} ${r.sacCode || ''}`.toUpperCase().includes(q));

  return (
    <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '8px 8px 0 0', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 'bold' }}>Airway Bill Charges Master {form.id ? <span style={{ fontSize: '12px', color: '#0369a1' }}>(editing)</span> : null}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="modern-btn" disabled={busy} onClick={save} style={btn('#3b82f6')}><Save size={16} /> {form.id ? 'Update' : 'Save'}</button>
          <button className="modern-btn" onClick={() => setForm(EMPTY)} style={btn('#f8fafc', '#475569', '1px solid #cbd5e1')}><RefreshCw size={16} /> Reset</button>
          {form.id && <button className="modern-btn" onClick={() => flip(form)} style={btn('#b45309')}>{form.isActive !== false ? 'Switch off' : 'Switch on'}</button>}
        </div>
      </div>

      {msg && <div style={{ margin: '8px 16px 0', padding: '6px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, background: msg.type === 'err' ? '#fee2e2' : '#dcfce7', color: msg.type === 'err' ? '#b91c1c' : '#166534' }}>{msg.text}</div>}

      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px 16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>Charge Type</label>
            <select style={mandatoryStyle} value={form.chargeType} onChange={e => set('chargeType', e.target.value)}>
              {CHARGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>Charge Name</label>
            <input type="text" style={mandatoryStyle} value={form.chargeName} placeholder="X-RAY CHGS" onChange={e => set('chargeName', e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>AWB Charge Name</label>
            <input type="text" style={inputStyle} value={form.awbChargeName} placeholder="same as Charge Name" onChange={e => set('awbChargeName', e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>AWB Charge Code</label>
            <input type="text" style={inputStyle} maxLength={3} value={form.awbChargeCode} placeholder="XR" onChange={e => set('awbChargeCode', e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>Due</label>
            <select style={inputStyle} value={form.entitlement} onChange={e => set('entitlement', e.target.value)}>
              <option value="DUE_AGENT">Due Agent</option>
              <option value="DUE_CARRIER">Due Carrier</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>SAC Code</label>
            <input type="text" style={inputStyle} maxLength={6} value={form.sacCode} placeholder="996531" onChange={e => set('sacCode', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={labelStyle}>GST Rate %</label>
            <input type="number" min="0" max="28" step="0.01" style={inputStyle} value={form.gstRate} disabled={form.chargeType === 'Non-Taxable'} onChange={e => set('gstRate', e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <input type="checkbox" checked={form.isActive !== false} onChange={e => set('isActive', e.target.checked)} /> Active (shown in AWB screens)
          </label>
        </div>

        <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <b style={{ fontSize: '13px', color: '#1e293b' }}>Charges ({list.length})</b>
            <div style={{ marginLeft: 'auto', position: 'relative', width: '240px', maxWidth: '50%' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8' }} />
              <input type="text" placeholder="Search code / name / SAC" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft: '26px' }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ background: '#e0f2fe' }}>
                <tr>{['Code', 'AWB Charge Name', 'Charge Name', 'Type', 'Due', 'SAC', 'GST %', 'Active', ''].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} onClick={() => edit(r)} style={{ cursor: 'pointer', background: form.id === r.id ? '#f0f9ff' : undefined, borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{r.awbChargeCode || '-'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.awbChargeName}</td>
                    <td style={{ padding: '6px 8px' }}>{r.chargeName || '-'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.chargeType}</td>
                    <td style={{ padding: '6px 8px' }}>{r.entitlement === 'DUE_CARRIER' ? 'Carrier' : r.entitlement === 'DUE_AGENT' ? 'Agent' : '-'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.sacCode || '-'}</td>
                    <td style={{ padding: '6px 8px' }}>{r.gstRate == null ? '-' : Number(r.gstRate)}</td>
                    <td style={{ padding: '6px 8px', color: r.isActive === false ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{r.isActive === false ? 'No' : 'Yes'}</td>
                    <td style={{ padding: '6px 8px' }}><button onClick={(e) => { e.stopPropagation(); flip(r); }} style={{ background: 'none', border: 'none', color: r.isActive === false ? '#15803d' : '#b45309', cursor: 'pointer', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.isActive === false ? 'SWITCH ON' : 'SWITCH OFF'}</button></td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No charges yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
