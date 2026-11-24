import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useExportContext } from '../ExportContext';
import { SCHEME_CONFIG } from './Schemes/SchemeConfig';
import { licenceRowErrors } from './Schemes/LicenseTab';
import { ar4Missing } from './Schemes/Ar4Tab';
import { invOf, itemNoOf, toIsoDate, num, dbkAmount, itemFobInr, flagOn } from './Schemes/schemeUtils';
import { Save, RefreshCw, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

// Scheme tab (Dbk / RoDTEP / License / AR4 / MOOWR). Reworked 29-Oct-2026:
// - Save and Reset did nothing: Save saves the job (same as Save on the SB Header), Reset clears the details of the
//   open sub-tab after a confirmation; messages are toasts (browser alert boxes before);
// - Excel upload: rows are found by INV NO + ITEM NO only (a row with other numbers went to "the same position"
//   before, i.e. onto another item), the list is not changed in place, dates are read from date cells too,
//   and the toast says how many rows were used / not found; AR4 has a template as well;
// - the open sub-tab follows the items (it was not reset when only the open tab changed).
const pick = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== '') return row[k]; return undefined; };
const rowKey = (row) => ({ inv: String(pick(row, 'INV NO', 'Inv No', 'invNo', 'INV') ?? '').trim(), itm: String(pick(row, 'ITEM NO', 'Item No', 'itemNo', 'ITEM') ?? '').trim() });

