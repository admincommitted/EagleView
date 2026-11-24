// Screen section: Supporting Document Configuration
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Edit2, FileSpreadsheet, FileText, PlusCircle, Save, Search, Trash2, Upload, X } from 'lucide-react';
import { asList, withItemLists } from '../../../../../utils/asList';
import React from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import BodyPortal from '../../../../common/BodyPortal';
import ESanchitDocsModal from './ESanchitDocsModal';
import { perUnit } from '../../../../../utils/cbicExchange';

// Items from an Excel/CSV sheet. Columns: InvSr, Scheme, RITC, Description, Qty, Unit, Rate (header names are flexible). 28-Oct-2026
// 12-Nov-2026: numbers with commas ("1,234.50") were read as 1; a RITC typed as a number lost its leading zero
// (03061790 -> 3061790); an "Invoice No" column was taken as the invoice serial; an invoice serial the job does not
// have was accepted; item numbers ran on across invoices (the first item of invoice 2 got no 3). Now: numbers
// without commas, RITC of 7 digits gets its 0 back, only InvSr / Invoice Sr is the serial, rows of an invoice the
// job does not have are left out (and listed), item numbers run per invoice after the items already there.
export const xlNum = (v) => { const t = String(v ?? '').replace(/,/g, '').trim(); if (t === '') return ''; const x = parseFloat(t); return isFinite(x) ? String(x) : ''; };
export const xlRitc = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 7 ? '0' + d : d; };
function readItemsSheet(file, existing, invCount, onRows) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const pick = (r, names) => { for (const k of Object.keys(r)) if (names.includes(k.replace(/[^a-z]/gi, '').toLowerCase())) return String(r[k]).trim(); return ''; };
      const next = {}; (existing || []).forEach(it => { const k = parseInt(it.invSr, 10) || 1; next[k] = Math.max(next[k] || 0, parseInt(it.itemSr, 10) || 0); });
      const out = [], skipped = [];
      rows.forEach((r, i) => {
        const ritc = xlRitc(pick(r, ['ritc', 'hscode', 'hsn', 'cth', 'ritccode']));
        const desc = pick(r, ['description', 'desc', 'itemdescription', 'goods']);
        if (!ritc && !desc) return;
        const invTxt = pick(r, ['invsr', 'invoicesr', 'invsrno', 'invoiceserial', 'invoicesrno']);
        const invSr = invTxt === '' ? 1 : parseInt(invTxt, 10);
        if (!(invSr >= 1) || invSr > Math.max(1, invCount || 0)) { skipped.push(`row ${i + 2} (InvSr ${invTxt || '?'})`); return; }
        const qty = xlNum(pick(r, ['qty', 'quantity'])); const rate = xlNum(pick(r, ['rate', 'price', 'unitprice']));
        const unit = (pick(r, ['unit', 'uqc', 'uom']) || 'NOS').toUpperCase().slice(0, 3);
        next[invSr] = (next[invSr] || 0) + 1;
        out.push({ id: Date.now() + i, invSr, itemSr: next[invSr],
          scheme: pick(r, ['scheme', 'schemecode']), ritc, desc: desc.toUpperCase(), qty, unit, per: '1', rate, rateUnit: unit,
          totalFc: (parseFloat(qty) || 0) && (parseFloat(rate) || 0) ? ((parseFloat(qty) * parseFloat(rate)).toFixed(2)) : '' });
      });
      onRows(out, skipped);
    } catch (err) { toast.error('Could not read the file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

export default function SupportingDocumentConfigurationSection({ ctx }) {
  const { currentDocForm, defaultIcegateId, docList, dragOverRowIndex, draggedRowIndex, esanchitMasters, exportData, formData, gridContainerRef, handleAddFilesToGrid, handleDragEnd, handleDragStart, handleFormChange, handleSignAndUpload, icegateProfiles, isESanchitModalOpen, isIcegateDifferent, isUploading, items, selectedIcegateProfile, selectedRowId, setActiveItemForRitc, setActiveItemForScheme, setCurrentDocForm, setDocList, setDragOverRowIndex, setFormData, setIsESanchitModalOpen, setIsIcegateDifferent, setIsRitcModalOpen, setIsSchemeModalOpen, setItems, setSelectedIcegateProfile, setSelectedRowId, setShowPinPrompt, setToastMsg, setTokenPin, showPinPrompt, showToast, toastMsg, tokenPin, updateItem } = ctx;
  const { setExportData, ccrItem, setCcrItem, tariffs, exportPoliciesMaster, drawbacksMaster, rodtepsMaster, nextItemSr } = ctx;
  // invoice of the item in the form (the list title and the totals always showed invoice 1)
  const curInvSr = parseInt(formData.invSr, 10) || 1;
  const curInv = (exportData?.invoices || [])[curInvSr - 1] || {};
  const invItems = items.filter(i => (parseInt(i.invSr, 10) || 1) === curInvSr);
  const invTotalFc = invItems.reduce((s, i) => s + (parseFloat(i.totalFc || i.total) || 0), 0);
  const invValue = parseFloat(curInv.value || curInv.invoiceValue) || 0;
  // rupees per ONE unit (the invoice holds the rate in CBIC notation - per 100 for JPY / KRW). 30-Oct-2026
  const exch = perUnit(curInv.currency, curInv.exchRate || curInv.exchangeRate, curInv.unitInRs);
  const diff = invValue ? +(invValue - invTotalFc).toFixed(2) : 0;
  const ccr = ccrItem ? {
    tariff: (tariffs || []).find(t => String(t.hsnCode) === ccrItem.ritc),
    policy: (exportPoliciesMaster || []).find(p => String(p.tariffItem) === ccrItem.ritc),
    dbk: (drawbacksMaster || []).filter(d => String(d.tariffItem || '').replace(/\D/g, '').startsWith(ccrItem.ritc.slice(0, 4))).slice(0, 5),
    rodtep: (rodtepsMaster || []).find(r => String(r.tariffItem) === ccrItem.ritc),
  } : null;

  // open an item in the form (pencil or a click on its row); lists of a reopened job come as text (12-Nov-2026)
  const openItem = async (item0) => {
    // 17-Nov-2026: the item in the form has changes not put in with Modify - asked first (they were dropped silently);
    // a click on the same item keeps the changes
    if (item0.id === selectedRowId && ctx.formEdited()) return;
    if (!(await ctx.leaveFormOk('item ' + (item0.itemSr || '') + ' of invoice ' + (item0.invSr || 1) + ' opens'))) return; // async since 20-Nov-2026 (EagleView question window)
    ctx.clearFormEdits();
    const item = withItemLists(item0);
    // 12-Nov-2026: an item read from a file has its state / district of origin in the SB's SW info rows (ORC / STO and
    // ORC / DOO); the form wants them on the item, so it could not be saved or modified ("Fill: Source State ...")
    const inv = String(item.invSr || 1), itm = String(item.itemSr || '');
    const rows = asList(exportData && exportData._infoTypes);
    const orc = (q) => { const mine = rows.find(r => String(r.infoType || '').toUpperCase() === 'ORC' && String(r.infoQualifier || '').toUpperCase() === q && String(r.invoiceSerialNumber || 1) === inv && String(r.itemSerialNumber || '') === itm);
      const all = rows.find(r => String(r.infoType || '').toUpperCase() === 'ORC' && String(r.infoQualifier || '').toUpperCase() === q && String(r.itemSerialNumber || '0') === '0');
      return String((mine || all || {}).infoCode || '').trim(); };
    const stateCode = item.stateCode || orc('STO') || String(exportData?.stateOriginCode || '').trim();
    const districtCode = item.districtCode || orc('DOO');
    const st = stateCode && (ctx.states || []).find(x => String(parseInt(x.taxCode, 10)) === String(parseInt(stateCode, 10)));
    setSelectedRowId(item.id);
    // the form uses rate / unit, the list price / uqc (rows from a file or Excel have one of them)
    setFormData({ ...item, rate: item.rate ?? item.price ?? '', unit: item.unit || item.uqc || '', rateUnit: item.rateUnit || item.unit || item.uqc || '', per: item.per || '1',
      pmvOption: item.pmvOption || (item.pmvType === 'M' ? 'Manual' : 'Percentage'), pmv: item.unitPmv ?? item.pmv ?? '', invSr: parseInt(item.invSr, 10) || 1, eSanchitList: asList(item.eSanchitList),
      stateCode: stateCode ? String(stateCode).padStart(2, '0') : '', districtCode: districtCode || '', sourceState: item.sourceState || (st ? st.stateName : '') });
  };
  return (
    <>
    {ccr && (<BodyPortal>
      <div onClick={() => setCcrItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '10px', width: '560px', maxWidth: '94vw', padding: '16px', fontSize: '12px', boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><strong style={{ fontSize: '14px' }}>Compliance requirements - RITC {ccrItem.ritc}</strong><button type="button" onClick={() => setCcrItem(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={16} /></button></div>
          {[
            ['Description', (ccr.tariff && ccr.tariff.description) || ccrItem.desc || '-'],
            ['Standard UQC', (ccr.tariff && ccr.tariff.uqc) || (ccr.policy && ccr.policy.uqc) || '-'],
            ['Export policy (DGFT)', ccr.policy ? `${ccr.policy.dgftPolicy || 'FREE'}${ccr.policy.description ? ' - ' + ccr.policy.description : ''}` : 'Not in the Export Policy master - check the ITC(HS) export schedule'],
            ['Export duty', ccr.policy && parseFloat(ccr.policy.exportDuty) ? ccr.policy.exportDuty + ' %' : 'Nil'],
            ['RoDTEP', ccr.rodtep ? `${ccr.rodtep.rate || 0}%${ccr.rodtep.cap ? ' (cap ' + ccr.rodtep.cap + ' per unit)' : ''}` : 'Not in the RoDTEP master'],
            ['Drawback entries', ccr.dbk.length ? ccr.dbk.map(d => `${d.tariffItem} ${d.drawbackRate || 0}%`).join(', ') : 'None in the master for ' + ccrItem.ritc.slice(0, 4)],
          ].map(([k, v]) => <div key={k} style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ width: '150px', color: '#64748b', fontWeight: 600 }}>{k}</span><span style={{ flex: 1, color: k === 'Export policy (DGFT)' && ccr.policy && !/FREE/i.test(ccr.policy.dgftPolicy || '') ? '#b91c1c' : '#0f172a', fontWeight: 600 }}>{v}</span></div>)}
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>From the masters of this system (Tariff, Export Policy, RoDTEP, Drawback). Restricted / prohibited goods need a licence or permission document (add it in e-Sanchit).</div>
        </div>
      </div>
    </BodyPortal>)}

    {/* e-Sanchit documents of the item in the form (new window, 29-Oct-2026: issuing party, beneficiary, place / dates,
        document level, copy from another job / to all items) */}
    <ESanchitDocsModal
      open={isESanchitModalOpen}
      onClose={() => setIsESanchitModalOpen(false)}
      itemRows={asList(formData.eSanchitList)}
      exportData={exportData} setExportData={setExportData} items={items} setItems={setItems}
      itemLabel={`Item ${formData.itemSr || '-'} of invoice ${formData.invSr || 1}${formData.desc ? ' (' + String(formData.desc).slice(0, 30) + ')' : ''}`}
      esanchitMasters={esanchitMasters} icegateProfiles={icegateProfiles} defaultIcegateId={defaultIcegateId}
      selectedIcegateProfile={selectedIcegateProfile} setSelectedIcegateProfile={setSelectedIcegateProfile}
      onSave={(rows) => {
        const flag = rows.length || asList(exportData?.eSanchitList).length ? 'Y' : 'N';
        const isOpen = selectedRowId && items.some(i => i.id === selectedRowId);
        setFormData(prev => { const patch = { eSanchitList: rows, suppDocs: rows.length ? 'Y' : prev.suppDocs === 'Y' && !rows.length ? 'N' : prev.suppDocs }; if (isOpen) ctx.keepInBase(patch); return { ...prev, ...patch }; });
        // the item open in the form is updated in the list too (before, the documents were lost unless Modify was clicked)
        if (isOpen) setItems(items.map(i => i.id === selectedRowId ? { ...i, eSanchitList: rows, suppDocs: rows.length ? 'Y' : 'N' } : i));
        setIsESanchitModalOpen(false);
        toast.success(`${rows.length} item document(s) kept${flag === 'Y' && !rows.length ? ' (SB-level documents are on the job)' : ''}${selectedRowId ? '' : ' - click Save to add the item'}`);
      }}
    />

      {/* 1. ITEM GRID (data-nodirty: a click here is not a change of the item form) */}
      <div className="glass-panel" data-nodirty="1" style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h3 className="section-header" style={{ margin: 0 }}>Item Details (Invoice {curInvSr}: {curInv.no || curInv.invoiceNo || 'N/A'}) <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>{invItems.length} of {items.length} item(s)</span></h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="file" id="exportItemsExcel" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={(e) => {
              const f = e.target.files && e.target.files[0]; e.target.value = null; if (!f) return;
              const nInv = (exportData?.invoices || []).length;
              readItemsSheet(f, items, nInv, (rows, skipped) => {
                if (skipped.length) toast.error(`${skipped.length} row(s) left out - the job has ${nInv || 'no'} invoice(s): ${skipped.slice(0, 4).join(', ')}${skipped.length > 4 ? '…' : ''}`, { duration: 8000 });
                if (!rows.length) { if (!skipped.length) toast.error('No items found. Columns needed: RITC, Description, Qty, Unit, Rate (optional InvSr, Scheme)'); return; }
                setItems(prev => [...prev, ...rows]);
                toast.success(rows.length + ' item(s) added from the file');
              });
            }} />
            {/* was: added a fixed dummy item (RITC 87089900); now reads a real Excel/CSV file */}
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }} onClick={() => document.getElementById('exportItemsExcel').click()}>
              <FileSpreadsheet size={12} /> Import Excel
            </button>
            {/* was: added a fixed dummy item; now opens the AI PDF reader of the toolbar */}
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }} onClick={() => window.dispatchEvent(new Event('export-open-ai-pdf'))}>
              <FileText size={12} /> Import PDF
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={async () => {
              if (!(await ctx.leaveFormOk('a blank form opens for a new item'))) return;
              ctx.clearFormEdits();
              setSelectedRowId(null); // a new item: Modify must not overwrite the item opened before
              setFormData({
                invSr: formData.invSr || 1, itemSr: nextItemSr(formData.invSr || 1), eSanchitList: [], scheme: '', ritc: '', desc: '', chkDesc: '', qty: '', unit: 'NOS', per: '1', rate: '', rateUnit: 'NOS', totalFc: '',
                pmvOption: 'Percentage', pmvPer: '110', pmv: '', totalPmv: '', itemFob: '',
                endUse: '', igstPayStatus: 'Select', taxableValue: '0', igstRate: '0', igstAmt: '0',
                rodtep: 'N', swInfo: 'N', swStatement: 'N', suppDocs: 'N', reExport: 'N', manfDetails: 'N',
                sourceState: '', stateCode: '', hawb: '', totalPkgs: '', swConst: 'N', swProd: 'N', swCtrl: 'N',
                accessory: 'N', cess: 'N', thirdParty: 'N', ar4: 'N', reward: 'N',
                addInTemplate: false, addInMiddle: '', copyLicence: ''
              });
              // Optionally scroll to form
              window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }}>
              <PlusCircle size={12} /> Add Item
            </button>
          </div>
        </div>
        
        <div ref={gridContainerRef} style={{ height: '170px', overflowY: 'auto', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.03)' }}>
          <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-input)', borderBottom: '2px solid #bae6fd' }}>
            <tr style={{ color: '#c2410c', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>
              <th style={{ width: '60px', padding: '8px 4px' }}>Actions</th>
              <th style={{ padding: '8px 4px' }}>Inv Sr</th>
              <th style={{ padding: '8px 4px' }}>Item Sr</th>
              <th style={{ padding: '8px 4px' }}>Scheme Code</th>
              <th style={{ padding: '8px 4px' }}>RITC Code</th>
              <th style={{ padding: '8px 4px' }}>Description</th>
              <th style={{ padding: '8px 4px' }}>Qty</th>
              <th style={{ padding: '8px 4px' }}>UQC</th>
              <th style={{ padding: '8px 4px' }}>Unit Price</th>
              <th style={{ padding: '8px 4px' }}>Total Value</th>
              <th style={{ padding: '8px 4px' }}>PMV</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isSelected = selectedRowId === item.id;
              const isComplete = item.qty && item.price && item.desc;
              const rowBg = 'transparent'; // Removed colors as per user request
              
              return (
                <tr 
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnter={() => setDragOverRowIndex(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ 
                    background: rowBg,
                    borderBottom: dragOverRowIndex === index && draggedRowIndex !== index ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    cursor: 'grab'
                  }} 
                  className={isSelected ? '' : 'hover-row'}
                  onClick={(e) => {
                    // 12-Nov-2026: a click on the row opens the item in the form (it only marked the row, so Modify
                    // wrote the item open before onto this one)
                    if(!e.target.closest('button') && !e.target.closest('select') && !e.target.closest('input') && !e.target.closest('svg')) openItem(item);
                  }}
                >
                  <td style={{ display: 'flex', gap: '8px' }}>
                    <Edit2 size={14} style={{ cursor: 'pointer', color: 'var(--text-main, var(--text-main, #0f172a))' }} onClick={() => openItem(item)} title="Edit Item Details in Form" />
                    <Trash2 size={14} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => {
                      if (!window.confirm(`Delete item ${item.itemSr || index + 1} (${String(item.desc || '').slice(0, 40)})?`)) return;
                      const c = {}; const next = items.filter(i => i.id !== item.id).map(i => { const k = parseInt(i.invSr, 10) || 1; c[k] = (c[k] || 0) + 1; return { ...i, itemSr: c[k] }; });
                      setItems(next); if (ctx.remapItemRows) ctx.remapItemRows(items, next); // SW info / statement rows follow the items
                      if (selectedRowId === item.id) setSelectedRowId(null);
                    }} title="Delete Item" />
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.invSr || 1}</td>
                  <td style={{ textAlign: 'center' }}>{item.itemSr || index + 1}</td>
                  <td>
                    <div style={{ position: 'relative', width: '100px' }}>
                      <input className="grid-input" value={item.scheme} onChange={(e) => updateItem(item.id, 'scheme', e.target.value)} style={{ width: '100%', paddingRight: '20px' }} />
                      <Search 
                        size={12} 
                        style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }} 
                        onClick={() => {
                          setActiveItemForScheme(item.id);
                          setIsSchemeModalOpen(true);
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <div style={{ position: 'relative', width: '120px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input className="grid-input" value={item.ritc} onChange={(e) => updateItem(item.id, 'ritc', e.target.value)} style={{ width: '100%', paddingRight: '20px', background: 'transparent' }} />
                        <Search 
                          size={12} 
                          style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }} 
                          onClick={() => {
                            setActiveItemForRitc(item.id);
                            setIsRitcModalOpen(true);
                          }}
                        />
                      </div>
                      <button className="btn btn-secondary" onClick={() => { const r = String(item.ritc || '').replace(/\D/g, ''); if (r.length < 4) { toast.error('Enter the RITC first'); return; } setCcrItem({ ritc: r, desc: item.desc }); }} style={{ padding: '2px 4px', fontSize: '9px', background: 'var(--primary-text, #0284c7)', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }} title="Compulsory Compliance Requirements">
                        CCRs
                      </button>
                    </div>
                  </td>
                  <td><input type="text" className="grid-input" value={item.desc} onChange={(e) => updateItem(item.id, 'desc', e.target.value)} style={{ width: '200px' }} maxLength={120} title="Max 120 characters (Maps to DescOfGoods 1, 2, 3 in Schema)"  /></td>
                  <td><input type="text" inputMode="decimal" className="grid-input" value={item.qty ?? ''} onChange={(e) => updateItem(item.id, 'qty', e.target.value.replace(/[^0-9.]/g, ''))} style={{ width: '60px' }} /></td>
                  <td><input type="text" className="grid-input" value={item.uqc || item.unit || ''} onChange={(e) => updateItem(item.id, 'uqc', e.target.value.toUpperCase())} style={{ width: '50px' }}  /></td>
                  <td><input type="text" inputMode="decimal" className="grid-input" value={item.price ?? item.rate ?? ''} onChange={(e) => updateItem(item.id, 'price', e.target.value.replace(/[^0-9.]/g, ''))} style={{ width: '80px' }} /></td>
                  <td><input type="text" className="grid-input" value={item.totalFc || item.total || ''} readOnly style={{ width: '90px', background: 'var(--bg-input, #f1f5f9)' }} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <select className="grid-input" value={item.pmvType} onChange={(e) => updateItem(item.id, 'pmvType', e.target.value)} style={{ width: '45px', padding: '0 2px', border: 'none', background: 'transparent' }}><option>%</option><option>M</option></select>
                      <input type="number" min="0" step="any" className="grid-input" value={item.pmv} onChange={(e) => updateItem(item.id, 'pmv', Math.max(0, e.target.value))} style={{ width: '60px', background: 'transparent' }} />
                    </div>

                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        
        {/* Invoice Summary Bar - the invoice of the item in the form (was always invoice 1; "Invoice Val(INR)" showed the FOB) */}
        {/* compact read-only figures (29-Oct-2026: were read-only text boxes) */}
        <div style={{ marginTop: '6px', padding: '4px 8px', background: 'var(--primary-bg-light, #f0f9ff)', border: '1px solid var(--border-color, #cbd5e1)', borderRadius: '4px', display: 'flex', gap: '6px 18px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
          {[
            ['Invoice No', curInv.no || curInv.invoiceNo || ''],
            ['Invoice Date', curInv.date || curInv.invoiceDate || ''],
            ['Invoice Value', invValue ? `${curInv.currency || ''} ${invValue.toFixed(2)}` : ''],
            ['Invoice Value (INR)', invValue && exch ? (invValue * exch).toFixed(2) : ''],
            ['Invoice FOB (INR)', curInv.invFobInr || ''],
            ['Items Total', `${curInv.currency || ''} ${invTotalFc.toFixed(2)}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minHeight: '22px' }}>
              <span style={{ color: '#64748b', fontWeight: 600, fontSize: '11px' }}>{k}</span>
              <b style={{ color: 'var(--text-main, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>{v || '-'}</b>
            </div>
          ))}
          {invValue > 0 && Math.abs(diff) > 0.01 && <span style={{ color: '#b91c1c', fontWeight: 700 }} title="Items total must equal the invoice value">⚠ Difference {diff > 0 ? '+' : ''}{diff.toFixed(2)}</span>}
          {invValue > 0 && Math.abs(diff) <= 0.01 && <span style={{ color: '#15803d', fontWeight: 700 }}>✓ Items match the invoice value</span>}
        </div>
      </div>

      {/* --- ITEM ENTRY FORM --- */}
    </>
  );
}
