// Screen section: High Sea Sale Details
// Split out of JobHeaderTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Edit2, PlusSquare, Trash2 } from 'lucide-react';
import React from 'react';
import askConfirm from '../../../../common/askConfirm'; // 22-Nov-2026: EagleView question window in place of the browser's OK / Cancel box
import { RichPartySelect } from '../RichPartySelect';

// 22-Nov-2026: the suggestion lists of the Job Header (countries, currencies, units, schemes, states). They were
// built again on every key typed in any header box - about a fifth of the time of each key. Drawn once per master list.
const HeaderLists = React.memo(function HeaderLists({ masters }) {
  return (
        <>
          <datalist id="country-list">{masters.countries?.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}</datalist>
          <datalist id="currency-list">{masters.currencies?.map(c => <option key={c.id} value={c.currencyCode}>{c.currencyName}</option>)}</datalist>
          <datalist id="uqc-list">{masters.uqcs?.map(c => <option key={c.id} value={c.uqcCode}>{c.description}</option>)}</datalist>
          <datalist id="scheme-list">{masters.schemeCodes?.map(c => <option key={c.code} value={c.code}>{c.desc}</option>)}</datalist>
          <datalist id="state-list">{masters.states?.map(c => <option key={c.id} value={c.stateName}>{c.stateCode} - GST {c.taxCode}</option>)}</datalist>
          <datalist id="state-taxcode-list">{masters.states?.map(c => <option key={c.id} value={c.taxCode}>{c.stateName}</option>)}</datalist>
        </>
  );
});

