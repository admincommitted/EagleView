// Screen section: Antidumping Custom Duty
// Split out of ItemGridTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckSquare, X } from 'lucide-react';
import React from 'react';
import BodyPortal from '../../../../common/BodyPortal';
import EsanchitDocsPanel from '../../../EsanchitDocsPanel';

// 04-Nov-2026: "From ADD master" - the anti-dumping rows (iCAFFE Antidumping Master) that cover the item's CTH, the
// country of origin first. "Use" fills notification, serial, CTH serial, flag, rate / specific amount, UQC, currency.
function AddMasterLookup({ ritc, origin, tempAddData, setTempAddData }) {
  const [rows, setRows] = React.useState(null);
  const [showAll, setShowAll] = React.useState(false);
  const cth = String(ritc || '').replace(/\D/g, '');
  React.useEffect(() => {
    if (cth.length < 4) { setRows([]); return; }
    let live = true;
    fetch(`/api/tariff/add/${cth}?origin=${encodeURIComponent(origin || '')}`).then(r => r.json())
      .then(d => { if (live) setRows(d && Array.isArray(d.data) ? d.data : []); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [cth, origin]);
  if (cth.length < 4) return <div style={{ fontSize: '12px', color: '#64748b' }}>Item has no CTH - enter the RITC to look up anti-dumping duty.</div>;
  if (rows === null) return <div style={{ fontSize: '12px', color: '#64748b' }}>Looking up anti-dumping duty for {cth}...</div>;
  if (!rows.length) return <div style={{ fontSize: '12px', color: '#16a34a' }}>No anti-dumping notification in the master for CTH {cth}.</div>;
  const sorted = [...rows].sort((a, b) => (b.matchOrigin - a.matchOrigin) || (a.maybeExpired - b.maybeExpired));
  const list = showAll ? sorted : sorted.filter(r => r.matchOrigin || !origin).slice(0, 50);
  const use = (r) => {
    const specific = String(r.flag || '').toUpperCase() === 'S';
    setTempAddData({ ...tempAddData, notnNo: r.notifNo, srNo: r.serialNo, cth: r.cthSlNo, flag: String(r.flag || '').toUpperCase(),
      rate: specific ? '' : (r.rate ?? ''), amount: specific ? (r.amount ?? '') : '', uqc: r.uqc || tempAddData.uqc || '', currency: r.currency || tempAddData.currency || '',
      ...(specific ? { type: 'Based On Quantity' } : {}) });
  };
  const td = { padding: '3px 6px', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' };
  return (
    <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: '4px', padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
        <strong style={{ color: '#92400e' }}>From ADD master - CTH {cth}{origin ? `, origin ${origin}` : ''}: {rows.filter(r => r.matchOrigin).length} for this country / {rows.length} in all</strong>
        {origin && <label style={{ display: 'flex', gap: '4px', alignItems: 'center', color: '#334155' }}><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> all countries</label>}
      </div>
      {list.length ? (
        <div style={{ maxHeight: '170px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead><tr style={{ background: '#fef3c7', textAlign: 'left' }}>
              {['Notn', 'Date', 'Sl', 'CTH Sl', 'CTH', 'Origin', 'Export', 'Flag', 'Rate / Amt', ''].map(h => <th key={h} style={td}>{h}</th>)}
            </tr></thead>
            <tbody>{list.map((r, i) => (
              <tr key={i} style={{ color: r.maybeExpired ? '#94a3b8' : '#0f172a' }} title={r.maybeExpired ? 'More than 5 years old - check that it is still in force' : ''}>
                <td style={td}>{r.notifNo}</td><td style={td}>{r.notifDate || ''}</td><td style={td}>{r.serialNo}</td><td style={td}>{r.cthSlNo}</td><td style={td}>{r.cth}</td>
                <td style={td}>{r.originCountry || 'ANY'}</td><td style={td}>{r.exportCountry || 'ANY'}</td><td style={td}>{r.flag}</td>
                <td style={td}>{String(r.flag || '').toUpperCase() === 'S' ? `${r.amount} ${r.currency || ''}/${r.uqc || ''}` : `${r.rate}%`}</td>
                <td style={td}><button type="button" onClick={() => use(r)} style={{ fontSize: '11px', padding: '1px 8px', border: '1px solid #d97706', background: '#fff', color: '#92400e', borderRadius: '3px', cursor: 'pointer' }}>Use</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      ) : <div style={{ fontSize: '12px', color: '#64748b' }}>None for {origin}. Tick "all countries" to see the other rows.</div>}
      <div style={{ fontSize: '10px', color: '#78350f', marginTop: '4px' }}>The duty usually depends on the producer / exporter too - check the supplier serial in the notification before filing. Grey rows are more than 5 years old.</div>
    </div>
  );
}

export default function AntidumpingCustomDutySection({ ctx }) {
  const { saveAntiDumpingModal, saveSupportingDocsModal, setShowAntiDumpingModal, setShowSupportingDocsModal, setTempAddData, showAntiDumpingModal, showSupportingDocsModal, tempAddData, tempDocsData, setTempDocsData, docsOtherIrns, selectedItem, jobData } = ctx;
  return (
    <>
    {showAntiDumpingModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '4px', width: '820px', maxWidth: '96vw', maxHeight: '94vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#334155', fontWeight: 'normal' }}>Antidumping Custom Duty</h3>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowAntiDumpingModal(false)} />
            </div>
            
            <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <AddMasterLookup ritc={selectedItem && selectedItem.ritc} origin={String((jobData && (jobData.countryOfOrigin || jobData.autoField_20)) || '').toUpperCase()} tempAddData={tempAddData} setTempAddData={setTempAddData} />
              <div style={{ border: '1px solid #93c5fd', padding: '15px', borderRadius: '4px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 120px 1.2fr', gap: '15px 10px', alignItems: 'center' }}>
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Antidumping Type</label>
                  <select name="type" className="input-field" value={tempAddData.type || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '2px solid #0d9488', color: '#0000ff' }}>
                    <option>Based On Landed Cost</option>
                    <option>Based On Assessable</option>
                    <option>Based On CIF Value</option>
                    <option>Based On Quantity</option>
                  </select>
                  <div style={{ gridColumn: '3 / span 2' }}></div>
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Notification No</label>
                  <input type="text" name="notnNo" className="input-field" value={tempAddData.notnNo || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', background: '#fef9c3', border: '1px solid #0d9488' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>CTH Serial No</label>
                  <input type="text" name="cth" className="input-field" value={tempAddData.cth || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', background: '#fef9c3', border: '1px solid #0d9488' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Serial No</label>
                  <input type="text" name="srNo" className="input-field" value={tempAddData.srNo || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>Supplier Sl No</label>
                  <input type="text" name="supSlNo" className="input-field" value={tempAddData.supSlNo || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #ef4444' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Advalorem Rate</label>
                  <input type="text" name="rate" className="input-field" value={tempAddData.rate || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>Flag</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="text" name="flag" className="input-field" value={tempAddData.flag || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488' }} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={tempAddData.difference !== false} onChange={(e) => setTempAddData({ ...tempAddData, difference: e.target.checked })} style={{ accentColor: 'var(--primary-color-end)' }} /> Difference
                    </label>
                  </div>
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Quantity</label>
                  <input type="text" name="qty" className="input-field" value={tempAddData.qty || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488', color: '#0000ff' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>UQC</label>
                  <input list="uqc-list" type="text" name="uqc" className="input-field" value={tempAddData.uqc || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488', color: '#0000ff' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px' }}>Spec. Amt</label>
                  <input type="text" name="amount" className="input-field" value={tempAddData.amount || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '100%', border: '1px solid #0d9488' }} />
                  
                  <label style={{ color: '#0f172a', fontSize: '14px', paddingLeft: '15px' }}>Currency</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input list="currency-list" type="text" name="currency" className="input-field" value={tempAddData.currency || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '60px', background: '#f0fdf4', border: '1px solid #ef4444' }} />
                    <input type="text" name="currencyRate" className="input-field" value={tempAddData.currencyRate || ''} onChange={(e) => setTempAddData({...tempAddData, [e.target.name]: e.target.value})} style={{ width: '60px', border: '1px solid #ef4444' }} />
                  </div>
                </div>

              </div>
            </div>
            
            <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderRadius: '0 0 4px 4px' }}>
              <button type="button" className="btn btn-success" onClick={saveAntiDumpingModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#5cb85c', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '14px', cursor: 'pointer' }}>
                OK
              </button>
              <button className="btn btn-danger" onClick={() => setShowAntiDumpingModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '4px', fontSize: '14px', cursor: 'pointer' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supporting Docs popup (item e-Sanchit) = the same panel as tab 5 "Supporting Docs", in item mode: Doc. for =
          this item / its invoice / BE, PDF attach + DSC sign & upload, copy by job no. Rendered on <body>. 29-Oct-2026 */}
      {showSupportingDocsModal && (
        <BodyPortal>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '12px', boxSizing: 'border-box' }} onClick={(e) => { if (e.target === e.currentTarget) setShowSupportingDocsModal(false); }}>
          <div role="dialog" aria-label="eSanchit documents" style={{ background: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1180px', maxHeight: 'calc(100vh - 24px)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <div><strong style={{ fontSize: '14px', color: '#0f172a' }}>eSanchit documents - item {selectedItem.invSrNo || '?'}/{selectedItem.itemSrNo || '?'}</strong><span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>Doc. for = this item, its invoice or the BE - invoice / BE rows are kept once on the job (shared by all its items)</span></div>
              <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowSupportingDocsModal(false)} />
            </div>
            <div style={{ padding: '10px 14px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0 }}>
              <EsanchitDocsPanel compact rows={tempDocsData} setRows={setTempDocsData} jobData={jobData} itemCtx={{ invSr: selectedItem.invSrNo, itemSr: selectedItem.itemSrNo }} otherIrns={docsOtherIrns} title="Documents of this item / its invoice / the BE" />
            </div>
            <div style={{ padding: '8px 14px', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowSupportingDocsModal(false)} style={{ height: '30px', padding: '0 14px', background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={saveSupportingDocsModal} style={{ height: '30px', padding: '0 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><CheckSquare size={14} /> OK - keep {tempDocsData.length} document(s)</button>
            </div>
          </div>
        </div>
        </BodyPortal>
      )}

      {/* Other Duty Modal */}
    </>
  );
}
