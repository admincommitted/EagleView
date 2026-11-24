import React from 'react';
import { useExportContext } from '../../ExportContext';
import { r2, rosctlRowsOf, CAP_NEEDS_QTY } from './schemeUtils';
import { useMasterList } from '../../useExportCalc';

// Scheme > RoSCTL - 12-Nov-2026. Scheme 60 is "Drawback + RoSCTL": the items claim drawback (Scheme > Dbk) and the
// Rebate of State and Central Taxes and Levies. Nothing showed the RoSCTL claim before. The schedule row is found by
// the item's drawback schedule number without its suffix (62030307B -> 62030307), else by RITC; the estimate is
// rate % x FOB (INR), limited to cap x qty. ICEGATE gets the reward flag and the RoSCTL declaration (statement RS001)
// of each item; the amount is worked out by Customs.
const th = { padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #bae6fd' };
const cell = { padding: '4px 8px', borderBottom: '1px solid var(--border-color, #e2e8f0)' };
const right = { ...cell, textAlign: 'right' };
const arr = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };

export default function RosctlTab() {
  const { items, dbkItems, exportData } = useExportContext();
  const master = useMasterList('/api/masters/rosctls');
  const rows = rosctlRowsOf(items, dbkItems, master);
  const total = rows.reduce((a, r) => a + (r.amt === null ? 0 : r.amt), 0);
  const pending = rows.filter((r) => r.amt === null).length;
  const loading = !master.length;
  const noRow = loading ? 0 : rows.filter((r) => r.noRow).length;
  // RS001 (RoSCTL declaration) on the item or for the whole SB
  const stmts = [...arr(exportData && exportData._statements), ...(items || []).flatMap((it) => arr(it.swStatements).map((s) => ({ ...s, invoiceSerialNumber: it.invSr, itemSerialNumber: it.itemSr })))];
  const hasRs001 = (r) => stmts.some((s) => String(s.statementCode || s.stmtCode || s.code || '').toUpperCase() === 'RS001' && (String(s.itemSerialNumber || s.itemSr || '0') === '0' || (String(s.invoiceSerialNumber || s.invSr || 1) === r.inv && String(s.itemSerialNumber || s.itemSr) === r.itm)));
  const noDecl = rows.filter((r) => !hasRs001(r)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '6px 12px', background: 'var(--primary-bg-light, #f0f9ff)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #bae6fd', fontSize: 12 }}>
        <b style={{ color: '#0369a1' }}>RoSCTL (scheme 60)</b>
        <span>Items: <b>{rows.length}</b></span>
        <span>Estimated RoSCTL ₹ <b style={{ color: '#047857' }}>{r2(total)}</b></span>
        {loading && <span style={{ color: '#64748b' }}>Reading the RoSCTL schedule...</span>}
        {noRow > 0 && <span style={{ color: '#b45309' }}>{noRow} item(s) not found in the RoSCTL schedule (check the DBK No / RITC)</span>}
        {pending > 0 && <span style={{ color: '#b45309' }} title={CAP_NEEDS_QTY}>{pending} item(s) not worked out - quantity needed (the cap is per unit)</span>}
        {noDecl > 0 && <span style={{ color: '#64748b' }} title="12-Nov-2026: the Shipping Bill gets RS001 for every scheme 60 reward item that has no declaration">{noDecl} item(s) without RS001 here - it is added to the Shipping Bill by itself</span>}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="compact-table" style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#dbeafe', color: 'var(--primary-text, #0369a1)', position: 'sticky', top: 0 }}>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Inv</th>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Item</th>
              <th style={{ ...th, width: 100 }}>DBK No</th>
              <th style={{ ...th, width: 100 }}>RoSCTL Sl No</th>
              <th style={{ ...th, textAlign: 'left' }}>Description</th>
              <th style={{ ...th, width: 90, textAlign: 'right' }}>Qty</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>FOB ₹</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>State % / cap</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>Central % / cap</th>
              <th style={{ ...th, width: 70, textAlign: 'right' }}>Rate %</th>
              <th style={{ ...th, width: 80, textAlign: 'right' }}>Cap ₹/unit</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>Est. RoSCTL ₹</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={r.it.id ?? k} style={{ background: r.noRow ? '#fffbeb' : '#fff' }}>
                <td style={{ ...cell, textAlign: 'center', color: '#059669', fontWeight: 600 }}>{r.inv}</td>
                <td style={{ ...cell, textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{r.itm}</td>
                <td style={cell}>{r.dbkNo || '-'}</td>
                <td style={cell}>{r.slNo || (loading ? '...' : <span style={{ color: '#b45309' }}>not found</span>)}</td>
                <td style={{ ...cell, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.m ? r.m.description : ''}>{r.it.desc || r.it.description || '-'}</td>
                <td style={right}>{r.qty || 0} {r.unit}</td>
                <td style={right}>{r2(r.fob)}</td>
                <td style={right}>{r.split ? `${r.split.stateRate}%${r.split.stateCap ? ' / ' + r.split.stateCap : ''}` : '-'}</td>
                <td style={right}>{r.split ? `${r.split.centralRate}%${r.split.centralCap ? ' / ' + r.split.centralCap : ''}` : '-'}</td>
                <td style={right}>{r.m ? r.rate : '-'}</td>
                <td style={right}>{r.m && r.cap ? r.cap : '-'}</td>
                <td style={{ ...right, fontWeight: 600, color: r.amt === null ? '#b45309' : '#047857' }} title={r.amt === null ? CAP_NEEDS_QTY : ''}>{r.noRow ? '-' : (r.amt === null ? 'qty?' : r2(r.amt))}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>No item has scheme code 60 (Drawback + RoSCTL).</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                <td colSpan={6} style={{ ...cell, textAlign: 'right' }}>Total</td>
                <td style={right}>{r2(rows.reduce((a, r) => a + r.fob, 0))}</td>
                <td colSpan={4} style={cell} />
                <td style={{ ...right, color: '#047857' }}>{r2(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ padding: '4px 12px', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        Estimate = Rate % × FOB ₹, limited to Cap × Qty (RoSCTL schedule). ICEGATE gets the reward flag and statement RS001 of each item; the amount is worked out by Customs.
      </div>
    </div>
  );
}
