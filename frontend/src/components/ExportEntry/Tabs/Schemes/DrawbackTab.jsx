import React from 'react';
import RichAutocomplete from '../../../common/RichAutocomplete';
import { useExportContext } from '../../ExportContext';
import { num, r2, invOf, itemNoOf, itemFobInr, findDbk, dbkAmount, claimText, claimWhy } from './schemeUtils';
import { useMasterList } from '../../useExportCalc';

// Scheme > Dbk. Reworked 29-Oct-2026:
// - Sr No runs 1..n (it showed the invoice number); rows are matched to items by id, else invoice + item no;
// - rates / value come from the drawback schedule master on the screen (one server call per key press before, and the
//   rate typed in the list raced with that call); value = % of FOB (INR) limited by cap x qty, or specific rate x qty;
//   it is worked out again when DBK Qty, the rates or the item FOB change (a value typed by hand is kept);
// - Drawback Available (Y/N) per row as in the ICEGATE DBK table; totals and row checks;
// - the "Drawback Type" radios and the row tick boxes did nothing and were removed.
const th = { padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #bae6fd' };
const cell = { padding: '3px 4px', borderBottom: '1px solid var(--border-color, #e2e8f0)' };
const inp = { height: '26px', width: '100%', boxSizing: 'border-box', fontSize: '12px', padding: '0 6px' };

export default function DrawbackTab() {
  const { items, dbkItems, setDbkItems } = useExportContext();
  // 12-Nov-2026: the rows and their rates / amounts are kept up to date by useExportCalc (whole export screen), so
  // the header, the job list and the S/B checklist have the drawback amount without this tab being opened
  const master = useMasterList('/api/masters/drawbacks');

  const itemOf = (row) => (items || []).find((x, i) => (row.itemId != null && x.id === row.itemId) || (invOf(x, i) === String(row.invNo) && itemNoOf(x, i) === String(row.itemNo))) || null;

  // one state update per change (several updates raced before)
  const patchRow = (id, patch, opts = {}) => {
    setDbkItems((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      const nr = { ...row, ...patch };
      // 12-Nov-2026: a DBK qty typed here stays; untouched, it follows the item qty (useExportCalc)
      if ('dbkQty' in patch) { const it = itemOf(nr); nr.dbkQtyAuto = !!it && num(nr.dbkQty) === num(it.qty || it.quantity); }
      if (opts.manualValue) { nr.valManual = true; return nr; }
      if (opts.recalc !== false) {
        nr.valManual = false;
        const a3 = { fob: itemFobInr(itemOf(nr)), qty: nr.dbkQty, rateAdv: nr.dbkRtAdv, rateSpe: nr.dbkRtSpe, cap: nr.dbkCap };
        const haveRate = num(nr.dbkRtAdv) > 0 || num(nr.dbkRtSpe) > 0;
        nr.dbkVal = haveRate ? claimText(dbkAmount(a3)) : '';
        nr.dbkWhy = haveRate ? claimWhy(a3) : '';
      }
      return nr;
    }));
  };

  const applyMaster = (id, m) => patchRow(id, {
    dbkNo: String(m.schemeCode || m.tariffItem || ''), dbkRtAdv: String(num(m.drawbackRate)), dbkRtSpe: String(num(m.drawbackRateSpec)),
    dbkCap: String(num(m.drawbackCap)), ...(m.uqc ? { accUnit: m.uqc } : {}),
  });

  // typed DBK No: rates follow when it is a schedule number of the master, else the old rates are cleared
  const typeDbkNo = (id, v) => {
    const m = findDbk(master, v);
    if (m) applyMaster(id, m);
    else patchRow(id, { dbkNo: v, dbkRtAdv: '', dbkRtSpe: '', dbkCap: '' });
  };

  const copyFirstToBlank = () => {
    const first = (dbkItems || []).find((r) => r.dbkNo);
    if (!first) return;
    (dbkItems || []).filter((r) => !r.dbkNo).forEach((r) => {
      const m = findDbk(master, first.dbkNo);
      if (m) applyMaster(r.id, m); else patchRow(r.id, { dbkNo: first.dbkNo, dbkRtAdv: first.dbkRtAdv, dbkRtSpe: first.dbkRtSpe, dbkCap: first.dbkCap });
    });
  };

  const rows = dbkItems || [];
  const checks = rows.map((row) => {
    const it = itemOf(row); const msgs = [];
    if (!String(row.dbkNo || '').trim()) msgs.push({ t: 'DBK No missing', e: true });
    else if (master.length && !findDbk(master, row.dbkNo)) msgs.push({ t: 'DBK No not in the drawback schedule master', e: false });
    if (num(row.dbkQty) <= 0) msgs.push({ t: row.dbkWhy || 'DBK Qty must be more than 0', e: true });
    else if (it && num(it.qty || it.quantity) > 0 && num(row.dbkQty) > num(it.qty || it.quantity)) msgs.push({ t: 'DBK Qty is more than the item quantity', e: false });
    return msgs;
  });
  const errorRows = checks.filter((c) => c.some((m) => m.e)).length;
  const totalFob = rows.reduce((a, row) => a + itemFobInr(itemOf(row)), 0);
  const totalDbk = rows.reduce((a, row) => a + num(row.dbkVal), 0);
  // rows whose amount could not be worked out are counted, so the total is never read as the whole claim
  const pendingDbk = rows.filter((row) => String(row.dbkWhy || '').trim()).length;
  const suffixAC = rows.some((row) => /[AC]$/i.test(String(row.dbkNo || '').trim()));

  const chip = (label, value, color) => (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', padding: '3px 10px', borderRadius: 12, background: '#fff', border: '1px solid #bae6fd', fontSize: 12 }}>
      <span style={{ color: '#64748b' }}>{label}</span><b style={{ color: color || '#0f172a' }}>{value}</b>
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '6px 12px', background: 'var(--primary-bg-light, #f0f9ff)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #bae6fd' }}>
        <b style={{ fontSize: 12, color: '#0369a1', marginRight: 4 }}>Drawback (scheme 19 / 60)</b>
        {chip('Items', rows.length)}
        {chip('FOB ₹', r2(totalFob))}
        {chip('Total DBK ₹', r2(totalDbk), '#047857')}
        {pendingDbk > 0 && chip('Not worked out', pendingDbk + ' row(s)', '#b45309')}
        {chip('To fix', errorRows, errorRows ? '#dc2626' : '#047857')}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} disabled={!rows.some((r) => r.dbkNo) || !rows.some((r) => !r.dbkNo)} onClick={copyFirstToBlank} title="Put the first DBK No in every row that has none">Copy DBK No to blank rows</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="compact-table" style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#dbeafe', color: 'var(--primary-text, #0369a1)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ ...th, width: 44, textAlign: 'center' }}>Sr</th>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Inv</th>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Item</th>
              <th style={{ ...th, textAlign: 'left' }}>Description</th>
              <th style={{ ...th, width: 100, textAlign: 'right' }}>FOB ₹</th>
              <th style={{ ...th, width: 140 }}>DBK No *</th>
              <th style={{ ...th, width: 90 }}>DBK Qty *</th>
              <th style={{ ...th, width: 64 }}>Unit</th>
              <th style={{ ...th, width: 74 }}>Rate %</th>
              <th style={{ ...th, width: 80 }}>Rate ₹/unit</th>
              <th style={{ ...th, width: 80 }}>Cap ₹/unit</th>
              <th style={{ ...th, width: 104 }}>DBK Value ₹</th>
              <th style={{ ...th, width: 64 }}>Avail.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, k) => {
              const it = itemOf(row); const msgs = checks[k]; const bad = msgs.some((m) => m.e);
              return (
                <tr key={row.id ?? k} style={{ background: bad ? '#fef2f2' : '#fff' }} title={msgs.map((m) => m.t).join('\n')}>
                  <td style={{ ...cell, textAlign: 'center' }}>{row.srNo}</td>
                  <td style={{ ...cell, textAlign: 'center', color: '#059669', fontWeight: 600 }}>{row.invNo}</td>
                  <td style={{ ...cell, textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{row.itemNo}</td>
                  <td style={{ ...cell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155' }}>
                    {it ? (it.desc || it.description || it.itemDesc || '-') : '-'}
                    {msgs.length > 0 && <div style={{ fontSize: 10, color: bad ? '#dc2626' : '#b45309', whiteSpace: 'normal' }}>{msgs.map((m) => m.t).join(' · ')}</div>}
                  </td>
                  <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r2(itemFobInr(it))}</td>
                  <td style={cell}>
                    <RichAutocomplete
                      options={master}
                      value={row.dbkNo || ''}
                      onChange={(v) => typeDbkNo(row.id, v)}
                      onSelect={(m) => applyMaster(row.id, m)}
                      searchFilter={(d, q) => { const s = String(q || '').toLowerCase(); return String(d.schemeCode || d.tariffItem || '').toLowerCase().includes(s) || String(d.description || '').toLowerCase().includes(s); }}
                      renderOption={(d) => (
                        <>
                          <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 11 }}>{d.schemeCode || d.tariffItem} <span style={{ color: '#64748b', fontSize: 10, fontWeight: 400 }}>{d.description}</span></div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>Rate {num(d.drawbackRate)}% · Spe ₹{num(d.drawbackRateSpec)} · Cap ₹{num(d.drawbackCap)}{d.uqc ? ' / ' + d.uqc : ''}</div>
                        </>
                      )}
                      placeholder="DBK No"
                      inputStyle={{ ...inp, borderColor: row.dbkNo ? '#94a3b8' : '#dc2626', background: '#fefce8', fontWeight: 600 }}
                    />
                  </td>
                  <td style={cell}><input className="grid-input" inputMode="decimal" value={row.dbkQty ?? ''} onChange={(e) => patchRow(row.id, { dbkQty: e.target.value })} style={{ ...inp, textAlign: 'right', borderColor: num(row.dbkQty) > 0 ? '#94a3b8' : '#dc2626' }} /></td>
                  <td style={cell}><input className="grid-input" value={row.accUnit || ''} maxLength={3} onChange={(e) => patchRow(row.id, { accUnit: e.target.value.toUpperCase() }, { recalc: false })} style={{ ...inp, background: '#f0fdf4' }} /></td>
                  <td style={cell}><input className="grid-input" inputMode="decimal" value={row.dbkRtAdv ?? ''} onChange={(e) => patchRow(row.id, { dbkRtAdv: e.target.value })} style={{ ...inp, textAlign: 'right' }} /></td>
                  <td style={cell}><input className="grid-input" inputMode="decimal" value={row.dbkRtSpe ?? ''} onChange={(e) => patchRow(row.id, { dbkRtSpe: e.target.value })} style={{ ...inp, textAlign: 'right' }} /></td>
                  <td style={cell}><input className="grid-input" inputMode="decimal" value={row.dbkCap ?? ''} onChange={(e) => patchRow(row.id, { dbkCap: e.target.value })} style={{ ...inp, textAlign: 'right' }} /></td>
                  <td style={cell}><input className="grid-input" inputMode="decimal" value={row.dbkVal ?? ''} onChange={(e) => patchRow(row.id, { dbkVal: e.target.value }, { manualValue: true })} title={row.dbkWhy || (row.valManual ? 'Typed by hand (changes to qty / rates will work it out again)' : 'Worked out from the rates')} style={{ ...inp, textAlign: 'right', fontWeight: 600, color: row.dbkWhy ? '#b45309' : '#047857', background: row.dbkWhy ? '#fffbeb' : undefined, fontStyle: row.valManual ? 'italic' : 'normal' }} placeholder={row.dbkWhy ? 'qty?' : ''} /></td>
                  <td style={cell}>
                    <select className="grid-input" value={row.drawbackAvailable || 'Y'} onChange={(e) => patchRow(row.id, { drawbackAvailable: e.target.value }, { recalc: false })} style={inp}>
                      <option value="Y">Y</option><option value="N">N</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={13} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>No item has scheme code 19 (Drawback) or 60 (Drawback + RoSCTL).</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td colSpan={4} style={{ ...cell, textAlign: 'right' }}>Total</td>
                <td style={{ ...cell, textAlign: 'right' }}>{r2(totalFob)}</td>
                <td colSpan={6} style={cell} />
                <td style={{ ...cell, textAlign: 'right', color: '#047857', paddingRight: 10 }}>{r2(totalDbk)}</td>
                <td style={cell} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ padding: '4px 12px', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        DBK value = Rate % × FOB ₹, limited to Cap × Qty (or Rate ₹/unit × Qty). Only DBK No, Qty and Avail. go to ICEGATE; customs works out the amount.
        {suffixAC && <span style={{ color: '#b45309', marginLeft: 8 }}>DBK No with suffix A / C: add the drawback declaration (DB001 / DB002 / DB003) under Items &gt; SW Statement.</span>}
      </div>
    </div>
  );
}
