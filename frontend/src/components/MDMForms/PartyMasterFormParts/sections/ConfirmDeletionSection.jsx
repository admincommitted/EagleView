// Screen section: CONFIRM DELETION
// Split out of PartyMasterForm.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import KYCVaultModal from '../../KYCVaultModal';
import React from 'react';

export default function ConfirmDeletionSection({ ctx }) {
  const { deleteConfirm, handleConfirmDelete, selectedParty, setDeleteConfirm, setShowKycVault, setUiModal, showKycVault, uiModal } = ctx;
  return (
    <>
    {deleteConfirm.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '450px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 24px', backgroundColor: '#fff1f2', borderBottom: '1px solid #ffe4e6', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#e11d48', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>!</div>
              <h2 style={{ margin: 0, color: '#9f1239', fontSize: '16px', fontWeight: '700', letterSpacing: '0.5px' }}>CONFIRM DELETION</h2>
            </div>
            <div style={{ padding: '32px 24px', color: '#334155', fontSize: '14px', lineHeight: '1.6', fontWeight: '500' }}>
              Are you sure you want to delete this {deleteConfirm.type === 'PARTY' ? 'Party from the Master Database' : 'Address'}? This action cannot be undone.
            </div>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setDeleteConfirm({ isOpen: false, type: '', payload: null })} style={{ backgroundColor: 'var(--primary-bg-light, #e0f2fe)', color: '#334155', padding: '10px 24px', borderRadius: '4px', fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer' }}>CANCEL</button>
              <button onClick={handleConfirmDelete} style={{ backgroundColor: '#e11d48', color: 'white', padding: '10px 24px', borderRadius: '4px', fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.4)' }}>YES, DELETE</button>
            </div>
          </div>
        </div>
      )}

      {uiModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '550px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '16px 24px', backgroundColor: uiModal.type === 'error' ? '#fff1f2' : '#f0fdf4', borderBottom: `1px solid ${uiModal.type === 'error' ? '#ffe4e6' : '#22c55e'}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
              {uiModal.type === 'error' ? 
                <div style={{ background: '#e11d48', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>!</div> : 
                <div style={{ background: '#10b981', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>&#10003;</div>
              }
              <h2 style={{ margin: 0, color: uiModal.type === 'error' ? '#9f1239' : '#166534', fontSize: '16px', fontWeight: '700', letterSpacing: '0.5px' }}>{uiModal.title}</h2>
            </div>
            <div style={{ padding: '32px 24px', color: '#334155', fontSize: '14px', lineHeight: '1.6', fontWeight: '500' }}>
              {uiModal.message}
            </div>
            <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-app, var(--bg-app, #f8fafc))', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setUiModal({ ...uiModal, isOpen: false })} style={{ backgroundColor: 'var(--text-main, var(--text-main, #0f172a))', color: 'white', padding: '10px 24px', borderRadius: '6px', fontWeight: '600', fontSize: '13px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>OK / REVIEW</button>
            </div>
          </div>
        </div>
      )}

      {showKycVault && selectedParty && (
        <KYCVaultModal party={selectedParty} onClose={() => setShowKycVault(false)} />
      )}
    </>
  );
}
