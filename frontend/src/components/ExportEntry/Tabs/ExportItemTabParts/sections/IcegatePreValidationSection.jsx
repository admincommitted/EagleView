// Screen section: ICEGATE Pre-Validation Failed
// Split out of ExportItemTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import BodyPortal from '../../../../common/BodyPortal';
import { asList } from '../../../../../utils/asList';
import { CheckCircle } from 'lucide-react';
import Modal from '../../../../common/Modal';
import React from 'react';
import { SB_INFO_TYPES, infoQualsOf, infoCodesOf } from '../swCodes'; // 19-Nov-2026: code suggestions (format 3.7)

export default function IcegatePreValidationSection({ ctx }) {
  const { formData, handleFormChange, isSwInfoModalOpen, setIsSwInfoModalOpen, setSwInfoRowCount, setValidationErrors, setValidationSuccess, swInfoRowCount, validationErrors, validationSuccess } = ctx;
  return (
    <>
    {/* VALIDATION MODAL */}
      <Modal isOpen={validationErrors.length > 0} onClose={() => setValidationErrors([])} title="ICEGATE Pre-Validation Failed">
        <div style={{ color: '#b91c1c', fontSize: '13px', background: '#fef2f2', border: '1px solid #f87171', padding: '12px', borderRadius: '4px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Please fix the following errors:</strong>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {validationErrors.map((err, i) => <li key={i} style={{ marginBottom: '4px' }}>{err}</li>)}
          </ul>
        </div>
      </Modal>

      <Modal isOpen={validationSuccess} onClose={() => setValidationSuccess(false)} title="Validation Successful">
        <div style={{ color: '#15803d', fontSize: '13px', background: '#f0fdf4', border: '1px solid #4ade80', padding: '12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          <strong>Job Validation Successful! No errors found.</strong>
        </div>
      </Modal>

      {/* SW INFO MODAL */}
      {isSwInfoModalOpen && (<BodyPortal>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '900px', borderRadius: '6px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-main, var(--text-main, #0f172a))' }}>SW Info</h3>
            </div>
            
            <div style={{ padding: '1rem', flex: 1, overflowY: 'auto', maxHeight: '60vh' }}>
              <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color, #cbd5e1)' }}>
                <thead style={{ background: 'var(--bg-input, var(--bg-input, #f1f5f9))' }}>
                  <tr>
                    <th style={{ width: '30px', textAlign: 'center' }}><input type="checkbox" /></th>
                    <th>INFO TYPE</th>
                    <th>INFO QUALIFIER</th>
                    <th>INFO CODE</th>
                    <th>INFO TEXT</th>
                    <th>INFO MSR</th>
                    <th>INFO UQC</th>
                  </tr>
                </thead>
                <tbody>
                  {asList(formData.swInfos).map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: 'center' }}><input type="checkbox" /></td>
                      <td><input type="text" className="grid-input" list="sbSwTypes" style={{ border: '1px solid #ef4444', color: 'var(--text-main, var(--text-main, #0f172a))' }}  value={row.swInfoField1 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField1: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                      <td><input type="text" className="grid-input" list={`sbSwQual-${idx}`} style={{ border: '1px solid #ef4444', color: 'var(--text-main, var(--text-main, #0f172a))' }}  value={row.swInfoField2 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField2: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                      <td><input type="text" className="grid-input" list={`sbSwCode-${idx}`} style={{ border: '1px solid #ef4444', color: 'var(--text-main, var(--text-main, #0f172a))' }}  value={row.swInfoField3 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField3: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                      <td><input type="text" className="grid-input" style={{ border: '1px solid var(--border-color, #cbd5e1)' }}  value={row.swInfoField4 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField4: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                      <td><input type="text" className="grid-input" style={{ border: '1px solid var(--primary-color-start, #0ea5e9)', color: 'var(--text-main, var(--text-main, #0f172a))' }}  value={row.swInfoField5 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField5: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                      <td><input type="text" className="grid-input" style={{ border: '1px solid var(--primary-color-start, #0ea5e9)', color: 'var(--text-main, var(--text-main, #0f172a))' }}  value={row.swInfoField6 || ''} onChange={e => { const newArr = [...asList(formData.swInfos)]; newArr[idx] = {...newArr[idx], swInfoField6: e.target.value}; handleFormChange('swInfos', newArr); }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* 19-Nov-2026: suggestions from the ICES Exports message format 3.7 and the 2026 advisories (EPT FTANZD, TEX FR001 / FR009,
                  MOOWR, DTA / SEZ GSTIN ...); other codes can still be typed */}
              <datalist id="sbSwTypes">{SB_INFO_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
              {asList(formData.swInfos).map((row, idx) => (
                <React.Fragment key={'dl' + idx}>
                  <datalist id={`sbSwQual-${idx}`}>{infoQualsOf(row.swInfoField1).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
                  <datalist id={`sbSwCode-${idx}`}>{infoCodesOf(row.swInfoField1, row.swInfoField2).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>
                </React.Fragment>
              ))}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>No. Of Rows</span>
                <input type="number" min="1" max="20" className="input-field" value={swInfoRowCount} onChange={e => setSwInfoRowCount(parseInt(e.target.value) || 1)} style={{ width: '50px', color: 'var(--text-main, var(--text-main, #0f172a))' }} />
                <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'var(--primary-color-start, #3b82f6)', borderColor: '#3b82f6' }} onClick={() => {
                  const newRows = Array.from({ length: swInfoRowCount }, () => ({ id: Date.now() + Math.random() }));
                  handleFormChange('swInfos', [...asList(formData.swInfos), ...newRows]);
                }}>+ Add Row</button>
                <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#ef4444', borderColor: '#ef4444' }} onClick={() => { const newArr = [...asList(formData.swInfos)]; newArr.pop(); handleFormChange('swInfos', newArr); }}>x Remove Last Row</button>
              </div>
            </div>

            <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button className="btn btn-primary" style={{ background: '#22c55e', borderColor: '#22c55e', padding: '0.4rem 1.5rem' }} onClick={() => setIsSwInfoModalOpen(false)}>Save</button>
              <button className="btn btn-primary" style={{ background: 'var(--primary-color-start, #3b82f6)', borderColor: '#3b82f6', padding: '0.4rem 1.5rem' }} onClick={() => handleFormChange('swInfos', [])}>Reset</button>
              <button className="btn btn-primary" style={{ background: 'var(--primary-color-start, #3b82f6)', borderColor: '#3b82f6', padding: '0.4rem 1.5rem' }} onClick={() => setIsSwInfoModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </BodyPortal>)}
    </>
  );
}
