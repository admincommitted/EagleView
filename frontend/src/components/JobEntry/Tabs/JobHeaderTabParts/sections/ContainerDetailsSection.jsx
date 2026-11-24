// Screen section: Container Details
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import ModernDatePicker from '../../../../common/ModernDatePicker'; // 21-Nov-2026: DD-MM-YYYY date box like the invoice screens (same YYYY-MM-DD value)
import { CheckSquare, Edit2, PlusSquare, Trash2, X } from 'lucide-react';
import React from 'react';
import askConfirm from '../../../../common/askConfirm'; // 22-Nov-2026: EagleView question window in place of the browser's OK / Cancel box

import { BOND_CODES, mergeCodes, filterCodes } from '../icegateCodes';
// Bond Code search: Masters > Bond + the ICEGATE e-Bond purpose codes / IGCR EI (see ../icegateCodes.jsx).
// Bond Port search: Port master. Any other code can still be typed in the box. 28-Oct-2026

export default function ContainerDetailsSection({ ctx }) {
  const { bondMaster = [], handleBondAdd, ports = [], setJobData, addContainer, bondEditIdx, bondRows, containerForm, handleBondEdit, handleBondRemove, handleChange, handleContainerChange, isBondCodeSearchOpen, isBondModalOpen, isBondPortSearchOpen, isContainerModalOpen, jobData, removeContainer, setIsBondCodeSearchOpen, setIsBondModalOpen, setIsBondPortSearchOpen, setIsContainerModalOpen } = ctx;
  const [searchQ, setSearchQ] = React.useState('');
  const q = searchQ.trim().toLowerCase();
  const searchRows = isBondCodeSearchOpen
    ? filterCodes(mergeCodes(bondMaster, BOND_CODES), q)
    // port search: listed only after 2+ letters (the port master is large), max 50
    : (q.length < 2 ? [] : (ports || []).filter(p => String(p.portCode || '').toLowerCase().includes(q) || String(p.portName || '').toLowerCase().includes(q))
        .sort((a, b) => String(b.portCode || '').toLowerCase().startsWith(q) - String(a.portCode || '').toLowerCase().startsWith(q)).slice(0, 50).map(p => ({ code: p.portCode, name: p.portName })));
  const pickSearch = (code) => {
    setJobData(prev => ({ ...prev, [isBondCodeSearchOpen ? 'autoField_26' : 'autoField_27']: code }));
    setIsBondCodeSearchOpen(false); setIsBondPortSearchOpen(false);
  };
  return (
    <>
    {isContainerModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', width: '900px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #cbd5e1', background: 'var(--bg-panel, #ffffff)', borderRadius: '4px 4px 0 0' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Container Details</h3>
              </div>
              
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ border: '1px solid #93c5fd', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Sr No</label>
                      <input name="srNo" type="text" className="input-field" placeholder="Sr No" style={{ width: '100%', border: '1px solid #ef4444', color: 'var(--primary-color-start)' }} value={containerForm.srNo} onChange={handleContainerChange} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>IGM No</label>
                      <input name="igmNumber" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: 'var(--primary-color-start)' }} value={containerForm.igmNumber || ''} onChange={handleContainerChange} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>IGM Date</label>
                      <ModernDatePicker name="igmDate" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }} value={containerForm.igmDate} onChange={handleContainerChange} />
                    </div>
                    <div style={{ flex: 2 }}></div>
                  </div>
  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Container No</label>
                      <input name="contNo" type="text" className="input-field" style={{ width: '100%', border: '2px solid #ef4444' }}  value={containerForm.contNo} onChange={handleContainerChange} />
                    </div>
                    <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Seal No</label>
                      <input name="sealNo" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }}  value={containerForm.sealNo} onChange={handleContainerChange} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>LCL/FCL</label>
                      <select name="lclFcl" className="input-field" style={{ width: '100%', border: '1px solid #ef4444', color: 'var(--primary-color-start)' }} value={containerForm.lclFcl} onChange={handleContainerChange}>
                        <option value="">Select</option>
                        <option value="LCL">LCL</option>
                        <option value="FCL">FCL</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Container Size</label>
                      <select name="contSize" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)', color: 'var(--primary-color-start)' }} value={containerForm.contSize} onChange={handleContainerChange}>
                        <option value="">Select</option>
                        <option value="20">20 FT</option>
                        <option value="40">40 FT</option>
                        <option value="45">45 FT</option>
                      </select>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Container Type</label>
                      <input name="contType" type="text" list="import-cont-types" placeholder="GP / HC / RF ..." className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)', color: 'var(--primary-color-start)', textTransform: 'uppercase' }} value={containerForm.contType} onChange={handleContainerChange} />
                      {/* 04-Nov-2026: common container types; any other value can still be typed */}
                      <datalist id="import-cont-types">
                        <option value="GP">General Purpose (Dry)</option>
                        <option value="HC">High Cube</option>
                        <option value="RF">Reefer</option>
                        <option value="RH">Reefer High Cube</option>
                        <option value="OT">Open Top</option>
                        <option value="FR">Flat Rack</option>
                        <option value="TK">Tank</option>
                        <option value="PL">Platform</option>
                        <option value="VH">Ventilated</option>
                      </datalist>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '11px', marginBottom: '2px' }}>Truck No</label>
                      <input name="truckNo" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={containerForm.truckNo} onChange={handleContainerChange} />
                    </div>
                  </div>
  
                  <div>
                    <button type="button" className="btn btn-primary" onClick={addContainer} style={{ padding: '0.3rem 0.75rem', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                      <PlusSquare size={14} /> Add
                    </button>
                  </div>
                </div>
  
                <div style={{ border: '1px solid #93c5fd', marginTop: '4px', minHeight: '150px', maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #cbd5e1', width: '40px' }}>Remove</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Sr No</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Igm No</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Igm Date</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Cont No</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Seal No</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>LCL/FCL</th>
                        <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Cont. Size</th>
                        <th style={{ padding: '6px', textAlign: 'left' }}>Cont. Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(jobData.containers || []).map((cont, idx) => (
                        <tr key={cont.id || idx} style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '4px', borderRight: '1px solid #cbd5e1', textAlign: 'center' }}>
                            <button onClick={() => removeContainer(cont.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                              <div style={{ width: '14px', height: '14px', background: '#ef4444', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>-</div>
                            </button>
                          </td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.srNo}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.igmNumber || cont.igmNo}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.igmDate}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1', fontWeight: 'bold' }}>{cont.contNo}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.sealNo}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.lclFcl}</td>
                          <td style={{ padding: '6px', borderRight: '1px solid #cbd5e1' }}>{cont.contSize}</td>
                          <td style={{ padding: '6px' }}>{cont.contType}</td>
                        </tr>
                      ))}
                      {(!jobData.containers || jobData.containers.length === 0) && (
                        <tr><td colSpan="9" style={{ textAlign: 'center', padding: '10px', color: '#64748b' }}>No containers added</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '1rem', background: '#f8fafc', borderTop: '1px solid #cbd5e1', borderRadius: '0 0 4px 4px' }}>
                <button className="btn btn-success" onClick={() => setIsContainerModalOpen(false)} style={{ padding: '0.4rem 1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckSquare size={16} /> Ok
                </button>
              </div>
            </div>
          </div>
        )}
        
      {isBondModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '800px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Bond Details</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Bond No</label>
                  <input name="autoField_24" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }}  value={jobData["autoField_24"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Bond Amount</label>
                  <input name="autoField_25" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_25"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Bond Code</label>
                  <div style={{ display: 'flex', border: '1px solid #ef4444', borderRadius: '2px', background: '#fef9c3' }}>
                    <input name="autoField_26" type="text" className="input-field input-field-borderless" style={{ flex: 1, border: 'none', background: 'transparent' }}  value={jobData["autoField_26"] || ""} onChange={handleChange} />
                    <button type="button" onClick={() => { setSearchQ(''); setIsBondCodeSearchOpen(true); }} className="btn" style={{ padding: '0 4px', color: '#1d4ed8', borderLeft: '1px solid #ef4444' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Bond Port</label>
                  <div style={{ display: 'flex', border: '1px solid #ef4444', borderRadius: '2px', background: '#fef9c3' }}>
                    <input list="port-code-list" name="autoField_27" type="text" className="input-field input-field-borderless" style={{ flex: 1, border: 'none', background: 'transparent' }}  value={jobData["autoField_27"] || ""} onChange={handleChange} />
                    <button type="button" onClick={() => { setSearchQ(''); setIsBondPortSearchOpen(true); }} className="btn" style={{ padding: '0 4px', color: '#1d4ed8', borderLeft: '1px solid #ef4444' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <button type="button" onClick={handleBondAdd} className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><PlusSquare size={14} /> {bondEditIdx !== null ? 'Update' : 'Add'}</button>
                </div>
              </div>

              <div style={{ border: '1px solid #93c5fd', marginTop: '8px', minHeight: '150px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '40px' }}>Edit</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '60px' }}>Remove</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>BOND NO</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>BOND AMT</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>BOND CD</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>BOND PORT</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}></th>
                    </tr>
                  </thead>
                                      <tbody>
                      {bondRows.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No bonds added. Fill the fields and click Add.</td></tr>
                      ) : bondRows.map((row, i) => (
                        <tr key={row.id || i} style={{ borderBottom: '1px solid #e2e8f0', background: bondEditIdx === i ? '#fef9c3' : 'white' }}>
                          <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={(e) => handleBondEdit(e, i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}><Edit2 size={13} /></button></td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}><button type="button" onClick={async (e) => { if (await askConfirm({ title: 'Remove this bond?', message: 'The bond row is taken off this job.', okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' })) handleBondRemove(e, i); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><Trash2 size={13} /></button></td>
                          <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.bondNo}</td>
                          <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.bondAmt}</td>
                          <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.bondCode}</td>
                          <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.bondPort}</td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button type="button" onClick={() => setIsBondModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <CheckSquare size={16} /> Ok
              </button>
              <button type="button" onClick={() => setIsBondModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH MODALS */}
      {(isBondCodeSearchOpen || isBondPortSearchOpen) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '500px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#334155' }}>Search</h3>
              <button onClick={() => { setIsBondCodeSearchOpen(false); setIsBondPortSearchOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#94a3b8' }}>X</button>
            </div>
            
            <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }} title="30-Oct-2026: the Code / Description radios here changed nothing - the filter below already matches both">Search by code or description</label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <label style={{ fontSize: '12px', width: '55px' }}>Filter</label>
                <input name="enterFilter" type="text" placeholder="ENTER FILTER" autoFocus style={{ flex: 1, padding: '2px 4px', border: '1px solid var(--primary-color-start)', fontSize: '12px', color: '#64748b' }} value={searchQ} onChange={e => setSearchQ(e.target.value)} />
              </div>
            </div>

            <div style={{ padding: '0.5rem 1rem' }}>
              <div style={{ border: '1px solid #93c5fd', minHeight: '120px', maxHeight: '50vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '30px' }}></th>
                      <th style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>{isBondCodeSearchOpen ? 'CODE' : 'PORT_CD'}</th>
                      <th style={{ padding: '4px', textAlign: 'left' }}>{isBondCodeSearchOpen ? 'DESCRIPTION' : 'PORT_NM'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchRows.length === 0 && <tr><td colSpan={3} style={{ padding: '8px', textAlign: 'center', color: '#94a3b8' }}>{!isBondCodeSearchOpen && q.length < 2 ? 'Type at least 2 letters of the port code or name' : 'Nothing found'}</td></tr>}
                    {searchRows.map(r => (
                      <tr key={r.code} onClick={() => pickSearch(r.code)} style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }} title="Click to select">
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
              <button onClick={() => { setIsBondCodeSearchOpen(false); setIsBondPortSearchOpen(false); }} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}


      {/* CERTIFICATE DETAILS MODAL */}
    </>
  );
}
