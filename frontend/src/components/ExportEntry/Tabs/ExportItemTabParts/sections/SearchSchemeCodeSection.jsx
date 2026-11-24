// Screen section: Search Scheme Code
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import BodyPortal from '../../../../common/BodyPortal';
import { asList } from '../../../../../utils/asList';
import { CheckCircle, Edit2, Trash2 } from 'lucide-react';
import React from 'react';
import { SB_STATEMENT_TYPES, SB_STATEMENT_CODES } from '../swCodes'; // 19-Nov-2026

export default function SearchSchemeCodeSection({ ctx }) {
  const { formData, handleFormChange, handleRitcSelect, handleSchemeSelect, isRitcModalOpen, isSchemeModalOpen, isSwStatementModalOpen, ritcFilter, schemeFilter, schemesList, setIsRitcModalOpen, setIsSchemeModalOpen, setIsSwStatementModalOpen, setRitcFilter, setSchemeFilter, tariffs } = ctx;
  return (
    <>
    {/* SCHEME SEARCH MODAL */}
      {isSchemeModalOpen && (<BodyPortal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '600px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Search Scheme Code</h3>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, maxHeight: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Find</span>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="ENTER FILTER" 
                  value={schemeFilter} 
                  onChange={(e) => setSchemeFilter(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--bg-input, var(--bg-input, #f1f5f9))', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'center', width: '40px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}></th>
                      <th style={{ padding: '6px', textAlign: 'left', width: '60px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>CODE</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemesList.filter(s => s.code?.includes(schemeFilter) || s.desc?.toLowerCase()?.includes(schemeFilter?.toLowerCase())).map((scheme) => (
                      <tr key={scheme.code} className="hover-row" style={{ borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer' }} onClick={() => handleSchemeSelect(scheme.code, scheme.desc)}>
                        <td style={{ padding: '6px', textAlign: 'center' }}><CheckCircle size={14} color="#10b981" /></td>
                        <td style={{ padding: '6px', fontWeight: 600 }}>{scheme.code}</td>
                        <td style={{ padding: '6px' }}>{scheme.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsSchemeModalOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      </BodyPortal>)}

      {/* RITC SEARCH MODAL */}
      {isRitcModalOpen && (<BodyPortal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '700px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Search RITC Code</h3>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, maxHeight: '400px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Find</span>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="ENTER FILTER" 
                  value={ritcFilter} 
                  onChange={(e) => setRitcFilter(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: 'var(--bg-input, var(--bg-input, #f1f5f9))', position: 'sticky', top: 0 }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'center', width: '40px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}></th>
                      <th style={{ padding: '6px', textAlign: 'left', width: '80px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>CODE</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>DESCRIPTION</th>
                      <th style={{ padding: '6px', textAlign: 'left', width: '60px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>UNIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tariffs.filter(r => r.hsnCode?.includes(ritcFilter) || r.description?.toLowerCase()?.includes(ritcFilter?.toLowerCase())).slice(0, 100).map((ritc) => (
                      <tr key={ritc.id} className="hover-row" style={{ borderBottom: '1px solid var(--bg-input, #f1f5f9)', cursor: 'pointer' }} onClick={() => handleRitcSelect(ritc.hsnCode, ritc.description, ritc.uqc || 'KGS')}>
                        <td style={{ padding: '6px', textAlign: 'center' }}><CheckCircle size={14} color="#10b981" /></td>
                        <td style={{ padding: '6px', fontWeight: 600 }}>{ritc.hsnCode}</td>
                        <td style={{ padding: '6px' }}>{ritc.description}</td>
                        <td style={{ padding: '6px', fontWeight: 600, color: '#475569' }}>{ritc.uqc || 'KGS'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsRitcModalOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      </BodyPortal>)}

      {/* SW STATEMENT MODAL */}
      {isSwStatementModalOpen && (<BodyPortal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '700px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>Single Window Statement</h3>
            </div>
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label>Type Code</label>
                    <select className="input-field" value={formData.tempSwStmt?.typeCode || 'Select'} onChange={e => handleFormChange('tempSwStmt', {...(formData.tempSwStmt || {}), typeCode: e.target.value})}><option>Select</option>{SB_STATEMENT_TYPES.map(v => <option key={v}>{v}</option>)}</select>
                  </div>
                  <div>
                    <label>Statement Code</label>
                    {/* 19-Nov-2026: was a list with RD001 only, so the drawback declarations DB001 - DB003 asked for by the Scheme tab could
                        not be given; now a box with suggestions (RD001, RS001, DB001-DB003, AUTPT), any code can be typed */}
                    <input className="input-field" list="sbStmtCodes" maxLength={7} placeholder="e.g. RD001" value={formData.tempSwStmt?.statementCode && formData.tempSwStmt.statementCode !== 'Select' ? formData.tempSwStmt.statementCode : ''} onChange={e => handleFormChange('tempSwStmt', {...(formData.tempSwStmt || {}), statementCode: e.target.value.toUpperCase().replace(/\s/g, '')})} />
                    <datalist id="sbStmtCodes">{SB_STATEMENT_CODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
                  </div>
                  <div>
                    <label>Statement Text</label>
                    <input type="text" className="input-field" value={formData.tempSwStmt?.text || ''} onChange={e => handleFormChange('tempSwStmt', {...(formData.tempSwStmt || {}), text: e.target.value})} />
                  </div>
                  <div>
                    <label>Statement For</label>
                    <select className="input-field" value={formData.tempSwStmt?.statementFor || 'Select'} onChange={e => handleFormChange('tempSwStmt', {...(formData.tempSwStmt || {}), statementFor: e.target.value})}><option>Select</option><option>I</option></select>
                  </div>
                </div>
                <div>
                  <button className="btn btn-primary" style={{ padding: '0.4rem 1.5rem' }} onClick={() => {
                    handleFormChange('swStatements', [...asList(formData.swStatements), { ...(formData.tempSwStmt || {}), id: Date.now() }]);
                    handleFormChange('tempSwStmt', { typeCode: 'Select', statementCode: 'Select', text: '', statementFor: 'Select' });
                  }}>ADD</button>
                </div>
                <div style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '4px', overflowX: 'auto', overflowY: 'auto', maxHeight: '200px', minHeight: '150px' }}>
                  <table className="compact-table" style={{ width: '100%' }}>
                    <thead style={{ background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
                      <tr>
                        <th style={{ width: '40px' }}>Edit</th>
                        <th style={{ width: '50px' }}>Remove</th>
                        <th>Statement For</th>
                        <th>Type Code</th>
                        <th>Statement Code</th>
                        <th>Statement Text</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asList(formData.swStatements).map(stmt => (
                        <tr key={stmt.id}>
                          <td style={{ textAlign: 'center' }}><Edit2 size={12} color="var(--primary-text, #0284c7)" style={{ cursor: 'pointer' }} onClick={() => {
                            handleFormChange('tempSwStmt', stmt);
                            handleFormChange('swStatements', asList(formData.swStatements).filter(s => s.id !== stmt.id));
                          }} /></td>
                          <td style={{ textAlign: 'center' }}><Trash2 size={12} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => {
                            handleFormChange('swStatements', asList(formData.swStatements).filter(s => s.id !== stmt.id));
                          }} /></td>
                          <td>{stmt.statementFor}</td>
                          <td>{stmt.typeCode}</td>
                          <td>{stmt.statementCode}</td>
                          <td>{stmt.text}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => setIsSwStatementModalOpen(false)}>OK</button>
              <button className="btn btn-secondary" onClick={() => setIsSwStatementModalOpen(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      </BodyPortal>)}

      {/* RE-EXPORT MODAL */}
    </>
  );
}
