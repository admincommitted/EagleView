// Screen section: Item Details
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { ArrowUpDown, CheckCircle, Copy, Edit2, Info, RefreshCw, Save, X } from 'lucide-react';
import { asList } from '../../../../../utils/asList';
import React, { useState } from 'react';
import RichAutocomplete from '../../../../common/RichAutocomplete';
import KeySeg from '../../../../common/KeySeg';
import toast from 'react-hot-toast';
import askConfirm, { askText } from '../../../../common/askConfirm'; // EagleView windows, 20-Nov-2026
import { validateIcegateRules } from '../../../../../utils/IcegateValidators';
import ItemDetailWindow, { detailCount, detailMissing } from './ItemDetailWindows';
import { districtsOf } from '../districtCodes';

// defined outside the component: a component defined inside would be new on every render and the boxes would lose
// the cursor after each key.
// Compact layout (29-Oct-2026): label beside the box, 26px boxes, Y/N switches as small chips that open their window.
const Cell = ({ label, span, children, w }) => (
  <div className="itd-cell" style={span ? { gridColumn: `span ${span}` } : undefined}>
    <span className="itd-lbl" style={w ? { width: w, minWidth: w } : undefined} title={label}>{label}</span>
    <div className="itd-ctl">{children}</div>
  </div>);
const Chip = ({ label, field, open, count, formData, handleFormChange }) => {
  const on = String(formData[field] || 'N').toUpperCase() === 'Y';
  return (
    <div className={'itd-chip' + (on ? ' on' : '')}>
      {/* keyboard: Tab to it, then Y / N, Space switches, Enter opens the details window (29-Oct-2026) */}
      <button type="button" className="itd-sw" title={`${label}: ${on ? 'Yes' : 'No'} - Y / N keys, Space switches${open ? ', Enter opens the details' : ''}`}
        onClick={() => { const v = on ? 'N' : 'Y'; handleFormChange(field, v); if (v === 'Y' && open) open(); }}
        onKeyDown={e => {
          const k = e.key.toUpperCase();
          if (k === 'Y' || k === 'N') { e.preventDefault(); if ((k === 'Y') !== on) handleFormChange(field, k); if (k === 'Y' && !on && open) open(); }
          else if (e.key === 'Enter' && open && on) { e.preventDefault(); open(); }
        }}>
        <span className="itd-dot" />{on ? 'Y' : 'N'}
      </button>
      <span className="itd-chip-lbl" title={label}>{label}</span>
      {open && <button type="button" tabIndex={-1} className="itd-more" title={`${label} details`} onClick={open}>{count ? count : '…'}</button>}
    </div>);
};
const CSS = `
.itd { font-size: 12px; }
.itd-band { display: flex; align-items: center; gap: 10px; padding: 4px 10px; background: var(--primary-bg-light, #f0f9ff); border-top: 1px solid #bae6fd; border-bottom: 1px solid #e2e8f0; color: var(--primary-color-start, #0ea5e9); font-weight: 700; font-size: 11.5px; letter-spacing: .03em; }
.itd-band small { color: #64748b; font-weight: 500; letter-spacing: 0; }
.itd-body { padding: 6px 10px; display: grid; gap: 5px; }
.itd-grid { display: grid; gap: 5px 12px; align-items: center; }
.itd-cell { display: flex; align-items: center; gap: 6px; min-width: 0; }
.itd-lbl { width: 86px; min-width: 86px; font-size: 11px; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.itd-ctl { flex: 1; min-width: 0; display: flex; gap: 4px; align-items: center; }
.itd input.input-field, .itd select.input-field, .itd .itd-ctl input, .itd .itd-ctl select { height: 26px !important; min-height: 26px; padding-top: 0 !important; padding-bottom: 0 !important; font-size: 12px; box-sizing: border-box; width: 100%; }
.itd-ro { background: #f1f5f9 !important; color: #475569; }
.itd-pick { display: flex; height: 26px; flex: 1; min-width: 0; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px; overflow: hidden; background: var(--bg-input, #fff); }
.itd-pick input { border: none !important; height: 24px !important; padding: 0 6px !important; flex: 1; min-width: 0; background: transparent; }
.itd-pick button { border: none; border-left: 1px solid var(--border-color, #cbd5e1); background: #f8fafc; padding: 0 6px; cursor: pointer; display: flex; align-items: center; }
.itd-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.itd-chip { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 3px 0 3px; border: 1px solid #e2e8f0; border-radius: 13px; background: #fff; }
.itd-chip.on { border-color: #86efac; background: #f0fdf4; }
.itd-sw { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 10px; border: none; cursor: pointer; font-size: 10.5px; font-weight: 800; background: #e2e8f0; color: #475569; }
.itd-chip.on .itd-sw { background: #16a34a; color: #fff; }
.itd-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .7; }
.itd-chip-lbl { font-size: 11px; font-weight: 600; color: #334155; white-space: nowrap; padding-right: 4px; }
.itd-more { height: 20px; min-width: 22px; padding: 0 6px; border-radius: 10px; border: 1px solid #bae6fd; background: #f0f9ff; color: #0369a1; font-size: 11px; font-weight: 800; cursor: pointer; }
.itd-sub { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: .06em; margin-right: 2px; align-self: center; }
.itd-seg { display: inline-flex; border: 1px solid var(--border-color, #cbd5e1); border-radius: 4px; overflow: hidden; height: 26px; }
.itd-seg button { border: none; background: #fff; padding: 0 9px; font-size: 11px; font-weight: 700; color: #475569; cursor: pointer; }
.itd-seg button.on { background: #0ea5e9; color: #fff; }
.itd button:focus-visible, .itd .itd-sw:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 1px; position: relative; z-index: 1; }
`;

