// Screen section: Certificate Details
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { PlusSquare, X } from 'lucide-react';
import React from 'react';

import { CERT_TYPES, filterCodes } from '../icegateCodes';

// Cert. Type search: certificate types found in the ICEGATE / CBIC material (EI = IGCR IIN); Warehouse search: Masters >
// Warehouse (the popups showed fixed sample rows that could not be selected). 28-Oct-2026
export default function CertificateDetailsSection({ ctx }) {
  const { certRows = [], certEditIdx = null, handleCertAdd, handleCertEdit, handleCertRemove, warehouseList = [], setJobData, handleChange, isCertModalOpen, isCertTypeSearchOpen, isWarehouseModalOpen, isWarehouseSearchOpen, jobData, setIsCertModalOpen, setIsCertTypeSearchOpen, setIsWarehouseModalOpen, setIsWarehouseSearchOpen } = ctx;
  const [certQ, setCertQ] = React.useState('');
  const [whQ, setWhQ] = React.useState('');
  const [whOpen, setWhOpen] = React.useState(false);
  const certTypeRows = filterCodes(CERT_TYPES, certQ);
  const port = String(jobData.portCode || jobData.autoField_2 || '').toUpperCase();
  const wq = whQ.trim().toLowerCase();
  // warehouses of this job's port first
  // nothing is listed until 2+ letters are typed (the whole master filled the screen); code / name / port / city match,
  // codes starting with the text first, then this job's port, max 50 rows. 28-Oct-2026
  const WH_MIN = 2;
  const whStarts = (w) => String(w.warehouseCode || '').toLowerCase().startsWith(wq) || String(w.warehouseCode || '').toLowerCase().replace(/^wh_/, '').startsWith(wq);
  const whRows = wq.length < WH_MIN ? [] : warehouseList.filter(w => [w.warehouseCode, w.warehouseName, w.linkedPortCode, w.city].some(x => String(x || '').toLowerCase().includes(wq)))
    .sort((a, b) => (whStarts(b) - whStarts(a)) || ((String(b.linkedPortCode || '').toUpperCase() === port) - (String(a.linkedPortCode || '').toUpperCase() === port))).slice(0, 50);
  const pickCertType = (code) => { setJobData(prev => ({ ...prev, autoField_32: code })); setIsCertTypeSearchOpen(false); };
  const pickWarehouse = (w) => { setJobData(prev => ({ ...prev, warehouseCode: String(w.warehouseCode || '').toUpperCase(), warehouseName: w.warehouseName || '' })); setIsWarehouseSearchOpen(false); };
  return (
    <>
    {isCertModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '900px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Certificate Details</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Cert. No</label>
                  <input name="autoField_30" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }}  value={jobData["autoField_30"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Cert. Date</label>
                  <input name="autoField_31" type="text" className="input-field" placeholder="DD/MM/YYYY" style={{ width: '100%', border: '1px solid #ef4444' }}  value={jobData["autoField_31"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Cert. Type</label>
                  <div style={{ display: 'flex', border: '1px solid #ef4444', borderRadius: '2px', background: '#fef9c3' }}>
                    <input name="autoField_32" type="text" className="input-field input-field-borderless" style={{ flex: 1, border: 'none', background: 'transparent' }}  value={jobData["autoField_32"] || ""} onChange={handleChange} />
                    <button type="button" onClick={() => { setCertQ(''); setIsCertTypeSearchOpen(true); }} className="btn" style={{ padding: '0 4px', color: '#1d4ed8', borderLeft: '1px solid #ef4444' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Comissionerate</label>
                  <input name="autoField_33" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_33"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Division</label>
                  <input name="autoField_34" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_34"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Range</label>
                  <input name="autoField_35" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_35"] || ""} onChange={handleChange} />
                </div>
                <div>
                  <button type="button" onClick={handleCertAdd} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><PlusSquare size={14} /> {certEditIdx !== null ? 'Update' : 'Add'}</button>
                </div>
              </div>

              <div style={{ border: '1px solid #93c5fd', marginTop: '8px', minHeight: '150px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '40px' }}>Edit</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '60px' }}>Remove</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>CERT NO</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>CERT DT</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>CERT TYPE</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>COMISSIONERATE</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>DIVISION</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>RANGE</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {certRows.length === 0 && <tr><td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No certificates added. Fill the fields and click Add.</td></tr>}
                    {certRows.map((r, i) => (
                      <tr key={r.id || i} style={{ borderBottom: '1px solid #e2e8f0', background: certEditIdx === i ? '#fef9c3' : undefined }}>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={() => handleCertEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}>Edit</button></td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={() => handleCertRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button></td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.certNo}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.certDate}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.certType}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.commissionerate}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.division}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{r.range}</td>
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsCertModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsCertModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CERT TYPE SEARCH MODAL */}
      {isCertTypeSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>Search</h3>
              <button onClick={() => setIsCertTypeSearchOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>X</button>
            </div>
            
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }} title="30-Oct-2026: the Code / Description radios here changed nothing - the filter below already matches both">Search by code or description</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontSize: '12px', width: '55px' }}>Filter</label>
                <input name="enterFilter" type="text" placeholder="ENTER FILTER" style={{ flex: 1, padding: '2px 4px', border: '1px solid var(--primary-color-start)', fontSize: '12px', color: '#64748b' }} value={certQ} onChange={e => setCertQ(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '0.5rem 1rem' }}>
              <div style={{ border: '1px solid #93c5fd', minHeight: '120px', maxHeight: '50vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30px' }}></th>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>CODE</th>
                      <th style={{ padding: '4px', textAlign: 'left' }}>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certTypeRows.length === 0 && <tr><td colSpan={3} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>No match - type the code in the Cert. Type box</td></tr>}
                    {certTypeRows.map(r => (
                      <tr key={r.code} onClick={() => pickCertType(r.code)} title="Click to select" style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}>
                        <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}><div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></div></td>
                        <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{r.code}</td>
                        <td style={{ padding: '4px' }}>{r.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setIsCertTypeSearchOpen(false)} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* WAREHOUSE DETAILS MODAL */}
      {isWarehouseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '600px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Update Warehouse Code</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0' }}>
              <label style={{ width: '120px', fontSize: '12px' }}>Warehouse Code</label>
              <div style={{ display: 'flex', border: '1px solid #ef4444', borderRadius: '2px', background: '#fef9c3', width: '250px' }}>
                {/* type-ahead: suggestions appear only after typing 2+ letters */}
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  <input name="warehouseCode" type="text" autoComplete="off" className="input-field input-field-borderless" placeholder="TYPE WAREHOUSE CODE / NAME" style={{ flex: 1, border: 'none', background: 'transparent' }} value={jobData["warehouseCode"] || ""}
                    onChange={e => { const v = e.target.value.toUpperCase(); setJobData(prev => ({ ...prev, warehouseCode: v })); setWhQ(v); setWhOpen(true); }}
                    onKeyDown={e => { if (e.key === 'Enter' && whOpen && whRows[0]) { e.preventDefault(); pickWarehouse(whRows[0]); setWhOpen(false); } if (e.key === 'Escape') setWhOpen(false); }}
                    onBlur={() => setTimeout(() => setWhOpen(false), 150)} />
                  {whOpen && whQ.trim().length >= WH_MIN && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: '-30px', zIndex: 20, background: '#fff', border: '1px solid #cbd5e1', boxShadow: '0 4px 10px rgba(0,0,0,0.12)', maxHeight: '240px', overflowY: 'auto' }}>
                      {whRows.length === 0 && <div style={{ padding: '6px 8px', fontSize: '11px', color: '#94a3b8' }}>No warehouse matches "{whQ}"</div>}
                      {whRows.slice(0, 15).map(w => (
                        <div key={w.warehouseCode} onMouseDown={e => { e.preventDefault(); pickWarehouse(w); setWhOpen(false); }} style={{ padding: '5px 8px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: '11px' }}>
                          <b style={{ color: 'var(--primary-color-start)' }}>{w.warehouseCode}</b> <span style={{ color: '#475569' }}>{w.warehouseName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => { setWhQ(String(jobData.warehouseCode || '')); setIsWarehouseSearchOpen(true); }} className="btn" style={{ padding: '0 4px', color: '#1d4ed8', borderLeft: '1px solid #ef4444' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </button>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAREHOUSE SEARCH MODAL */}
      {isWarehouseSearchOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>Search</h3>
              <button onClick={() => setIsWarehouseSearchOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>X</button>
            </div>
            
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }} title="30-Oct-2026: the Code / Description radios here changed nothing - the filter below already matches both">Search by code or description</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontSize: '12px', width: '55px' }}>Filter</label>
                <input name="enterFilter" type="text" placeholder="TYPE WAREHOUSE CODE / NAME / PORT" autoFocus style={{ flex: 1, padding: '2px 4px', border: '1px solid var(--primary-color-start)', fontSize: '12px', color: '#0f172a' }} value={whQ} onChange={e => setWhQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && whRows[0]) { e.preventDefault(); pickWarehouse(whRows[0]); } }} />
              </div>
            </div>

            <div style={{ padding: '0.5rem 1rem' }}>
              <div style={{ border: '1px solid #93c5fd', minHeight: '120px', maxHeight: '50vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30px' }}></th>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>WH_CODE</th>
                      <th style={{ padding: '4px', textAlign: 'left' }}>WH_NAME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whRows.length === 0 && <tr><td colSpan={3} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{!warehouseList.length ? 'No warehouses in Masters > Warehouse - add them there, or type the code' : wq.length < WH_MIN ? `Type at least ${WH_MIN} letters of the warehouse code, name or port (e.g. INDEL4)` : 'No match'}</td></tr>}
                    {whRows.map(r => (
                      <tr key={r.warehouseCode} onClick={() => pickWarehouse(r)} title="Click to select" style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}>
                        <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0', textAlign: 'center' }}><div style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></div></td>
                        <td style={{ padding: '4px', borderRight: '1px solid #e2e8f0' }}>{r.warehouseCode}</td>
                        <td style={{ padding: '4px' }}>{r.warehouseName}{r.linkedPortCode ? ' (' + r.linkedPortCode + ')' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => setIsWarehouseSearchOpen(false)} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* HIGH SEA SALE DETAILS MODAL */}
    </>
  );
}
