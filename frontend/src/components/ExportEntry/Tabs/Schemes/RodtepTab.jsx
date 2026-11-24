import React from 'react';
import { useExportContext } from '../../ExportContext';
import { asList } from '../../../../utils/asList';
import { num, r2, isRodtepItem, isRosctlItem, claimsRodtep, invOf, itemNoOf, itemFobInr, rodtepAmount, claimText, CAP_NEEDS_QTY, rodtepRowOf, rodtepRateOf, rodtepQtyOf, isAppendix4RE, RDT_QTY_NEEDED } from './schemeUtils';

// Scheme > RoDTEP. Rebuilt 29-Oct-2026: before, this was one "Claim RoDTEP" tick box and a cap amount that nothing used.
// Now one row per item: RITC, FOB (INR), rate and cap from the RoDTEP master, estimated amount, and a Claim switch.
// ICEGATE takes the claim from the item's SW info row DTY / RDT (RODTEPY or RODTEPN) and the reward item flag,
// so the switch sets both on the item.
const th = { padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid #bae6fd' };
const cell = { padding: '4px 8px', borderBottom: '1px solid var(--border-color, #e2e8f0)' };

// 12-Nov-2026: in schemeUtils (a scheme 60 item's reward flag is its RoSCTL claim, not RoDTEP)
export { claimsRodtep };

export default function RodtepTab() {
  const { items, setItems, exportData, setExportData } = useExportContext();
  const jobInfo = asList(exportData && exportData._infoTypes);
  const [master, setMaster] = React.useState([]);
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/masters/rodteps').then((r) => r.json())
      .then((d) => setMaster(Array.isArray(d) ? d : (Array.isArray(d && d.data) ? d.data : [])))
      .catch(() => setMaster([]));
  }, []);

  // 12-Nov-2026: Appendix 4RE rate for AA / EOU / SEZ items, Appendix 4R otherwise
  const rateOf = (it) => rodtepRateOf(rodtepRowOf(master, it), it);
  // the DTY / RDT (and CHR / SQC) measurement of an item in the schedule unit: on the item's own SW info rows, or on
  // the rows kept with the job when the job was read from a file (those are what the Shipping Bill sends)
  const setRdtQty = (it, value) => {
    const m = rateOf(it); const su = (m && m.uqc) || String(it.unit || '').toUpperCase();
    const own = asList(it.swInfos);
    const inv = String(parseInt(it.invSr || 1, 10) || 1), itm = String(parseInt(it.itemSr, 10) || 0);
    const onJob = !own.length && jobInfo.some((x) => String(parseInt(x.invoiceSerialNumber, 10) || 1) === inv && String(parseInt(x.itemSerialNumber, 10) || 0) === itm);
    if (onJob) {
      setExportData((prev) => ({ ...prev, _infoTypes: asList(prev._infoTypes).map((x) => {
        if (String(parseInt(x.invoiceSerialNumber, 10) || 1) !== inv || String(parseInt(x.itemSerialNumber, 10) || 0) !== itm) return x;
        const q = `${String(x.infoType || '').toUpperCase()}/${String(x.infoQualifier || '').toUpperCase()}`;
        return q === 'DTY/RDT' || q === 'CHR/SQC' ? { ...x, infoMeasure: value, infouqc: su } : x;
      }) }));
      return;
    }
    setItems((prev) => prev.map((x) => {
      if (x.id !== it.id) return x;
      const list = [...asList(x.swInfos)];
      ['RDT', 'SQC'].forEach((qual) => {
        const type = qual === 'RDT' ? 'DTY' : 'CHR';
        const k = list.findIndex((r) => String(r.swInfoField1 || r.type || '').toUpperCase() === type && String(r.swInfoField2 || r.qual || '').toUpperCase() === qual);
        if (k >= 0) list[k] = { ...list[k], msr: value, uqc: su, swInfoField5: value, swInfoField6: su };
        else if (qual === 'RDT') list.push({ id: Date.now(), type, qual, code: claimsRodtep(x) ? 'RODTEPY' : 'RODTEPN', msr: value, uqc: su, swInfoField1: type, swInfoField2: qual, swInfoField3: claimsRodtep(x) ? 'RODTEPY' : 'RODTEPN', swInfoField4: '', swInfoField5: value, swInfoField6: su });
      });
      return { ...x, swInfos: list };
    }));
  };

  const setClaim = (id, on) => setItems((prev) => prev.map((it) => {
    if (it.id !== id) return it;
    const code = on ? 'RODTEPY' : 'RODTEPN';
    const list = [...asList(it.swInfos)]; // 12-Nov-2026: text of a reopened job is a list too (the other SW info rows were dropped)
    const k = list.findIndex((r) => String(r.swInfoField1 || r.type || '').toUpperCase() === 'DTY' && String(r.swInfoField2 || r.qual || '').toUpperCase() === 'RDT');
    if (k >= 0) list[k] = { ...list[k], code, swInfoField3: code };
    else {
      // 12-Nov-2026: the measurement is in the RoDTEP schedule unit (11 NOS of 83071000 is claimed as 139.7 KGS)
      const m = rateOf(it); const q = rodtepQtyOf(it, jobInfo, m && m.uqc);
      const msr = q.qty > 0 ? String(q.qty) : '', uqc = q.unit || it.unit || '';
      list.push({ id: Date.now(), type: 'DTY', qual: 'RDT', code, msr, uqc, swInfoField1: 'DTY', swInfoField2: 'RDT', swInfoField3: code, swInfoField4: '', swInfoField5: msr, swInfoField6: uqc });
    }
    return { ...it, rodtep: on ? 'Y' : 'N', reward: on ? 'Y' : 'N', rewardItem: on ? 'Y' : 'N', swInfos: list };
  }));

  const all = (items || []).map((it, i) => ({ it, i }));
  const rows = showAll ? all : all.filter(({ it }) => isRodtepItem(it));
  const calc = rows.map(({ it }) => {
    const m = rateOf(it); const on = claimsRodtep(it);
    const q = rodtepQtyOf(it, jobInfo, m && m.uqc);
    const amt = m ? rodtepAmount({ fob: itemFobInr(it), qty: q.qty, rate: m.rate, cap: m.cap, rsPerUqc: m.rsPerUqc }) : 0;
    return { m, on, amt, q };
  });
  // amt is null when the cap is per unit and the quantity is not keyed yet - such a row is counted, not guessed
  const total = calc.reduce((a, c) => a + (c.on && c.amt !== null ? c.amt : 0), 0);
  const pending = calc.filter((c) => c.on && c.m && c.amt === null).length;
  const claimed = calc.filter((c) => c.on).length;
  const noRate = calc.filter((c) => c.on && !c.m).length;
  const noQty = calc.filter((c) => c.on && c.m && c.q.from === 'NONE').length;
  const aa = rows.filter(({ it }) => isAppendix4RE(it)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '6px 12px', background: 'var(--primary-bg-light, #f0f9ff)', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #bae6fd', fontSize: 12 }}>
        <b style={{ color: '#0369a1' }}>RoDTEP</b>
        <span>Claimed: <b>{claimed}</b> of {rows.length}</span>
        <span>Estimated RoDTEP ₹ <b style={{ color: '#047857' }}>{r2(total)}</b></span>
        {noRate > 0 && <span style={{ color: '#b45309' }}>{noRate} claimed item(s) have no rate in the RoDTEP master</span>}
        {pending > 0 && <span style={{ color: '#b45309' }} title={CAP_NEEDS_QTY}>{pending} claimed item(s) not worked out - quantity needed (the cap is per unit)</span>}
        {noQty > 0 && <span style={{ color: '#b45309' }} title={RDT_QTY_NEEDED}>{noQty} item(s): key the RoDTEP qty in the schedule unit</span>}
        {aa > 0 && <span style={{ color: '#64748b' }} title="Exports under Advance Authorisation / EOU / SEZ (scheme 01-05, 16, 17, 34, 35, 39, 41, 44, 46, 63)">{aa} item(s) at Appendix 4RE rates</span>}
        <span style={{ flex: 1 }} />
        <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all items
        </label>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table className="compact-table" style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#dbeafe', color: 'var(--primary-text, #0369a1)', position: 'sticky', top: 0 }}>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Inv</th>
              <th style={{ ...th, width: 50, textAlign: 'center' }}>Item</th>
              <th style={{ ...th, width: 90 }}>RITC</th>
              <th style={{ ...th, textAlign: 'left' }}>Description</th>
              <th style={{ ...th, width: 90, textAlign: 'right' }}>Item Qty</th>
              <th style={{ ...th, width: 120, textAlign: 'right' }} title="DTY / RDT measurement, in the unit of the RoDTEP schedule">RoDTEP Qty</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>FOB ₹</th>
              <th style={{ ...th, width: 70, textAlign: 'right' }}>Rate %</th>
              <th style={{ ...th, width: 90, textAlign: 'right' }}>Cap ₹/unit</th>
              <th style={{ ...th, width: 110, textAlign: 'right' }}>Est. RoDTEP ₹</th>
              <th style={{ ...th, width: 90, textAlign: 'center' }}>Claim</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ it, i }, k) => {
              const { m, on, amt, q } = calc[k];
              const unitDiff = m && m.uqc && m.uqc !== String(it.unit || '').toUpperCase();
              return (
                <tr key={it.id ?? k} style={{ background: on ? '#fff' : '#f8fafc', color: on ? '#0f172a' : '#64748b' }}>
                  <td style={{ ...cell, textAlign: 'center', color: '#059669', fontWeight: 600 }}>{invOf(it, i)}</td>
                  <td style={{ ...cell, textAlign: 'center', color: '#0369a1', fontWeight: 600 }}>{itemNoOf(it, i)}</td>
                  <td style={cell}>{it.ritc || '-'}</td>
                  <td style={{ ...cell, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.desc || it.description || '-'}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{it.qty || it.quantity || 0} {it.unit || ''}</td>
                  <td style={{ ...cell, textAlign: 'right', background: on && q.from === 'NONE' ? '#fffbeb' : undefined }} title={unitDiff ? RDT_QTY_NEEDED : 'DTY / RDT measurement'}>
                    {unitDiff || q.from === 'RDT' ? (
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                        <input type="text" inputMode="decimal" className="grid-input" value={q.qty > 0 ? String(q.qty) : ''} placeholder={m ? m.uqc : ''} onChange={(e) => setRdtQty(it, e.target.value.replace(/[^\d.]/g, ''))} style={{ width: 70, height: 24, fontSize: 12, textAlign: 'right', borderColor: on && q.from === 'NONE' ? '#f59e0b' : undefined }} />
                        <span style={{ fontSize: 11 }}>{q.unit || (m && m.uqc) || ''}</span>
                      </span>
                    ) : <span>{q.qty || 0} {q.unit}</span>}
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>{r2(itemFobInr(it))}</td>
                  <td style={{ ...cell, textAlign: 'right' }} title={m ? 'Appendix ' + m.appendix : ''}>{m ? (m.rsPerUqc && !m.rate ? `Rs ${m.rsPerUqc}/${m.uqc}` : <>{num(m.rate)}{m.appendix === '4RE' && <sup style={{ color: '#64748b' }}> 4RE</sup>}</>) : <span style={{ color: '#b45309' }} title="RITC not in the RoDTEP master">n/a</span>}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{m ? (num(m.cap) || '-') : '-'}</td>
                  <td style={{ ...cell, textAlign: 'right', fontWeight: 600, color: amt === null ? '#b45309' : (on ? '#047857' : '#94a3b8'), background: amt === null && on ? '#fffbeb' : undefined }}
                    title={amt === null ? CAP_NEEDS_QTY : ''}>{!m ? '-' : (amt === null ? 'qty?' : r2(amt))}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>
                    {isRosctlItem(it) ? <span style={{ fontSize: 11, color: '#64748b' }} title="Scheme 60 item: claims RoSCTL (see Scheme > RoSCTL), not RoDTEP">RoSCTL</span> : <select className="grid-input" value={on ? 'Y' : 'N'} onChange={(e) => setClaim(it.id, e.target.value === 'Y')} style={{ height: 26, fontSize: 12, borderColor: on ? '#16a34a' : '#cbd5e1' }}>
                      <option value="Y">Yes</option><option value="N">No</option>
                    </select>}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={11} style={{ padding: 16, textAlign: 'center', color: '#64748b' }}>No RoDTEP item. Tick "Show all items" to claim for an item.</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '4px 12px', fontSize: 11, color: '#64748b', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        Estimate = Rate % × FOB ₹, limited to Cap × RoDTEP Qty (Appendix 4R; 4RE for AA / EOU / SEZ exports). ICEGATE gets SW info DTY / RDT (RODTEPY / RODTEPN) and the reward flag of each item; the amount is worked out by customs.
      </div>
    </div>
  );
}
