// Screen section: Descartes Self-Diagnostics (FAQ Q31)
// Split out of NetworkSettingsTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { Globe, Key, Server } from 'lucide-react';
import React from 'react';

export default function DescartesSelfDiagnosticsSection({ ctx }) {
  const { S, confirmText, form, handleChange, handleGenerateKey, setConfirmText, setShowKeyWarning, showKeyWarning } = ctx;
  return (
    <>
    <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Globe size={16} color="#64748b"/>
          <span style={{ fontWeight: 700, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Descartes Self-Diagnostics (FAQ Q31)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* TEST Session Log */}
          <a href="https://wwwtest.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp"
            target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '14px', borderRadius: '10px', border: '1.5px solid #bfdbfe',
              background: '#eff6ff', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.15)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🧪 TEST Session Log
                </span>
                <span style={{ fontSize: '10px', color: '#60a5fa' }}>↗ Open</span>
              </div>
              <span style={{ fontSize: '10px', color: '#3b82f6', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                wwwtest.myvan.descartes.com
              </span>
              <span style={{ fontSize: '11px', color: '#1e40af' }}>
                Check SFTP session logs, file upload status, error codes
              </span>
            </div>
          </a>

          {/* PROD Session Log */}
          <a href="https://www.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp"
            target="_blank" rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}>
            <div style={{
              padding: '14px', borderRadius: '10px', border: '1.5px solid #bbf7d0',
              background: '#f0fdf4', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(22,163,74,0.15)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🚀 PRODUCTION Session Log
                </span>
                <span style={{ fontSize: '10px', color: '#4ade80' }}>↗ Open</span>
              </div>
              <span style={{ fontSize: '10px', color: '#16a34a', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                ftp.myvan.descartes.com
              </span>
              <span style={{ fontSize: '11px', color: '#166534' }}>
                Check SFTP session logs, file upload status, error codes
              </span>
            </div>
          </a>
        </div>

        {/* Quick Reference */}
        <div style={{ marginTop: '12px', padding: '12px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Reference — Descartes Error Codes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
            {[
              { code: '0',  label: 'Success',              color: '#16a34a' },
              { code: '11', label: 'Duplicate — do not retry', color: '#dc2626' },
              { code: '28', label: 'Corrupt file — do not retry', color: '#dc2626' },
              { code: '15', label: 'File size > 1 MB',     color: '#d97706' },
              { code: '4',  label: 'General error',        color: '#d97706' },
              { code: '23', label: 'Auth failure',         color: '#dc2626' },
            ].map(e => (
              <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: e.color, color: '#fff', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 800, minWidth: '24px', textAlign: 'center' }}>
                  {e.code}
                </span>
                <span style={{ fontSize: '11px', color: '#475569' }}>{e.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Descartes Contact */}
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: '#64748b' }}>
          <span>📧 Support: <a href="mailto:info@descartes.com" style={{ color: '#3b82f6' }}>info@descartes.com</a></span>
          <span>👤 Contact: <a href="mailto:dliu@descartes.com" style={{ color: '#3b82f6' }}>Dejin Liu (dliu@descartes.com)</a></span>
        </div>
      </div>

      {/* ── STEP 5: Company Info ──────────────────────────────────────────── */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Server size={16} color="#64748b"/>
          <span style={{ fontWeight: 700, fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 5 — Company / Sender Info</span>
        </div>
        <div>
          <label style={S.label}>Company Name <span style={{ textTransform: 'none', fontWeight: 400 }}>(used in XFZB Consignment Security Declaration)</span></label>
          <input name="company_name" value={form.company_name} onChange={handleChange}
            placeholder="e.g. COMMITTED CARGO CARE PVT LTD"
            style={{ ...S.input, textTransform: 'uppercase' }}/>
        </div>
      </div>

      {/* ── Descartes Self-Diagnostics ────────────────────────────────────── */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <Globe size={14} color="#b45309"/>
          <span style={{ fontWeight: 700, fontSize: '12px', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descartes Self-Diagnostics (FAQ Q31)</span>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>Check SFTP session logs on Descartes server after upload attempts</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#0891b2', marginBottom: '4px' }}>🧪 TEST Environment</div>
            <a href="https://wwwtest.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '10px', color: '#2563eb', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              wwwtest.myvan.descartes.com → SFTP Sessions
            </a>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>Shows upload/download history. Requires successful authentication.</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', marginBottom: '4px' }}>🚀 PRODUCTION Environment</div>
            <a href="https://www.myvan.descartes.com/iVanDiagsOF/OftpSessionList?ProtocolDDL=sftp"
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '10px', color: '#2563eb', fontFamily: 'monospace', wordBreak: 'break-all' }}>
              www.myvan.descartes.com → SFTP Sessions
            </a>
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>Shows upload/download history. Requires successful authentication.</div>
          </div>
        </div>
        <div style={{ fontSize: '9px', color: '#92400e', marginTop: '8px', padding: '6px 8px', background: '#fef9c3', borderRadius: '4px' }}>
          ⚠ <strong>Important (FAQ Q23):</strong> Max 4 simultaneous sessions from same IP. Do not poll more than once per 5 minutes. Violations result in 15-minute IP block.
          &nbsp;|&nbsp; <strong>File limit (FAQ Q32):</strong> 1 MB per file. Send smaller files more frequently.
        </div>
      </div>

      {/* ── WARNING MODAL: Confirm before generating new SSH key ──────────── */}
      {showKeyWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '28px 32px',
            maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: '2px solid #fca5a5',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px', lineHeight: 1 }}>⚠️</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#991b1b' }}>
                  WARNING — Generating a New SSH Key
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  This action cannot be undone
                </div>
              </div>
            </div>

            {/* Consequences */}
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', marginBottom: '8px' }}>
                What will happen:
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#7f1d1d', lineHeight: 2 }}>
                <li>A <strong>new RSA 4096-bit key pair</strong> will be generated</li>
                <li>The <strong>old private key will be permanently replaced</strong> in the database</li>
                <li>The old public key registered with <strong>Descartes will stop working</strong></li>
                <li>You must <strong>email the new public key to Descartes</strong> and wait for re-registration before SFTP will work again</li>
              </ul>
            </div>

            {/* Info box */}
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px 12px', marginBottom: '18px', fontSize: '11px', color: '#92400e' }}>
              💡 <strong>Only proceed if:</strong> You are setting up for the first time, or Descartes has asked you to rotate your key.
              <br/>
              <strong>Do NOT proceed</strong> if SFTP is already working — you will break the connection.
            </div>

            {/* Confirm input */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '6px' }}>
                Type <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: '3px', color: '#dc2626' }}>CONFIRM</code> to proceed:
              </label>
              <input
                autoFocus
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && confirmText === 'CONFIRM') handleGenerateKey(); }}
                placeholder="Type CONFIRM here"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '6px', fontSize: '13px',
                  border: `2px solid ${confirmText === 'CONFIRM' ? '#16a34a' : '#e5e7eb'}`,
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
                  color: confirmText === 'CONFIRM' ? '#15803d' : '#111827',
                  background: confirmText === 'CONFIRM' ? '#f0fdf4' : '#fff',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setShowKeyWarning(false); setConfirmText(''); }}
                style={S.btn('#f1f5f9', '#374151', { border: '1px solid #e2e8f0' })}>
                Cancel — Keep Existing Key
              </button>
              <button
                type="button"
                onClick={handleGenerateKey}
                disabled={confirmText !== 'CONFIRM'}
                style={S.btn('#dc2626', '#fff', {
                  opacity: confirmText !== 'CONFIRM' ? 0.4 : 1,
                  cursor:  confirmText !== 'CONFIRM' ? 'not-allowed' : 'pointer',
                })}>
                <Key size={13}/> Yes, Generate New Key
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
