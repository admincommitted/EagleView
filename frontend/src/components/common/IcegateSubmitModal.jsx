import React, { useState, useEffect } from 'react';
import { X, Shield, CheckCircle, Loader, Download } from 'lucide-react';
import { defaultIcegateId, rememberIcegateId } from './IcegateIdPickModal';

// onSignOnly(profileId, pin): optional - signs the file with the token and downloads it, nothing goes to ICEGATE (17-Nov-2026)
export default function IcegateSubmitModal({ chaCode, onSubmit, onClose, loading, allowAmendment = true, onSignOnly }) {
  // 30-Oct-2026: a BE amendment cannot go as JSON (the backend refuses it: ACTIONS > BE Amendment File builds the
  // CACHI01_A flat file instead), so the Job Entry screen hides this checkbox; the Shipping Bill still uses it.
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tokenPin, setTokenPin] = useState('');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    async function loadProfiles() {
      try {
        const res = await fetch('/api/icegate-profiles');
        const json = await res.json();
        if (json.success) {
          const profs = json.data || [];
          setProfiles(profs);
          
          if (profs.length > 0) {
            // 17-Nov-2026: the ID used last (Submit / Download), else the one linked to the CHA, else the default one -
            // the same pick as Download JSON / .be, so the file sent and the file downloaded carry the same ID
            setSelectedId(defaultIcegateId(profs, chaCode));
          } else {
            setError('No ICEGATE profiles found. Please add one in Settings.');
          }
        }
      } catch (err) {
        setError('Failed to fetch ICEGATE profiles');
      } finally {
        setFetching(false);
      }
    }
    loadProfiles();
  }, [chaCode]);

    const [isAmendment, setIsAmendment] = useState(false);
    const [amendmentType, setAmendmentType] = useState('P');
    const [amendReason, setAmendReason] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (!selectedId) return;
      rememberIcegateId(selectedId);
      onSubmit(selectedId, tokenPin, isAmendment, amendmentType, amendReason);
    };

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: '10px', width: '480px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} color="#16a34a" /> Submit to ICEGATE
            </h3>
            <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #64748b)' }}><X size={18} /></button>
          </div>

          {fetching ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>Loading profiles...</div>
          ) : error ? (
            <div style={{ padding: '12px', background: '#fef2f2', color: '#991b1b', borderRadius: '6px', fontSize: '13px' }}>{error}</div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted, #475569)', marginBottom: '8px' }}>
                  Select ICEGATE ID (Digital Signature Profile)
                </label>
                <select 
                  value={selectedId} 
                  onChange={e => setSelectedId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color, #cbd5e1)', fontSize: '14px', outline: 'none' }}
                  disabled={loading}
                >
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.profileName} — {p.loginId} {p.linkedChaCode === chaCode && chaCode ? '(Matched CHA)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {allowAmendment ? (
              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  <input type="checkbox" checked={isAmendment} onChange={e => setIsAmendment(e.target.checked)} disabled={loading} />
                  Filing an Amendment (SCMTR / Custom Declaration)
                </label>
              </div>
              ) : (
              <div style={{ marginTop: '16px', fontSize: '12px', color: '#475569', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '10px' }}>
                Amending a BE? ICEGATE takes an amendment only as the CACHI01_A file - close this and use <strong>ACTIONS &gt; BE Amendment File</strong>.
              </div>
              )}

              {isAmendment && (
                <div style={{ marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Amendment Type</label>
                    <select value={amendmentType} onChange={e => setAmendmentType(e.target.value)} disabled={loading} style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}>
                      <option value="P">Prior to Out of Charge (P)</option>
                      <option value="A">After Out of Charge (A)</option>
                      <option value="S">SCMTR Manifest Amendment (S)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>Amendment Reason</label>
                    <input type="text" value={amendReason} onChange={e => setAmendReason(e.target.value)} disabled={loading} required={isAmendment} placeholder="Enter reason for amendment" style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                  🔑 DSC Token PIN
                </label>
                <input
                  type="password"
                  placeholder="Enter your USB token PIN"
                  value={tokenPin}
                  onChange={e => setTokenPin(e.target.value)}
                  disabled={loading}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  Required to digitally sign the JSON (same mechanism as ICEGATE Common Signer Utility)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
              {onSignOnly && (
                <button type="button" title="Signs the file with the token and downloads it - nothing is sent to ICEGATE. Check it on filesign.icegate.gov.in (Verify)." disabled={!selectedId || !tokenPin || loading || signing}
                  onClick={async () => { rememberIcegateId(selectedId); setSigning(true); try { await onSignOnly(selectedId, tokenPin); } finally { setSigning(false); } }}
                  style={{ padding: '8px 14px', background: '#fff', color: '#0f766e', border: '1px solid #0f766e', borderRadius: '6px', fontWeight: 600, cursor: (!selectedId || !tokenPin || loading || signing) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                  {signing ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
                  Download signed file (not sent)
                </button>
              )}
              <button type="button" onClick={onClose} disabled={loading} style={{ padding: '8px 16px', background: 'var(--bg-input, var(--bg-input, #f1f5f9))', color: 'var(--text-muted, var(--text-muted, #475569))', border: 'none', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={!selectedId || !tokenPin || loading} style={{ padding: '8px 24px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {loading ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Confirm Submit
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