export default function ExportSchemeTab() {
  const { items, setItems, exportData, dbkItems, setDbkItems, licenseItems, setLicenseItems } = useExportContext();
  const [activeSubTab, setActiveSubTab] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const validTabs = SCHEME_CONFIG.filter((config) => config.condition(items || [], exportData));
  const validKeys = validTabs.map((t) => t.key).join(',');

  useEffect(() => {
    if (!validTabs.length) { if (activeSubTab) setActiveSubTab(''); return; }
    if (!validTabs.find((t) => t.key === activeSubTab)) setActiveSubTab(validTabs[0].key);
  }, [validKeys, activeSubTab]);

  useEffect(() => { setConfirmReset(false); }, [activeSubTab]);

  const ar4Rows = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => String(it.ar4 || '').toUpperCase() === 'Y');

  const handleDownloadSample = () => {
    let rows = []; let fileName = '';
    if (activeSubTab === 'dbk') {
      rows = (dbkItems || []).map((r) => ({ 'INV NO': r.invNo, 'ITEM NO': r.itemNo, 'DBK No': r.dbkNo || '', 'DBK Qty': r.dbkQty || '', 'Acc Unit': r.accUnit || '', 'DBK Rt Adv': r.dbkRtAdv || '', 'DBK Rt Spe': r.dbkRtSpe || '', 'DBK Cap': r.dbkCap || '', 'DBK Val': r.dbkVal || '', 'DBK Available': r.drawbackAvailable || 'Y' }));
      fileName = 'DBK_Template.xlsx';
    } else if (activeSubTab === 'license') {
      rows = (licenseItems || []).map((r) => ({ 'INV NO': r.invNo, 'ITEM NO': r.itemNo, 'Reg No': r.regNo || '', 'Reg Dt': r.regDate || '', 'Sn E': r.snE || '', 'Sn C': r.snC || '', 'Qty': r.qty || '', 'Exp Qty': r.expQty || '', 'UQC': r.uqc || '', 'Ind/Imp': r.indImp || 'M', 'Lic No': r.licNo || '', 'Lic Dt': r.licDt || '', 'Lic Type': r.licType || '' }));
      fileName = 'License_Template.xlsx';
    } else if (activeSubTab === 'ar4') {
      rows = ar4Rows.map(({ it, i }) => ({ 'INV NO': invOf(it, i), 'ITEM NO': itemNoOf(it, i), 'AR4 No': it.ar4No || '', 'AR4 Date': it.ar4Date || '', 'Commissionerate': it.commissionerate || '', 'Division': it.division || '', 'Range': it.ar4Range || '', 'Remarks': it.ar4Remarks || '' }));
      fileName = 'AR4_Template.xlsx';
    } else {
      toast('No Excel template for this tab - fill it on the screen.', { icon: 'ℹ️' });
      return;
    }
    if (!rows.length) { toast.error('No rows in this tab to put in the template.'); return; }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, fileName);
  };

  const handleExcelUpload = (e) => {
    const input = e.target; const file = input.files && input.files[0];
    if (!file) return;
    if (!['dbk', 'license', 'ar4'].includes(activeSubTab)) { toast.error('Excel upload is for the Dbk, License and AR4 tabs.'); input.value = ''; return; }
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!data.length) { toast.error('The sheet has no rows.'); return; }
        let used = 0; const notFound = [];
        const s = (v) => (v === undefined ? undefined : String(v).trim());

        if (activeSubTab === 'dbk') {
          const next = (dbkItems || []).map((r) => ({ ...r }));
          data.forEach((row) => {
            const { inv, itm } = rowKey(row);
            const t = next.find((u) => String(u.invNo) === inv && String(u.itemNo) === itm);
            if (!t) { notFound.push(`${inv || '?'}/${itm || '?'}`); return; }
            const before = { ...t };
            const v = { dbkNo: s(pick(row, 'DBK No', 'DBK NO', 'dbkNo')), dbkQty: s(pick(row, 'DBK Qty', 'dbkQty', 'QTY')), accUnit: s(pick(row, 'Acc Unit', 'accUnit', 'UQC')),
              dbkRtAdv: s(pick(row, 'DBK Rt Adv', 'dbkRtAdv')), dbkRtSpe: s(pick(row, 'DBK Rt Spe', 'dbkRtSpe')), dbkCap: s(pick(row, 'DBK Cap', 'dbkCap')), dbkVal: s(pick(row, 'DBK Val', 'dbkVal')),
              drawbackAvailable: s(pick(row, 'DBK Available', 'drawbackAvailable')) };
            Object.keys(v).forEach((k) => { if (v[k] !== undefined) t[k] = k === 'drawbackAvailable' ? (/^N/i.test(v[k]) ? 'N' : 'Y') : v[k]; });
            if (v.dbkNo !== undefined && v.dbkRtAdv === undefined && v.dbkRtSpe === undefined) { t.dbkRtAdv = ''; t.dbkRtSpe = ''; t.dbkCap = ''; } // rates from the master
            // 12-Nov-2026: a DBK Val is "typed by hand" only when it differs from the value the rates give. The template
            // carries the worked-out values, so uploading it again froze every amount (a new rate changed nothing).
            const it = (items || []).find((x, i) => invOf(x, i) === String(t.invNo) && itemNoOf(x, i) === String(t.itemNo));
            if (v.dbkQty !== undefined && it) t.dbkQtyAuto = num(t.dbkQty) === num(it.qty || it.quantity); // a different qty from the file stays
            const haveRate = num(t.dbkRtAdv) > 0 || num(t.dbkRtSpe) > 0;
            const calc = haveRate && it ? dbkAmount({ fob: itemFobInr(it), qty: t.dbkQty, rateAdv: t.dbkRtAdv, rateSpe: t.dbkRtSpe, cap: t.dbkCap }) : null;
            const typedVal = v.dbkVal !== undefined && String(v.dbkVal).trim() !== '';
            const sameAsBefore = typedVal && String(before.dbkVal ?? '').trim() !== '' && Math.abs(num(v.dbkVal) - num(before.dbkVal)) < 0.01;
            const sameAsCalc = typedVal && calc !== null && Math.abs(num(v.dbkVal) - calc) < 0.01;
            t.valManual = typedVal && (sameAsBefore ? flagOn(before.valManual) : !sameAsCalc); // a value typed by hand before stays
            if (!t.valManual && haveRate && it) { t.dbkVal = calc === null ? '' : calc.toFixed(2); }
            used++;
          });
          setDbkItems(next);
        } else if (activeSubTab === 'license') {
          const next = (licenseItems || []).map((r) => ({ ...r }));
          data.forEach((row) => {
            const { inv, itm } = rowKey(row);
            const t = next.find((u) => String(u.invNo) === inv && String(u.itemNo) === itm && !u._xl) || next.find((u) => String(u.invNo) === inv && String(u.itemNo) === itm);
            if (!t) { notFound.push(`${inv || '?'}/${itm || '?'}`); return; }
            t._xl = true;
            const v = { regNo: s(pick(row, 'Reg No', 'regNo')), regDate: pick(row, 'Reg Dt', 'regDate', 'Reg Date'), snE: s(pick(row, 'Sn E', 'snE')), snC: s(pick(row, 'Sn C', 'snC')),
              qty: s(pick(row, 'Qty', 'qty')), expQty: s(pick(row, 'Exp Qty', 'expQty')), uqc: s(pick(row, 'UQC', 'uqc')), indImp: s(pick(row, 'Ind/Imp', 'indImp')),
              licNo: s(pick(row, 'Lic No', 'licNo', 'License No')), licDt: pick(row, 'Lic Dt', 'licDt', 'License Date'), licType: s(pick(row, 'Lic Type', 'licType')) };
            if (v.regDate !== undefined) v.regDate = toIsoDate(v.regDate);
            if (v.licDt !== undefined) v.licDt = toIsoDate(v.licDt);
            Object.keys(v).forEach((k) => { if (v[k] !== undefined) t[k] = v[k]; });
            used++;
          });
          setLicenseItems(next.map(({ _xl, ...r }) => r));
        } else if (activeSubTab === 'ar4') {
          const idx = new Map(ar4Rows.map(({ it, i }) => [invOf(it, i) + '/' + itemNoOf(it, i), it.id]));
          const patches = new Map();
          data.forEach((row) => {
            const { inv, itm } = rowKey(row); const id = idx.get(inv + '/' + itm);
            if (id === undefined) { notFound.push(`${inv || '?'}/${itm || '?'}`); return; }
            const v = { ar4No: s(pick(row, 'AR4 No', 'ar4No')), ar4Date: pick(row, 'AR4 Date', 'ar4Date'), commissionerate: s(pick(row, 'Commissionerate', 'commissionerate')),
              division: s(pick(row, 'Division', 'division')), ar4Range: s(pick(row, 'Range', 'ar4Range')), ar4Remarks: s(pick(row, 'Remarks', 'ar4Remarks')) };
            if (v.ar4Date !== undefined) v.ar4Date = toIsoDate(v.ar4Date);
            Object.keys(v).forEach((k) => v[k] === undefined && delete v[k]);
            patches.set(id, v); used++;
          });
          setItems((prev) => prev.map((it) => (patches.has(it.id) ? { ...it, ...patches.get(it.id) } : it)));
        }
        if (used) toast.success(`${used} row(s) filled from Excel` + (notFound.length ? `; ${notFound.length} not found (Inv/Item ${notFound.slice(0, 5).join(', ')}${notFound.length > 5 ? '…' : ''})` : ''), { duration: 5000 });
        else toast.error('No row matched: INV NO / ITEM NO must be the numbers shown in this tab.');
      } catch (err) {
        console.error(err);
        toast.error('Could not read the Excel file: ' + err.message);
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => { toast.error('Could not read the file.'); input.value = ''; };
    reader.readAsArrayBuffer(file);
  };

  // what is still missing (shown before saving; saving is not blocked)
  const pending = () => {
    const out = [];
    if (validKeys.includes('dbk')) { const n = (dbkItems || []).filter((r) => !String(r.dbkNo || '').trim() || num(r.dbkQty) <= 0).length; if (n) out.push(`Dbk: ${n} row(s) without DBK No / Qty`); }
    if (validKeys.includes('license')) { const n = (licenseItems || []).filter((r) => licenceRowErrors(r).length).length; if (n) out.push(`License: ${n} row(s) incomplete`); }
    if (validKeys.includes('ar4')) { const n = ar4Rows.filter(({ it }) => ar4Missing(it).length).length; if (n) out.push(`AR4: ${n} item(s) incomplete`); }
    return out;
  };

  const handleSave = () => {
    const p = pending();
    if (p.length) toast(p.join(' · '), { icon: '⚠️', duration: 6000 });
    window.dispatchEvent(new Event('export-save'));
  };

  const handleReset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false);
    if (activeSubTab === 'dbk') {
      setDbkItems((prev) => prev.map((r) => ({ ...r, dbkNo: '', dbkRtAdv: '', dbkRtSpe: '', dbkCap: '', dbkVal: '', valManual: false, drawbackAvailable: 'Y' })));
    } else if (activeSubTab === 'license') {
      setLicenseItems([]); // rebuilt as one empty row per licence item
    } else if (activeSubTab === 'ar4') {
      const ids = new Set(ar4Rows.map(({ it }) => it.id));
      setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, ar4No: '', ar4Date: '', commissionerate: '', division: '', ar4Range: '', ar4Remarks: '' } : it)));
    } else if (activeSubTab === 'rodtep') {
      toast('RoDTEP follows the items: set Claim per item.', { icon: 'ℹ️' }); return;
    } else if (activeSubTab === 'rosctl') {
      toast('RoSCTL follows the items (scheme 60) and their DBK No; nothing to clear.', { icon: 'ℹ️' }); return;
    } else if (activeSubTab === 'moowr') {
      toast('MOOWR details are kept; change them on the screen.', { icon: 'ℹ️' }); return;
    }
    toast.success('Details of this tab cleared (not saved yet).');
  };

  if (!validTabs.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#fff' }}>
        <div style={{ background: 'var(--bg-panel, #f8fafc)', border: '1px solid #cbd5e1', color: '#92400e', padding: '0.75rem 2rem', borderRadius: '4px', fontWeight: 600, fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          No scheme details in this job.
          <div style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginTop: 4 }}>Dbk shows for scheme code 19 / 60, RoSCTL for 60, License for licence schemes (e.g. 03), RoDTEP / AR4 when set on the item, MOOWR when MOOWR = Yes on the SB Header.</div>
        </div>
      </div>
    );
  }

  const ActiveComponent = validTabs.find((t) => t.key === activeSubTab)?.component;
  const canExcel = ['dbk', 'license', 'ar4'].includes(activeSubTab);
  const btn = { display: 'flex', alignItems: 'center', gap: '4px', padding: '0.4rem 1.25rem', fontWeight: 600, color: '#fff', cursor: 'pointer', margin: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '0.2rem', padding: '0.5rem 1rem 0 1rem', borderBottom: '1px solid #cbd5e1', background: 'var(--bg-panel, #e0f2fe)' }}>
        {validTabs.map((tab) => (
          <button key={tab.key} type="button"
            className={`btn ${activeSubTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.25rem 1rem', borderRadius: '2px 2px 0 0', background: activeSubTab === tab.key ? '#06b6d4' : 'var(--bg-input, #f1f5f9)', color: activeSubTab === tab.key ? '#fff' : 'var(--text-main, #0f172a)', borderColor: activeSubTab === tab.key ? '#0891b2' : 'var(--border-color, #cbd5e1)', borderWidth: '1px 1px 0 1px', borderStyle: 'solid', fontWeight: 500, fontSize: '12px', marginBottom: '-1px', zIndex: 10 }}
            onClick={() => setActiveSubTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 0, background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', border: '1px solid #cbd5e1', borderTop: 'none' }}>
        {ActiveComponent && <ActiveComponent />}
      </div>

      <div style={{ padding: '0.6rem 1rem', background: 'var(--bg-app, #f0f9ff)', border: '1px solid var(--border-color, #cbd5e1)', borderTop: '1px solid #bae6fd', borderRadius: '0 0 4px 4px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={handleDownloadSample} disabled={!canExcel} title={canExcel ? 'Excel with the rows of this tab' : 'No template for this tab'} className="btn btn-secondary" style={{ ...btn, background: '#0284c7', borderColor: '#0369a1', opacity: canExcel ? 1 : 0.5 }}>
          <Download size={14} /> Download Sample
        </button>
        <label className="btn btn-secondary" title={canExcel ? 'Fill this tab from Excel (INV NO + ITEM NO)' : 'No Excel upload for this tab'} style={{ ...btn, background: '#f59e0b', borderColor: '#d97706', opacity: canExcel ? 1 : 0.5, pointerEvents: canExcel ? 'auto' : 'none' }}>
          <Upload size={14} /> Upload Excel
          <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} disabled={!canExcel} />
        </label>
        <button type="button" onClick={handleSave} className="btn btn-primary" style={{ ...btn, background: '#22c55e', borderColor: '#16a34a' }} title="Save the job (Ctrl+S)">
          <Save size={14} /> Save
        </button>
        <button type="button" onClick={handleReset} onBlur={() => setConfirmReset(false)} className="btn btn-primary" style={{ ...btn, background: confirmReset ? '#dc2626' : '#3b82f6', borderColor: confirmReset ? '#b91c1c' : '#2563eb' }} title="Clear the details of this tab">
          <RefreshCw size={14} /> {confirmReset ? 'Click again to clear' : 'Reset'}
        </button>
      </div>
    </div>
  );
}
