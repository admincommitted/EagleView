// Screen section: Network / SFTP Settings
// Split out of NetworkSettingsTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import { CheckCircle, ChevronDown, ChevronUp, Copy, Download, Eye, EyeOff, Globe, Key, Network, Save, Server, ToggleRight, Wifi, XCircle } from 'lucide-react';
import React from 'react';
import { NETWORK_PRESETS } from '../helpers';

export default function NetworkSftpSettingsSection({ ctx }) {
  const { S, activeEnv, activeHost, copied, downloadFile, downloadingBackup, downloadingPubKey, form, generatedKey, generating, handleChange, handleCopyPublicKey, handleDownloadPrivateKeyBackup, handleDownloadPublicKey, handleEnvSwitch, handleGenerateKeyClick, handleNetworkSelect, handleSave, handleTestSftp, hasKeyInDb, isConfigured, message, saving, selectedNetwork, setMessage, setShowInstructions, setShowPassword, showInstructions, showPassword, testLog, testing } = ctx;
  return (
    <>
    {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Network size={22} color="#1d4ed8"/>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main,#0f172a)' }}>Network / SFTP Settings</h3>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-muted,#64748b)' }}>SFTP connection config for XFWB / XFHL / XFZB / XFFM transmission</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleTestSftp} disabled={testing} style={S.btn('#f0f9ff', '#0369a1', { border: '1px solid #0369a1', opacity: testing ? 0.6 : 1 })}>
            <Wifi size={14}/> {testing ? 'Testing...' : `Test ${activeEnv === 'test' ? 'TEST' : 'PROD'} SFTP`}
          </button>
          <button onClick={handleSave} disabled={saving} style={S.btn('#1d4ed8', '#fff', { opacity: saving ? 0.6 : 1 })}>
            <Save size={14}/> {saving ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>

      {/* ── Message ───────────────────────────────────────────────────────── */}
      {message.text && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontSize: '13px', fontWeight: 600,
          background: message.type === 'success' ? '#f0fdf4' : message.type === 'error' ? '#fef2f2' : '#eff6ff',
          color:      message.type === 'success' ? '#166534' : message.type === 'error' ? '#991b1b' : '#1d4ed8',
          border: `1px solid ${message.type === 'success' ? '#86efac' : message.type === 'error' ? '#fca5a5' : '#bfdbfe'}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ text: '', type: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1,
              color: 'inherit', opacity: 0.6, flexShrink: 0, padding: '0 2px' }} title="Dismiss">✕</button>
        </div>
      )}

      {/* ── STEP 1: Network Preset ────────────────────────────────────────── */}
      <div style={{ ...S.section, borderColor: '#bfdbfe' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Globe size={16} color="#1d4ed8"/>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1 — Select VAN / Carrier Network</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
          {NETWORK_PRESETS.map(p => (
            <div key={p.id} onClick={() => handleNetworkSelect(p)}
              style={{ padding: '16px 18px', borderRadius: '8px', cursor: 'pointer',
                border: selectedNetwork === p.id ? `2px solid ${p.color}` : '2px solid var(--border-color,#e2e8f0)',
                background: selectedNetwork === p.id ? `${p.color}12` : 'var(--bg-panel,#fff)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: selectedNetwork === p.id ? p.color : '#cbd5e1', flexShrink: 0 }}/>
                <span style={{ fontWeight: 700, fontSize: '12px', color: selectedNetwork === p.id ? p.color : 'var(--text-main,#0f172a)' }}>{p.name}</span>
              </div>
              <div style={{ fontSize: '9px', color: '#94a3b8', marginLeft: '18px', fontFamily: 'monospace' }}>TEST: {p.test || '—'} | PROD: {p.prod || '—'}</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.5, marginLeft: '18px', marginTop: '2px' }}>{p.info}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── STEP 2: VAN Recipient ID ──────────────────────────────────────── */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Server size={16} color="#7c3aed"/>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2 — VAN Recipient GLN ID + Defaults</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.5rem' }}>
          <div>
            <label style={S.label}>VAN Recipient ID (GLN) *</label>
            <input name="van_recipient_id" value={form.van_recipient_id} onChange={handleChange}
              placeholder="e.g. TDVAIR01GLNDTCR" style={{ ...S.input, fontFamily: 'monospace', textTransform: 'uppercase' }}/>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>Used in XFWB / XFHL / XFZB XML RecipientParty header</div>
          </div>
          <div>
            <label style={S.label}>Default AWB Currency</label>
            <input name="default_currency" value={form.default_currency} onChange={handleChange}
              placeholder="USD" maxLength={3} style={{ ...S.input, textTransform: 'uppercase' }}/>
          </div>
          <div>
            <label style={S.label}>Default Charge Code</label>
            <select name="default_charge_code" value={form.default_charge_code} onChange={handleChange} style={S.input}>
              <option value="PP">PP — Prepaid</option>
              <option value="CC">CC — Collect</option>
              <option value="CA">CA — Cash</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── STEP 3: Active Environment ────────────────────────────────────── */}
      <div style={{ ...S.section, borderColor: activeEnv === 'test' ? '#a5f3fc' : '#86efac' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <ToggleRight size={18} color={activeEnv === 'test' ? '#0891b2' : '#16a34a'}/>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 3 — Active Environment</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#94a3b8' }}>Select which server is currently in use</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '0.5rem' }}>
          {/* TEST */}
          <div onClick={() => handleEnvSwitch('test')} style={{
            padding: '18px 22px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
            border: activeEnv === 'test' ? '2px solid #0891b2' : '2px solid #e2e8f0',
            background: activeEnv === 'test' ? '#ecfeff' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: activeEnv === 'test' ? '#0891b2' : '#e2e8f0', flexShrink: 0, transition: 'all 0.15s' }}/>
              <span style={{ fontWeight: 700, fontSize: '13px', color: activeEnv === 'test' ? '#0891b2' : '#94a3b8' }}>🧪 TEST</span>
              {activeEnv === 'test' && <span style={{ marginLeft: 'auto', fontSize: '9px', background: '#0891b2', color: '#fff', padding: '2px 7px', borderRadius: '99px', fontWeight: 700 }}>ACTIVE</span>}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginLeft: '20px' }}>{form.sftp_test_host}:{form.sftp_port}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '20px', marginTop: '2px' }}>Pre-production — for testing before go-live</div>
          </div>

          {/* PRODUCTION */}
          <div onClick={() => handleEnvSwitch('production')} style={{
            padding: '18px 22px', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
            border: activeEnv === 'production' ? '2px solid #16a34a' : '2px solid #e2e8f0',
            background: activeEnv === 'production' ? '#f0fdf4' : '#fff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: activeEnv === 'production' ? '#16a34a' : '#e2e8f0', flexShrink: 0, transition: 'all 0.15s' }}/>
              <span style={{ fontWeight: 700, fontSize: '13px', color: activeEnv === 'production' ? '#16a34a' : '#94a3b8' }}>🚀 PRODUCTION</span>
              {activeEnv === 'production' && <span style={{ marginLeft: 'auto', fontSize: '9px', background: '#16a34a', color: '#fff', padding: '2px 7px', borderRadius: '99px', fontWeight: 700 }}>ACTIVE</span>}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', marginLeft: '20px' }}>{form.sftp_prod_host}:{form.sftp_port}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '20px', marginTop: '2px' }}>Live server — for actual AWB transmission</div>
          </div>
        </div>

        <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
          Click to select → then press <strong>Save All Settings</strong> — active environment will be stored in database
        </div>
      </div>

      {/* ── STEP 4: SFTP Credentials ──────────────────────────────────────── */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Key size={16} color="#0369a1"/>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 4 — SFTP Credentials</span>
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 400, textTransform: 'none' }}>(Shared for both Test and Production)</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: isConfigured ? '#166534' : '#92400e' }}>
            {isConfigured ? <CheckCircle size={13} color="#16a34a"/> : <XCircle size={13} color="#d97706"/>}
            {isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}
          </div>
        </div>

        {/* Server hosts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={S.label}>🧪 Test Server Host</label>
            <input name="sftp_test_host" value={form.sftp_test_host} onChange={handleChange}
              style={{ ...S.input, fontFamily: 'monospace', fontSize: '12px',
                borderColor: activeEnv === 'test' ? '#0891b2' : undefined,
                background:  activeEnv === 'test' ? '#ecfeff'  : undefined }}/>
          </div>
          <div>
            <label style={S.label}>🚀 Production Server Host</label>
            <input name="sftp_prod_host" value={form.sftp_prod_host} onChange={handleChange}
              style={{ ...S.input, fontFamily: 'monospace', fontSize: '12px',
                borderColor: activeEnv === 'production' ? '#16a34a' : undefined,
                background:  activeEnv === 'production' ? '#f0fdf4' : undefined }}/>
          </div>
          <div>
            <label style={S.label}>Port</label>
            <input name="sftp_port" value={form.sftp_port} onChange={handleChange}
              type="number" style={{ ...S.input, fontFamily: 'monospace' }}/>
          </div>
        </div>

        {/* Username / Password */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={S.label}>Username * <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}>(provided by Descartes after key registration)</span></label>
            <input name="sftp_username" value={form.sftp_username} onChange={handleChange}
              placeholder="e.g. GLN_YOURCOMPANY" style={{ ...S.input, fontFamily: 'monospace' }}/>
          </div>
          <div>
            <label style={S.label}>Password <span style={{ color: '#94a3b8', textTransform: 'none', fontWeight: 400 }}>(leave blank if using SSH key)</span></label>
            <div style={{ position: 'relative' }}>
              <input name="sftp_password" value={form.sftp_password} onChange={handleChange}
                type={showPassword ? 'text' : 'password'} placeholder="Leave blank to use SSH key"
                style={{ ...S.input, fontFamily: 'monospace', paddingRight: '36px' }}/>
              <span onClick={() => setShowPassword(p => !p)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94a3b8' }}>
                {showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
              </span>
            </div>
          </div>
        </div>

        {/* ── SSH Key Panel ──────────────────────────────────────────────── */}
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px', padding: '18px 20px', marginBottom: '1.25rem' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Key size={15} color="#7c3aed"/>
              <span style={{ fontWeight: 700, fontSize: '13px', color: '#7c3aed' }}>SSH PRIVATE KEY</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>(RSA 4096-bit — shared for both Test and Production)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" onClick={handleDownloadPublicKey} disabled={downloadingPubKey}
                style={S.btn('#15803d', '#fff', { opacity: downloadingPubKey ? 0.6 : 1, cursor: downloadingPubKey ? 'not-allowed' : 'pointer' })}>
                <Download size={13}/> {downloadingPubKey ? 'Deriving...' : 'Download Public Key (.pub)'}
              </button>
              <button type="button" onClick={handleDownloadPrivateKeyBackup} disabled={downloadingBackup}
                style={S.btn('#b45309', '#fff', { opacity: downloadingBackup ? 0.6 : 1, cursor: downloadingBackup ? 'not-allowed' : 'pointer' })}>
                <Download size={13}/> {downloadingBackup ? 'Downloading...' : 'Download Private Key Backup'}
              </button>
              <button type="button" onClick={handleGenerateKeyClick} disabled={generating}
                style={S.btn('#7c3aed', '#fff', { opacity: generating ? 0.6 : 1, cursor: generating ? 'not-allowed' : 'pointer' })}>
                <Key size={13}/> {generating ? 'Generating...' : 'Generate New Key (RSA 4096)'}
              </button>
            </div>
          </div>

          {/* Public key display after generation or download */}
          {generatedKey && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d' }}>
                  📤 PUBLIC KEY — Send this to Descartes to register
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button type="button" onClick={handleCopyPublicKey}
                    style={S.btn(copied ? '#16a34a' : '#2563eb', '#fff', { fontSize: '10px', padding: '3px 8px' })}>
                    <Copy size={11}/> {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button type="button" onClick={() => downloadFile(generatedKey.publicKey, 'descartes_id_rsa.pub')}
                    style={S.btn('#0891b2', '#fff', { fontSize: '10px', padding: '3px 8px' })}>
                    <Download size={11}/> .pub File
                  </button>
                  {generatedKey.privateKeyPem && (
                    <button type="button" onClick={() => downloadFile(generatedKey.privateKeyPem, 'descartes_id_rsa.pem')}
                      style={S.btn('#b45309', '#fff', { fontSize: '10px', padding: '3px 8px' })}>
                      <Download size={11}/> Private Backup
                    </button>
                  )}
                </div>
              </div>
              <textarea readOnly value={generatedKey.publicKey} rows={2}
                style={{ ...S.input, fontFamily: 'monospace', fontSize: '9px', background: '#fff', color: '#14532d', resize: 'none' }}/>
              <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '3px' }}>
                ⚠ Private key has been saved to the database automatically. Download a backup copy for safekeeping.
              </div>
            </div>
          )}

          {/* ── Persistent: SSH key saved in DB indicator (shows on refresh too) ── */}
          {hasKeyInDb && !generatedKey && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '14px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={16} color="#16a34a" style={{ flexShrink: 0 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d' }}>
                  SSH Key is saved in the database
                </div>
                <div style={{ fontSize: '10px', color: '#166534', marginTop: '2px' }}>
                  Use the buttons above to download the Public Key (.pub) to send to Descartes, or backup the Private Key (.pem).
                </div>
              </div>
            </div>
          )}

          {/* Private key paste area */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ ...S.label, textTransform: 'none', marginBottom: '4px', color: '#7c3aed' }}>
              Private Key — paste manually or generate above:
            </label>
            <textarea name="sftp_private_key"
              value={form.sftp_private_key === '***' ? '*** (key saved in database — use Download buttons above)' : form.sftp_private_key}
              onChange={e => { if (!e.target.value.startsWith('***')) handleChange(e); }}
              placeholder={"-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
              rows={5}
              style={{ ...S.input, fontFamily: 'monospace', fontSize: '10px', resize: 'vertical' }}/>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ ...S.label, textTransform: 'none', marginBottom: 0 }}>Passphrase (optional):</label>
              <input name="sftp_passphrase" value={form.sftp_passphrase} onChange={handleChange}
                type="password" placeholder="Only if key is encrypted"
                style={{ ...S.input, width: '200px', padding: '5px 10px', fontSize: '12px' }}/>
            </div>
            <button type="button" onClick={() => setShowInstructions(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {showInstructions ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
              How to generate manually via PowerShell?
            </button>
          </div>

          {showInstructions && (
            <div style={{ marginTop: '8px', background: '#1e293b', color: '#e2e8f0', borderRadius: '5px', padding: '10px 12px', fontSize: '10px', fontFamily: 'monospace', lineHeight: 1.8 }}>
              <span style={{ color: '#94a3b8' }}># Run in PowerShell (press Enter when asked for passphrase to leave blank):</span><br/>
              <span style={{ color: '#86efac' }}>ssh-keygen -t rsa -b 4096 -C "descartes" -f "$env:USERPROFILE\.ssh\descartes_id_rsa"</span><br/>
              <span style={{ color: '#94a3b8' }}># Copy the public key to send to Descartes:</span><br/>
              <span style={{ color: '#86efac' }}>type "$env:USERPROFILE\.ssh\descartes_id_rsa.pub"</span>
            </div>
          )}
        </div>

        {/* Connection status card */}
        <div style={{ padding: '14px 18px', borderRadius: '6px', marginBottom: '16px',
          background: isConfigured ? '#f0fdf4' : hasKeyInDb ? '#eff6ff' : '#fef9c3',
          border: `1px solid ${isConfigured ? '#86efac' : hasKeyInDb ? '#bfdbfe' : '#fde68a'}` }}>
          <div style={{ fontSize: '11px', fontWeight: 700,
            color: isConfigured ? '#166534' : hasKeyInDb ? '#1d4ed8' : '#92400e', marginBottom: '5px' }}>
            {isConfigured
              ? `✅ ${activeEnv.toUpperCase()} — Ready to transmit`
              : hasKeyInDb
                ? '🔑 SSH Key saved — waiting for username from Descartes'
                : '⚠️ Credentials not configured'}
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: 600 }}>
            <span style={{ color: form.sftp_username ? '#15803d' : '#9ca3af' }}>
              {form.sftp_username ? `✅ ${form.sftp_username}` : '❌ Username — awaiting from Descartes'}
            </span>
            <span style={{ color: hasKeyInDb ? '#15803d' : '#9ca3af' }}>
              {hasKeyInDb ? '✅ SSH Key ✓' : '❌ No SSH Key'}
            </span>
            <span style={{ color: '#64748b', fontFamily: 'monospace', fontWeight: 400 }}>
              {activeHost}:{form.sftp_port}
            </span>
          </div>
        </div>

        {/* Test Connection button — right here in Step 4 */}
        <div style={{ marginTop: '12px' }}>
          <button onClick={handleTestSftp} disabled={testing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
              background: testing ? '#e2e8f0' : '#0ea5e9',
              color: testing ? '#64748b' : '#fff',
              border: 'none', cursor: testing ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}>
            <Wifi size={15}/>
            {testing ? 'Testing Connection...' : `Test ${activeEnv.toUpperCase()} Connection`}
          </button>

          {/* Live log panel */}
          {testLog.length > 0 && (
            <div style={{ marginTop: '10px', background: '#0f172a', borderRadius: '8px',
              padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.8' }}>
              <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '6px', fontFamily: 'sans-serif', fontWeight: 600 }}>
                CONNECTION LOG
              </div>
              {testLog.map((log, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ color: '#475569', fontSize: '10px', flexShrink: 0, paddingTop: '1px' }}>{log.time}</span>
                  <span style={{
                    color: log.status === 'success' ? '#4ade80'
                         : log.status === 'error'   ? '#f87171'
                         : log.status === 'done'    ? '#94a3b8'
                         : '#fbbf24', // running = yellow
                  }}>
                    {log.status === 'running' && <span style={{ animation: 'pulse 1s infinite' }}>⟳ </span>}
                    {log.text}
                  </span>
                </div>
              ))}
              {testing && (
                <div style={{ color: '#475569', marginTop: '4px' }}>
                  <span style={{ color: '#fbbf24' }}>⟳</span> Waiting for server response...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Descartes Diagnostics ──────────────────────────────────────────── */}
    </>
  );
}