export default function ItemDetailsSection({ ctx }) {
  const { exportData, formData, handleFormChange, items, schemesList, selectedRowId, setActiveItemForRitc, setActiveItemForScheme, setFormData, setIsESanchitModalOpen, setIsManfModalOpen, setIsReExportModalOpen, setIsRitcModalOpen, setIsSchemeModalOpen, setIsSwInfoModalOpen, setIsSwStatementModalOpen, setItems, setRitcFilter, setSelectedRowId, setValidationErrors, setValidationSuccess, states, tariffs } = ctx;
  const { nextItemSr, setCcrItem } = ctx;
  // an item is open only when it is still in the list (12-Nov-2026: an empty job / a deleted item still said "Editing item 1")
  const editing = selectedRowId != null && (items || []).some(i => i.id === selectedRowId);
  const [win, setWin] = useState(''); // open detail window (ItemDetailWindows.jsx)
  const winProps = (k) => ({ open: () => setWin(k), count: detailCount(k, formData) });
  // item checks before Save / Modify (ICEGATE: RITC 8 digits, description, qty, UQC, unit price; IGST P needs taxable value and amount)
  const itemOk = () => {
    const e = [];
    const ritc = String(formData.ritc || '').replace(/\D/g, '');
    if (!String(formData.scheme || '').trim()) e.push('Scheme code');
    if (ritc.length !== 8) e.push('RITC (8 digits)');
    if (!String(formData.desc || '').trim()) e.push('Description');
    if (!(parseFloat(formData.qty) > 0)) e.push('Quantity');
    if (!String(formData.unit || '').trim()) e.push('Qty unit (UQC)');
    if (!(parseFloat(formData.rate) > 0)) e.push('Rate');
    if (/\(P\)/.test(String(formData.igstPayStatus || '')) && !(parseFloat(formData.taxableValue) > 0 && parseFloat(formData.igstAmt) > 0)) e.push('Taxable value and IGST amount (IGST paid)');
    // mandatory in the SB item (29-Oct-2026)
    if (!formData.igstPayStatus || formData.igstPayStatus === 'Select') e.push('IGST Pay Status');
    if (!String(formData.endUse || '').trim()) e.push('End Use (e.g. GNX100)');
    // SW info ORC / STO and ORC / DOO (state and district of origin) go with every item (29-Oct-2026)
    if (!String(formData.stateCode || '').trim()) e.push('Source State');
    if (!String(formData.districtCode || '').trim()) e.push('District of origin');
    if (!(parseFloat(formData.per) > 0)) e.push('Per (more than 0)');
    if (!(exportData?.invoices || []).length) e.push('an invoice (Invoices tab)');
    // a Y switch needs its details (29-Oct-2026)
    ['manf', 'cess', 'thirdParty', 'accessory', 'swConst', 'swProd', 'swCtrl'].forEach(k => { const m = detailMissing(k, formData); if (m) e.push(m); });
    if (e.length) { toast.error('Fill: ' + e.join(', ')); return false; }
    return true;
  };
  // the list keeps both the screen names and the names the SB builder / grid read
  const buildRow = (f) => ({ ...f, ritc: String(f.ritc || '').replace(/\D/g, ''), uqc: f.unit, price: f.rate, total: f.totalFc,
    pmvType: f.pmvOption === 'Percentage' ? '%' : 'M', unitPmv: f.pmv, totalPmv: f.totalPmv, suppDocs: asList(f.eSanchitList).length ? 'Y' : (f.suppDocs || 'N') });
  // serial 1, 2, 3 ... inside each invoice (was one running number over all invoices)
  // 17-Nov-2026: SW info / RoDTEP / statement rows of the job (read from a file) follow their items when items are
  // deleted, moved or renumbered (item 3 that became item 2 took the old item 2's rows)
  const putItems = (list) => { if (ctx.remapItemRows) ctx.remapItemRows(items, list); setItems(list); };
  const renumber = (list) => { const c = {}; return list.map(i => { const k = parseInt(i.invSr, 10) || 1; c[k] = (c[k] || 0) + 1; return { ...i, itemSr: c[k] }; }); };
  // Modify: the open item takes the form's values (also used by Save while an item is open, 17-Nov-2026). true = done
  const modifyItem = () => {
    if (!selectedRowId) { toast.error('Open an item first (pencil icon in the list)'); return false; }
    if (!itemOk()) return false;
    const old = items.find(i => i.id === selectedRowId);
    const invSr = parseInt(formData.invSr, 10) || 1;
    const moved = old && (parseInt(old.invSr, 10) || 1) !== invSr;
    let list = items.map(item => item.id === selectedRowId ? buildRow({ ...item, ...formData, id: item.id, invSr, itemSr: moved ? nextItemSr(invSr, items, item.id) : formData.itemSr }) : item);
    if (moved) list = renumber(list);
    putItems(list);
    toast.success('Item updated' + (moved ? ` and moved to invoice ${invSr}` : ''));
    clearForm(invSr);
    return true;
  };
  const clearForm = (invSr) => {
    const inv = parseInt(invSr, 10) || 1;
    if (ctx.clearFormEdits) ctx.clearFormEdits(); // a fresh form has nothing unsaved
    setSelectedRowId(null);
    setFormData({
      invSr: inv, itemSr: nextItemSr(inv), scheme: '', ritc: '', desc: '', chkDesc: '', qty: '', unit: '', per: '1', rate: '', rateUnit: '', totalFc: '',
      pmvOption: 'Percentage', pmvPer: '', pmv: '', totalPmv: '', itemFob: '',
      endUse: '', igstPayStatus: 'Select', taxableValue: '', igstRate: '', igstAmt: '',
      rodtep: 'N', swInfo: 'N', swStatement: 'N', suppDocs: 'N', reExport: 'N', manfDetails: 'N',
      sourceState: formData.sourceState || '', stateCode: formData.stateCode || '', districtCode: formData.districtCode || '', hawb: '', totalPkgs: '', swConst: 'N', swProd: 'N', swCtrl: 'N',
      accessory: 'N', cess: 'N', thirdParty: 'N', ar4: 'N', reward: 'N', addInTemplate: false, addInMiddle: '', copyLicence: '', eSanchitList: []
    });
  };
  const igstPaid = /\(P\)/.test(String(formData.igstPayStatus || ''));
  return (
    <>
    <div className="glass-panel itd" style={{ padding: '0', marginBottom: '0.5rem', background: 'var(--bg-app, #f8fafc)', border: '1px solid var(--border-color, #cbd5e1)' }}>
        <style>{CSS}</style>
        {win && <ItemDetailWindow which={win} onClose={() => setWin('')} formData={formData} setFormData={setFormData} />}

        {/* ITEM DETAILS */}
        <div className="itd-band" style={{ borderTop: 'none' }}>Item Details <small>{editing ? `editing item ${formData.itemSr || ''} of invoice ${formData.invSr || 1}` : 'new item'}</small></div>
        <div className="itd-body">
          <div className="itd-grid" style={{ gridTemplateColumns: '1.1fr .6fr 2fr 1.6fr' }}>
            <Cell label="Inv Sr No">
              <select className="input-field" style={{ color: 'var(--primary-color-start, #0ea5e9)', fontWeight: 700 }} value={formData.invSr || 1} onChange={e => handleFormChange('invSr', e.target.value)}>
                {exportData?.invoices?.length > 0 ? exportData.invoices.map((inv, idx) => <option key={idx} value={idx + 1}>{idx + 1} - {inv.no || 'NEW'}</option>) : <option value="1">1 - NEW</option>}
              </select>
            </Cell>
            <Cell label="Item Sr" w="46px"><input type="text" className="input-field" value={formData.itemSr} onChange={e => handleFormChange('itemSr', e.target.value)} /></Cell>
            <Cell label="Scheme" w="54px">
              <div className="itd-pick" style={{ flex: '0 0 82px' }}>
                <input type="text" value={String(formData.scheme).split(' ')[0] || ''} onChange={e => handleFormChange('scheme', e.target.value)} onBlur={() => { const code = String(formData.scheme).trim(); if (code && !code?.includes('-')) { const found = schemesList.find(s => s.code === code); if (found) handleFormChange('scheme', `${found.code} - ${found.desc}`); } }} />
                <button type="button" tabIndex={-1} title="Search scheme codes" onClick={() => { setActiveItemForScheme('FORM'); setIsSchemeModalOpen(true); }}><Info size={13} color="#2563eb" /></button>
              </div>
              <input type="text" tabIndex={-1} className="input-field itd-ro" value={String(formData.scheme)?.includes('-') ? String(formData.scheme).split('-')[1].trim() : ''} readOnly title="Scheme description" />
            </Cell>
            <Cell label="RITC" w="34px">
              <div className="itd-pick">
                <input type="text" value={formData.ritc || ''} maxLength={8} onChange={e => handleFormChange('ritc', e.target.value)} onBlur={() => { const code = String(formData.ritc).trim(); const found = tariffs.find(r => r.hsnCode === code); if (found) { handleFormChange('desc', found.description); handleFormChange('unit', found.uqc); handleFormChange('rateUnit', found.uqc); } }} />
                <button type="button" tabIndex={-1} title="Search RITC" onClick={() => { const val = formData.ritc || ''; if (val.length < 2) { toast.error('Please enter at least 2 digits to search RITC'); return; } setActiveItemForRitc('FORM'); setRitcFilter(val); setIsRitcModalOpen(true); }}><Info size={13} color="#2563eb" /></button>
              </div>
              {/* compliance requirements of the RITC (export policy, duty, drawback / RoDTEP rates) */}
              <button className="btn" type="button" tabIndex={-1} title="Compulsory compliance requirements of this RITC" onClick={() => { const r = String(formData.ritc || '').replace(/\D/g, ''); if (r.length < 4) { toast.error('Enter the RITC first'); return; } setCcrItem({ ritc: r, desc: formData.desc }); }} style={{ height: '26px', padding: '0 8px', fontSize: '10.5px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 800 }}>CCRs</button>
            </Cell>
          </div>
          <Cell label="Description"><input type="text" className="input-field" style={{ background: '#f0fdf4', borderColor: '#16a34a' }} value={formData.desc} onChange={e => handleFormChange('desc', e.target.value)} /></Cell>
          <Cell label="Checklist"><input type="text" className="input-field" value={formData.chkDesc} placeholder="only printed on the checklist, not sent to customs" onChange={e => handleFormChange('chkDesc', e.target.value)} /></Cell>
          <div className="itd-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
            <Cell label="Qty" w="62px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.qty} onChange={e => handleFormChange('qty', e.target.value)} /></Cell>
            <Cell label="Qty Unit" w="62px"><input type="text" className="input-field" style={{ background: '#f0fdf4' }} value={formData.unit} onChange={e => handleFormChange('unit', e.target.value)} /></Cell>
            <Cell label="Per" w="62px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.per} onChange={e => handleFormChange('per', e.target.value)} /></Cell>
            <Cell label="Rate" w="62px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.rate} onChange={e => handleFormChange('rate', e.target.value)} /></Cell>
            <Cell label="Rate UQC" w="62px"><input type="text" className="input-field" style={{ background: '#f0fdf4' }} value={formData.rateUnit} onChange={e => handleFormChange('rateUnit', e.target.value)} /></Cell>
            <Cell label="Total FC" w="70px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right', fontWeight: 700 }} value={formData.totalFc} onChange={e => handleFormChange('totalFc', e.target.value)} /></Cell>
            <Cell label="PMV" w="62px">
              <KeySeg className="itd-seg" title="PMV as % of value or typed by hand (arrow keys / P / M)" value={formData.pmvOption} options={[['Percentage', '%'], ['Manual', 'Manual']]} onChange={v => handleFormChange('pmvOption', v)} />
            </Cell>
            <Cell label="PMV %" w="62px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.pmvPer} onChange={e => handleFormChange('pmvPer', e.target.value)} /></Cell>
            <Cell label="PMV/Unit" w="62px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.pmv} onChange={e => handleFormChange('pmv', e.target.value)} /></Cell>
            <Cell label="Total PMV" w="70px"><input type="text" inputMode="decimal" className="input-field" style={{ textAlign: 'right' }} value={formData.totalPmv} onChange={e => handleFormChange('totalPmv', e.target.value)} /></Cell>
            <Cell label="FOB ₹" w="62px" span={2}><input type="text" tabIndex={-1} className="input-field itd-ro" style={{ textAlign: 'right', fontWeight: 700 }} readOnly value={formData.itemFob} title="Item FOB (INR), worked out from the invoice" /></Cell>
          </div>
        </div>

        {/* GST, ORIGIN AND PACKAGES */}
        <div className="itd-band">GST, Origin &amp; Packages</div>
        <div className="itd-body">
          <div className="itd-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {/* 30-Oct-2026: the SB carries jobWorkNotificationNo and there was no box for it anywhere */}
            <Cell label="Job Work Notn">
              <input type="text" maxLength={10} className="input-field" placeholder="notification no" title="Job-work notification number (SB jobWorkNotificationNo); blank when the export is not under job work"
                value={formData.jobWorkNotificationNo || ''} onChange={e => handleFormChange('jobWorkNotificationNo', e.target.value.toUpperCase())} />
            </Cell>
            <Cell label="End Use">
              <input type="text" list="endUseOptions" className="input-field" value={formData.endUse || ''} onChange={e => handleFormChange('endUse', e.target.value.toUpperCase())} placeholder="e.g. GNX100" />
              <datalist id="endUseOptions">
                <option value="GNX100">GNX100 || Generic -For Consumer use under commercial distribution</option>
                <option value="GNX200">GNX200 || Generic -For Commercial Assembly or processing</option>
                <option value="GNX300">GNX300 || Generic -For use as Fertilizers or soil promoters</option>
                <option value="GNX600">GNX600 || Generic -For Repair or Refurbishing as defective or second hand goods</option>
                <option value="GNX650">GNX650 || Generic -For Recycling or Recovery</option>
                <option value="GNX680">GNX680 || Generic -For Disposal as waste</option>
                <option value="GNX700">GNX700 || Generic -For Public Display or Exhibition</option>
                <option value="GNX810">GNX810 || Generic -For Research &amp; Development</option>
                <option value="GNX815">GNX815 || Generic -For Medical Or Biomedical Research</option>
                <option value="GNX915">GNX915 || Generic -For display as a Trophy</option>
              </datalist>
            </Cell>
            <Cell label="IGST Status">
              <select className="input-field" value={formData.igstPayStatus} onChange={e => handleFormChange('igstPayStatus', e.target.value)}>
                <option>Select</option><option>Not Applicable (NA)</option><option>Export Under Bond (LUT)</option><option>Export Against Payment (P)</option>
              </select>
            </Cell>
            <Cell label="Taxable ₹"><input type="text" inputMode="decimal" className={'input-field' + (igstPaid ? '' : ' itd-ro')} style={{ textAlign: 'right' }} disabled={!igstPaid} value={formData.taxableValue || ''} onChange={e => handleFormChange('taxableValue', e.target.value)} /></Cell>
            <Cell label="IGST % / ₹">
              <input type="text" inputMode="decimal" className={'input-field' + (igstPaid ? '' : ' itd-ro')} style={{ textAlign: 'right', flex: '0 0 30%' }} disabled={!igstPaid} value={formData.igstRate || ''} onChange={e => handleFormChange('igstRate', e.target.value)} title="IGST rate %" />
              <input type="text" inputMode="decimal" className={'input-field' + (igstPaid ? '' : ' itd-ro')} style={{ textAlign: 'right' }} disabled={!igstPaid} value={formData.igstAmt || ''} onChange={e => handleFormChange('igstAmt', e.target.value)} title="IGST amount (INR)" />
            </Cell>
            <Cell label="Source State">
              <div style={{ flex: 1, minWidth: 0 }}>
                <RichAutocomplete
                  options={states}
                  value={formData.sourceState}
                  onChange={v => setFormData({...formData, sourceState: v})}
                  onSelect={s => setFormData(prev => ({ ...prev, sourceState: s.stateName, stateCode: s.taxCode, districtCode: districtsOf(s.taxCode).some(d => d[0] === prev.districtCode) ? prev.districtCode : '' }))}
                  searchFilter={(s, q) => s.stateName?.toLowerCase()?.includes(q?.toLowerCase()) || s.taxCode?.includes(q)}
                  renderOption={s => (
                    <>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color-start, #0ea5e9)', fontSize: '11px' }}>{s.stateName}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted, #64748b)' }}>Code: {s.taxCode}</div>
                    </>
                  )}
                  placeholder="State Name"
                  inputStyle={{ height: '26px', boxSizing: 'border-box', width: '100%', color: 'var(--text-main, #0f172a)' }}
                />
              </div>
              <input type="text" tabIndex={-1} className="input-field itd-ro" style={{ flex: '0 0 40px', textAlign: 'center' }} value={formData.stateCode || ''} readOnly title="State code" />
            </Cell>
            {/* district of origin: SW info ORC / DOO, sent for every item (29-Oct-2026) */}
            <Cell label="District">
              <select className="input-field" value={formData.districtCode || ''} onChange={e => handleFormChange('districtCode', e.target.value)} title={formData.stateCode ? 'District of origin (ICEGATE code)' : 'Pick the source state first'}>
                <option value="">{formData.stateCode ? 'Select district' : 'Pick state first'}</option>
                {districtsOf(formData.stateCode).map(([c, n]) => <option key={c} value={c}>{n} ({c})</option>)}
              </select>
            </Cell>
            <Cell label="HAWB No"><input type="text" className="input-field" value={formData.hawb || ''} onChange={e => handleFormChange('hawb', e.target.value.toUpperCase())} /></Cell>
            <Cell label="Total Pkgs"><input type="text" inputMode="numeric" className="input-field" style={{ textAlign: 'right' }} value={formData.totalPkgs || ''} onChange={e => handleFormChange('totalPkgs', e.target.value.replace(/\D/g, ''))} /></Cell>
          </div>
        </div>

        {/* Y/N SWITCHES - click a chip to switch it; the small button opens its window */}
        <div className="itd-band">Single Window &amp; Other Details <small>click Y/N to switch · … opens the details</small></div>
        <div className="itd-body">
          <div className="itd-chips">
            <span className="itd-sub">SW</span>
            <Chip formData={formData} handleFormChange={handleFormChange} label="RoDTEP" field="rodtep" />
            <Chip formData={formData} handleFormChange={handleFormChange} label="SW Info" field="swInfo" open={() => setIsSwInfoModalOpen(true)} count={asList(formData.swInfos).length} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="SW Statement" field="swStatement" open={() => setIsSwStatementModalOpen(true)} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Supporting Docs" field="suppDocs" open={() => setIsESanchitModalOpen(true)} count={asList(formData.eSanchitList).length} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Re-Export" field="reExport" open={() => setIsReExportModalOpen(true)} count={Array.isArray(formData.reExports) ? formData.reExports.length : 0} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Manufacturer" field="manfDetails" {...winProps('manf')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="SW Constituent" field="swConst" {...winProps('swConst')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="SW Production" field="swProd" {...winProps('swProd')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="SW Control" field="swCtrl" {...winProps('swCtrl')} />
          </div>
          <div className="itd-chips">
            <span className="itd-sub">OTHER</span>
            <Chip formData={formData} handleFormChange={handleFormChange} label="Accessory" field="accessory" {...winProps('accessory')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Cess" field="cess" {...winProps('cess')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Third Party" field="thirdParty" {...winProps('thirdParty')} />
            <Chip formData={formData} handleFormChange={handleFormChange} label="AR4" field="ar4" />
            <Chip formData={formData} handleFormChange={handleFormChange} label="Reward" field="reward" />
            <span style={{ flex: 1 }} />
            <label className="itd-chip" style={{ paddingRight: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 14, height: 14, margin: '0 2px 0 4px' }} checked={!!formData.addInTemplate} onChange={e => handleFormChange('addInTemplate', e.target.checked)} />
              <span className="itd-chip-lbl">Add in template</span>
            </label>
            <div className="itd-cell" style={{ width: 186 }}><span className="itd-lbl" style={{ width: 104, minWidth: 104 }} title="Add in middle: before item no">Add before item</span><div className="itd-ctl"><input type="text" inputMode="numeric" className="input-field" value={formData.addInMiddle || ''} onChange={e => handleFormChange('addInMiddle', e.target.value.replace(/\D/g, ''))} placeholder="no" /></div></div>
            <div className="itd-cell" style={{ width: 186 }}><span className="itd-lbl" style={{ width: 104, minWidth: 104 }} title="Copy licence rows from item no">Copy licence of</span><div className="itd-ctl"><input type="text" inputMode="numeric" className="input-field" value={formData.copyLicence || ''} onChange={e => handleFormChange('copyLicence', e.target.value.replace(/\D/g, ''))} placeholder="item" /></div></div>
          </div>
        </div>
        {/* ACTION BUTTONS (29-Oct-2026: checks, serial per invoice, confirm before delete, Clear empties the form) */}
        <div style={{ padding: '6px 10px', background: 'var(--primary-bg-light, #f0f9ff)', borderTop: '1px solid #bae6fd', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', position: 'sticky', bottom: 0, zIndex: 50, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: editing ? '#b45309' : '#15803d', marginRight: '4px' }}>
            {editing ? `Editing item ${formData.itemSr || ''} - Save / Modify keep the changes (Add Item for a new one)` : 'New item - Save adds it'}
          </span>
          <button className="btn btn-success" title={editing ? 'An item is open: Save updates it (as Modify). For a new item press Add Item first.' : 'Add this item'} style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => {
            // 17-Nov-2026: Save on an open item added a full copy of it as a new item (the SB would carry the item twice);
            // it updates the open item now, as on the Import screen. A new item: Add Item (empty form), then Save.
            if (editing) { if (modifyItem()) toast('Save on an open item works as Modify - for a new item press Add Item first', { icon: 'ℹ️', duration: 5000 }); return; }
            if (!itemOk()) return;
            const invSr = parseInt(formData.invSr, 10) || 1;
            const row = buildRow({ ...formData, id: Date.now(), invSr, itemSr: nextItemSr(invSr) });
            // "Add In Middle": put the item before that item no of the same invoice
            const at = parseInt(formData.addInMiddle, 10);
            let list = [...items, row];
            if (at > 0) {
              const pos = items.findIndex(i => (parseInt(i.invSr, 10) || 1) === invSr && (parseInt(i.itemSr, 10) || 0) === at);
              if (pos >= 0) { list = [...items.slice(0, pos), row, ...items.slice(pos)]; list = renumber(list); }
            }
            putItems(list);
            toast.success(`Item added to invoice ${invSr}${at > 0 ? ' before item ' + at : ''}`);
            clearForm(invSr);
          }}>
            <Save size={14} /> Save
          </button>
          <button className="btn btn-warning" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => { modifyItem(); }}>
            <Edit2 size={14} /> Modify
          </button>
          <button className="btn btn-danger" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => {
            if (!selectedRowId) { toast.error('Open an item first (pencil icon in the list)'); return; }
            const it = items.find(i => i.id === selectedRowId);
            if (!window.confirm(`Delete item ${it ? it.itemSr : ''} (${it ? String(it.desc || '').slice(0, 40) : ''})?`)) return;
            putItems(renumber(items.filter(i => i.id !== selectedRowId)));
            clearForm(formData.invSr); toast.success('Item deleted');
          }}>
            <X size={14} /> Delete
          </button>
          <button className="btn btn-danger" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={async () => {
            // was: deleted every item at once without asking; now the items of the chosen invoice, or all
            if (!items.length) { toast.error('No items'); return; }
            const invSr = parseInt(formData.invSr, 10) || 1;
            const ofInv = items.filter(i => (parseInt(i.invSr, 10) || 1) === invSr).length;
            const invCount = (exportData?.invoices || []).length;
            // 20-Nov-2026: EagleView windows (a list to pick from) in place of the browser's prompt / confirm boxes
            const choice = invCount > 1
              ? await askText({ title: 'Delete multiple items', message: 'Which items are deleted?', label: 'Delete', choices: [{ value: 'I', label: `Items of invoice ${invSr} (${ofInv})` }, { value: 'ALL', label: `ALL ${items.length} items of the job` }], okLabel: 'Delete' })
              : ((await askConfirm({ title: 'Delete all items', message: `Delete all ${items.length} item(s)?`, okLabel: 'Delete all', cancelLabel: 'Keep them', tone: 'danger' })) ? 'ALL' : null);
            if (!choice) return;
            if (String(choice).toUpperCase() === 'ALL') { putItems([]); toast.success('All items deleted'); }
            else if (String(choice).toUpperCase() === 'I') { putItems(renumber(items.filter(i => (parseInt(i.invSr, 10) || 1) !== invSr))); toast.success(`${ofInv} item(s) of invoice ${invSr} deleted`); }
            clearForm(invSr);
          }}>
            <X size={14} /> Delete Multiple Item
          </button>
          <button className="btn btn-info" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => clearForm(formData.invSr)}>
            <RefreshCw size={14} /> Clear
          </button>
          <button className="btn btn-info" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => { putItems(renumber(items)); toast.success('Item serial numbers arranged (1, 2, 3 ... in each invoice)'); }}>
            <ArrowUpDown size={14} /> Arrange Item Serial No
          </button>
          <button className="btn btn-success" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => {
            const target = selectedRowId ? items.find(i => i.id === selectedRowId) : null;
            if (!target) { toast.error('Open the item to copy first (pencil icon in the list)'); return; }
            const invSr = parseInt(target.invSr, 10) || 1;
            const copy = { ...target, id: Date.now(), itemSr: nextItemSr(invSr), eSanchitList: asList(target.eSanchitList).map(d => ({ ...d, id: 'doc-' + Date.now() + Math.random() })) };
            putItems([...items, copy]);
            toast.success(`Item copied as item ${copy.itemSr} of invoice ${invSr}`);
          }}>
            <Copy size={14} /> Duplicate Item
          </button>
          <button className="btn btn-warning" style={{ padding: '0 10px', height: '28px', fontSize: '12px', fontWeight: 600, borderRadius: '4px' }} onClick={() => { const errs = validateIcegateRules(exportData, items, exportData?.invoices || []); if (errs.length > 0) setValidationErrors(errs); else setValidationSuccess(true); }}>
            <CheckCircle size={14} /> Validate Job
          </button>
        </div>
      </div>
    </>
  );
}
