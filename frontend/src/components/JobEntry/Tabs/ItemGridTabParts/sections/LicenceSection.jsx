// Screen section: Licence debit of the item (BE licenseModel). Added 28-Oct-2026 - the "Licence" flag had no popup.
import { CheckSquare, Edit, Plus, Trash2, X } from 'lucide-react';
import React from 'react';

const FIELDS = [
  ['licenceNo', 'Licence / Regn No', '10 digits'],
  ['licenceDate', 'Regn Date', '', 'date'],
  ['licenceCode', 'Licence Code', 'e.g. AA'],
  ['regnPort', 'Regn Port', 'INDEL4'],
  ['itemSrNoLicence', 'Item Sr No in Licence', '1'],
  ['debitValue', 'Debit Value (INR)', ''],
  ['debitQty', 'Debit Quantity', ''],
  ['debitUqc', 'Debit UQC', 'NOS'],
  // duty exemption claimed under this licence / scrip -> BE DEPB row (filed RoDTEP-scrip BE: RODTEP / 1). 29-Oct-2026
  ['exemptionNotn', 'Exemption Notn (DEPB)', 'e.g. RODTEP'],
  ['exemptionSrNo', 'Exemption Sr No', '1'],
];

export default function LicenceSection({ ctx }) {
  const { showLicenceModal, setShowLicenceModal, tempLicenceData, licenceForm, setLicenceForm, licenceEditId, addLicenceRow, editLicenceRow, removeLicenceRow, saveLicenceModal } = ctx;
  if (!showLicenceModal) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div style={{ background: 'var(--bg-panel, #fff)', borderRadius: '4px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid var(--border-color, #cbd5e1)' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main, #334155)', fontWeight: 'normal' }}>Licence Details (debit)</h3>
          <X size={18} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setShowLicenceModal(false)} />
        </div>
        <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
            {FIELDS.map(([key, label, ph, type]) => (
              <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: 'var(--text-main, #0f172a)' }}>{label}
                <input type={type || 'text'} className="input-field" placeholder={ph} value={licenceForm[key] || ''}
                  onChange={(e) => setLicenceForm({ ...licenceForm, [key]: key === 'licenceCode' || key === 'regnPort' || key === 'debitUqc' || key === 'exemptionNotn' ? e.target.value.toUpperCase() : e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLicenceRow(); } }}
                  style={{ border: key === 'licenceNo' ? '1px solid #ef4444' : '1px solid #cbd5e1' }} />
              </label>
            ))}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" onClick={addLicenceRow} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary-color-start)', border: 'none', padding: '6px 12px', color: '#fff', fontSize: '12px', borderRadius: '4px', cursor: 'pointer' }}>
                {licenceEditId !== null ? <><Edit size={12} /> Update</> : <><Plus size={12} /> Add</>}
              </button>
            </div>
          </div>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflowX: 'auto' }}>
            <table className="data-grid" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
              <thead style={{ background: 'var(--primary-bg-light)' }}>
                <tr>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Edit</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Remove</th>
                  {FIELDS.map(([key, label]) => <th key={key} style={{ padding: '6px' }}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {tempLicenceData.length === 0 && <tr><td colSpan={FIELDS.length + 2} style={{ padding: '14px', textAlign: 'center', color: '#64748b' }}>No licence rows.</td></tr>}
                {tempLicenceData.map((row) => (
                  <tr key={row.id} style={{ background: licenceEditId === row.id ? 'var(--primary-bg-light)' : undefined }}>
                    <td style={{ padding: '6px', textAlign: 'center' }}><Edit size={14} color="var(--primary-color-start)" style={{ cursor: 'pointer' }} onClick={() => editLicenceRow(row)} /></td>
                    <td style={{ padding: '6px', textAlign: 'center' }}><Trash2 size={14} color="#ef4444" style={{ cursor: 'pointer' }} onClick={() => removeLicenceRow(row.id)} /></td>
                    {FIELDS.map(([key]) => <td key={key} style={{ padding: '6px' }}>{row[key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ padding: '10px 15px', display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color, #cbd5e1)' }}>
          <button type="button" className="btn btn-success" onClick={saveLicenceModal} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#22c55e', color: '#fff', padding: '6px 16px', borderRadius: '4px', border: 'none', fontSize: '12px', cursor: 'pointer' }}>
            <CheckSquare size={14} /> Ok
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setShowLicenceModal(false)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', color: '#334155', border: '1px solid var(--border-color, #cbd5e1)', padding: '6px 16px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer' }}>
            <X size={14} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