export default function HighSeaSaleSection({ ctx }) {
  const { hssBranches = [], handleHssBranchChange, handleChange, handleHssAdd, handleHssEdit, handleHssRemove, hssEditIdx, hssRows, isFirstCheckModalOpen, isHighSeaSaleModalOpen, isProvAssessModalOpen, isSection48ModalOpen, jobData, masters, parties, setIsFirstCheckModalOpen, setIsHighSeaSaleModalOpen, setIsProvAssessModalOpen, setIsSection48ModalOpen, setJobData } = ctx;
  return (
    <>
    {isHighSeaSaleModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '900px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>High Sea Sale Details</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Importer Name</label>
                  <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} type="HIGH_SEA" masters={masters} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>IEC Code</label>
                  <input name="autoField_41" type="text" className="input-field" style={{ width: '100%', border: '1px solid #ef4444', background: '#dcfce7' }}  value={jobData["autoField_41"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Branch Sr. No</label>
                    <select name="autoField_60" className="input-field" style={{ width: '100%', border: '1px solid #ef4444' }} value={jobData["autoField_60"] || ""} onChange={handleHssBranchChange}>
                        <option value="">Select Branch</option>
                        {jobData.autoField_60 && !hssBranches.some(b => String(b.branchSrNo) === String(jobData.autoField_60)) && <option key="__cur" value={jobData.autoField_60}>{jobData.autoField_60}</option>}
                        {hssBranches.map(b => (
                            <option key={b.branchSrNo} value={b.branchSrNo}>{b.branchSrNo} - {b.branchName || b.city}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Address1</label>
                  <input name="autoField_42" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_42"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>Address2</label>
                  <input name="autoField_43" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_43"] || ""} onChange={handleChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '11px', marginBottom: '2px' }}>City</label>
                  <input name="autoField_44" type="text" className="input-field" style={{ width: '100%', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_44"] || ""} onChange={handleChange} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '11px', width: '30px' }}>Pin</label>
                <input name="autoField_45" type="text" className="input-field" style={{ width: '120px', border: '1px solid var(--primary-color-start)' }}  value={jobData["autoField_45"] || ""} onChange={handleChange} />
                
                <label style={{ fontSize: '11px', marginLeft: '16px' }}>Preceeding Level</label>
                <select name="autoField_61" className="input-field" style={{ width: '120px', border: '1px solid #ef4444', color: 'var(--primary-color-start)' }} value={jobData["autoField_61"] || ""} onChange={handleChange}>
                  {/* 30-Oct-2026: only "Level- 0" was offered, so every seller of a multi-level high sea sale went
                      out as the first seller. 0 = bought from abroad, 1 = bought from level 0, and so on. */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={'Level- ' + n}>{'Level- ' + n}</option>)}
                </select>
                
                <button type="button" className="btn btn-primary" onClick={handleHssAdd} style={{ padding: '0.2rem 0.5rem', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', marginLeft: '8px' }}><PlusSquare size={14} /> {hssEditIdx !== null ? 'Update' : 'Add'}</button>
              </div>

              <div style={{ border: '1px solid #93c5fd', marginTop: '8px', minHeight: '80px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '40px' }}>Edit</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1', width: '60px' }}>Remove</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Importer Name</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>IEC No</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Branch Sr. No</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Address1</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Address2</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>City</th>
                      <th style={{ padding: '6px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Pin</th>
                      <th style={{ padding: '6px', textAlign: 'left' }}>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hssRows.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No entries added yet. Fill the fields above and click Add.</td></tr>
                    ) : hssRows.map((row, i) => (
                      <tr key={row.id || i} style={{ borderBottom: '1px solid #e2e8f0', background: hssEditIdx === i ? '#fef9c3' : 'white' }}>
                        <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                          <button onClick={() => handleHssEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }} title="Edit"><Edit2 size={13} /></button>
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                          <button onClick={async () => { if (await askConfirm({ title: 'Remove this High Sea Sale entry?', message: 'The row is taken off this job.', okLabel: 'Remove', cancelLabel: 'Keep', tone: 'danger' })) handleHssRemove(i); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }} title="Remove"><Trash2 size={13} /></button>
                        </td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0', fontWeight: 600 }}>{row.importerName}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.iecNo}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.branchSrNo}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.address1}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.address2}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.city}</td>
                        <td style={{ padding: '4px 6px', borderRight: '1px solid #e2e8f0' }}>{row.pin}</td>
                        <td style={{ padding: '4px 6px', fontWeight: 600 }}>{String(row.precedingLevel || 'Level- 0').replace('Level- ', '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsHighSeaSaleModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsHighSeaSaleModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 48 MODAL */}
      {isSection48ModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '600px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Permission(S48)</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px' }}>Permission Code</label>
                <div style={{ flex: 1, padding: '4px', border: '1px solid #94a3b8', background: '#f1f5f9', color: 'var(--primary-color-start)', fontSize: '12px' }}>S48</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px', marginTop: '4px' }}>Reason</label>
                <textarea name="section48Reason" value={jobData.section48Reason || ''} onChange={(e) => { const { name, value } = e.target; setJobData(prev => ({ ...prev, [name]: value })); }} style={{ flex: 1, height: '150px', border: '1px solid var(--primary-color-start)', padding: '4px', resize: 'none', outline: 'none' }}></textarea>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsSection48ModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsSection48ModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIRST CHECK MODAL */}
      {isFirstCheckModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '600px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Permission(FCK)</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px' }}>Permission Code</label>
                <div style={{ flex: 1, padding: '4px', border: '1px solid #94a3b8', background: '#f1f5f9', color: 'var(--primary-color-start)', fontSize: '12px' }}>FCK</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px', marginTop: '4px' }}>Reason</label>
                <textarea name="firstCheckReason" value={jobData.firstCheckReason || ''} onChange={(e) => { const { name, value } = e.target; setJobData(prev => ({ ...prev, [name]: value })); }} style={{ flex: 1, height: '150px', border: '1px solid var(--primary-color-start)', padding: '4px', resize: 'none', outline: 'none' }}></textarea>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsFirstCheckModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsFirstCheckModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}


      {/* PROVISIONAL ASSESSMENT MODAL */}
      {isProvAssessModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '600px', borderRadius: '4px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#334155' }}>Permission(PRV)</h3>
            </div>
            
            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px' }}>Permission Code</label>
                <div style={{ flex: 1, padding: '4px', border: '1px solid #94a3b8', background: '#f1f5f9', color: 'var(--primary-color-start)', fontSize: '12px' }}>PRV</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <label style={{ width: '120px', fontSize: '12px', marginTop: '4px' }}>Reason</label>
                <textarea name="provAssessReason" value={jobData.provAssessReason || ''} onChange={(e) => { const { name, value } = e.target; setJobData(prev => ({ ...prev, [name]: value })); }} style={{ flex: 1, height: '150px', border: '1px solid var(--primary-color-start)', padding: '4px', resize: 'none', outline: 'none' }}></textarea>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', background: '#f8fafc' }}>
              <button onClick={() => setIsProvAssessModalOpen(false)} className="btn btn-success" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                OK
              </button>
              <button onClick={() => setIsProvAssessModalOpen(false)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

    
      {masters && <HeaderLists masters={masters} />}
    </>
  );
}
