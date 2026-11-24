import React, { useState, useEffect } from 'react';
import { Save, Activity, CheckCircle, XCircle, Key, Copy, Download, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function SftpSettings() {
  const [formData, setFormData] = useState({
    sftp_host: 'ftp.myvan.descartes.com',
    sftp_port: '22',
    sftp_username: '',
    sftp_password: '',
    sftp_private_key: '',
    sftp_passphrase: ''
  });

  const [status, setStatus]         = useState({ configured: false, loading: true });
  const [message, setMessage]       = useState({ text: '', type: '' });
  const [testing, setTesting]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);   // { publicKey, privateKeyPem }
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied]         = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          sftp_host:        data.sftp_host        || prev.sftp_host,
          sftp_port:        data.sftp_port        || prev.sftp_port,
          sftp_username:    data.sftp_username    || '',
          sftp_password:    data.sftp_password    || '',
          sftp_private_key: data.sftp_private_key || '',
          sftp_passphrase:  data.sftp_passphrase  || ''
        }));
        const configured = !!(data.sftp_username && (data.sftp_password || data.sftp_private_key));
        setStatus({ configured, loading: false });
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
      setStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/settings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: formData })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ text: '✅ Settings saved successfully!', type: 'success' });
        fetchSettings();
      } else {
        setMessage({ text: data.error || 'Failed to save settings', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage({ text: 'Testing connection...', type: 'info' });
    try {
      const res = await fetch('/api/settings/test-sftp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `✅ ${data.message || 'Connection successful!'}`, type: 'success' });
        setStatus(prev => ({ ...prev, configured: true }));
      } else {
        setMessage({ text: `❌ ${data.message || 'Connection failed'}`, type: 'error' });
        setStatus(prev => ({ ...prev, configured: false }));
      }
    } catch {
      setMessage({ text: 'Error testing connection', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  // ── SSH Key Generation ──────────────────────────────────────────────────────
  const handleGenerateKey = async () => {
    setGenerating(true);
    setMessage({ text: '', type: '' });
    setGeneratedKey(null);
    try {
      const res = await fetch('/api/settings/generate-ssh-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saveToDb: true })  // auto-save private key to DB
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedKey({ publicKey: data.publicKey, privateKeyPem: data.privateKeyPem });
        // Also update the form field to show it's saved
        setFormData(prev => ({ ...prev, sftp_private_key: '*** (generated & saved)' }));
        setMessage({ text: '🔑 SSH Key generated & private key saved to database!', type: 'success' });
      } else {
        setMessage({ text: data.error || 'Key generation failed', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error generating SSH key', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPublicKey = () => {
    if (!generatedKey?.publicKey) return;
    navigator.clipboard.writeText(generatedKey.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPublicKey = () => {
    if (!generatedKey?.publicKey) return;
    const blob = new Blob([generatedKey.publicKey], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'descartes_id_rsa.pub';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPrivateKey = () => {
    if (!generatedKey?.privateKeyPem) return;
    const blob = new Blob([generatedKey.privateKeyPem], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'descartes_id_rsa';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card = {
    background: 'white', borderRadius: '0.5rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '1.5rem'
  };
  const label = {
    fontWeight: '500', color: 'var(--text-muted, #475569)', fontSize: '0.875rem',
    display: 'block', marginBottom: '0.375rem'
  };
  const inputStyle = {
    width: '100%', padding: '0.75rem', borderRadius: '0.375rem',
    border: '1px solid var(--border-color, #cbd5e1)', outline: 'none',
    fontSize: '0.875rem', boxSizing: 'border-box'
  };
  const btn = (bg, color = 'white') => ({
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: bg, color, padding: '0.65rem 1.25rem',
    borderRadius: '0.375rem', border: 'none', fontWeight: '500',
    cursor: 'pointer', fontSize: '0.875rem'
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '860px', margin: '0 auto', background: 'var(--bg-app, #f8fafc)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-main, #1e293b)', margin: 0 }}>
          SFTP Settings — Descartes myVAN
        </h1>
        {!status.loading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 1rem', borderRadius: '9999px',
            background: status.configured ? '#dcfce7' : '#fee2e2',
            color: status.configured ? '#166534' : '#991b1b', fontWeight: '500', fontSize: '0.875rem'
          }}>
            {status.configured ? <CheckCircle size={16}/> : <XCircle size={16}/>}
            {status.configured ? 'Configured' : 'Not Configured'}
          </div>
        )}
      </div>

      {/* Global message */}
      {message.text && (
        <div style={{
          padding: '0.875rem 1rem', marginBottom: '1.25rem', borderRadius: '0.375rem', fontSize: '0.9rem',
          background: message.type === 'success' ? '#dcfce7' : message.type === 'error' ? '#fee2e2' : '#e0f2fe',
          color:      message.type === 'success' ? '#166534' : message.type === 'error' ? '#991b1b' : '#075985'
        }}>
          {message.text}
        </div>
      )}

      {/* ── STEP 1: SSH Key Generation ───────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.25rem 0' }}>
          🔑 Step 1 — Generate SSH Key Pair
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1rem 0' }}>
          To connect with the Descartes SFTP server, an SSH Public Key is required.
          Click the button below — the Private Key will be saved automatically, and you can copy/download the Public Key
          and email it to <strong>Dejin (Descartes)</strong>.
        </p>

        <button
          type="button"
          onClick={handleGenerateKey}
          disabled={generating}
          style={{ ...btn('#7c3aed'), opacity: generating ? 0.7 : 1, cursor: generating ? 'not-allowed' : 'pointer' }}
        >
          <Key size={18}/>
          {generating ? 'Generating...' : 'Generate New SSH Key Pair (RSA 4096-bit)'}
        </button>

        {/* Generated Key Display */}
        {generatedKey && (
          <div style={{ marginTop: '1.25rem', border: '1px solid #a3e635', borderRadius: '0.5rem', overflow: 'hidden' }}>
            {/* Public Key — send to Descartes */}
            <div style={{ background: '#f0fdf4', padding: '1rem', borderBottom: '1px solid #d1fae5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: '600', color: '#15803d', fontSize: '0.9rem' }}>
                  📤 PUBLIC KEY — Send to Descartes (Dejin)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={handleCopyPublicKey} style={{ ...btn(copied ? '#16a34a' : '#2563eb'), fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                    <Copy size={14}/> {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button type="button" onClick={handleDownloadPublicKey} style={{ ...btn('#0891b2'), fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                    <Download size={14}/> Download .pub
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={generatedKey.publicKey}
                rows={3}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.75rem', background: '#fff', resize: 'vertical' }}
              />
              <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '0.4rem 0 0 0' }}>
                ⬆ Email this file/text to <strong>Dejin</strong> as an attachment → they will create the user account
              </p>
            </div>

            {/* Private Key — saved to DB */}
            <div style={{ background: '#fff7ed', padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: '600', color: '#c2410c', fontSize: '0.9rem' }}>
                  🔒 PRIVATE KEY — Saved to Database
                </span>
                <button type="button" onClick={handleDownloadPrivateKey} style={{ ...btn('#b45309'), fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}>
                  <Download size={14}/> Backup (.pem)
                </button>
              </div>
              <p style={{ color: '#92400e', fontSize: '0.8rem', margin: 0 }}>
                ⚠ Never share your Private Key. It is used automatically for the SFTP connection.
                Download it for backup and keep it in a safe place.
              </p>
            </div>
          </div>
        )}

        {/* Instructions toggle */}
        <div style={{ marginTop: '1rem' }}>
          <button
            type="button"
            onClick={() => setShowInstructions(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0 }}
          >
            <Info size={15}/>
            {showInstructions ? 'Hide Instructions' : 'How to do manual steps? (via PowerShell)'}
            {showInstructions ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>

          {showInstructions && (
            <div style={{ marginTop: '0.75rem', background: '#1e293b', color: '#e2e8f0', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.82rem', fontFamily: 'monospace', lineHeight: 1.7 }}>
              <div style={{ color: '#94a3b8', marginBottom: '0.5rem' }}># Step 1: Run this command in PowerShell</div>
              <div style={{ color: '#86efac' }}>ssh-keygen -t rsa -b 4096 -C "edi-automation-descartes" -f "$env:USERPROFILE\.ssh\descartes_id_rsa"</div>
              <div style={{ color: '#94a3b8', marginTop: '0.75rem', marginBottom: '0.25rem' }}># Step 2: Press Enter for passphrase (leave blank)</div>
              <div style={{ color: '#86efac' }}>Enter passphrase: [ENTER]</div>
              <div style={{ color: '#86efac' }}>Enter same passphrase again: [ENTER]</div>
              <div style={{ color: '#94a3b8', marginTop: '0.75rem', marginBottom: '0.25rem' }}># Step 3: Copy the public key</div>
              <div style={{ color: '#86efac' }}>type "$env:USERPROFILE\.ssh\descartes_id_rsa.pub"</div>
              <div style={{ color: '#94a3b8', marginTop: '0.75rem' }}>
                # Files generated:<br/>
                # descartes_id_rsa      → Private Key (keep with you)<br/>
                # descartes_id_rsa.pub  → Public Key  (send to Descartes)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── STEP 2: SFTP Credentials ─────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e293b', margin: '0 0 0.25rem 0' }}>
          ⚙️ Step 2 — SFTP Credentials (fill in after Descartes sends them)
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
          Enter the username below once Descartes sends it. If you generated the private key above, it is already saved.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '1rem' }}>
            <div>
              <label style={label}>SFTP Host</label>
              <input type="text" name="sftp_host" value={formData.sftp_host} onChange={handleChange} style={inputStyle} required/>
            </div>
            <div>
              <label style={label}>Port</label>
              <input type="number" name="sftp_port" value={formData.sftp_port} onChange={handleChange} style={inputStyle} required/>
            </div>
          </div>

          <div>
            <label style={label}>Username <span style={{ color: '#dc2626' }}>*</span> (given by Descartes)</label>
            <input type="text" name="sftp_username" value={formData.sftp_username} onChange={handleChange} style={inputStyle} placeholder="e.g. GLN_YOURCOMPANY"/>
          </div>

          <div>
            <label style={label}>Password (Optional — Private Key ho to khali chhod dein)</label>
            <input type="password" name="sftp_password" value={formData.sftp_password} onChange={handleChange} style={inputStyle} placeholder="Leave blank to use Private Key"/>
          </div>

          <div>
            <label style={label}>Private Key (PEM format — saved automatically when generated above)</label>
            <textarea
              name="sftp_private_key"
              value={formData.sftp_private_key}
              onChange={handleChange}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              style={{ ...inputStyle, minHeight: '120px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={label}>Passphrase (Optional — for Private Key, if one was set)</label>
            <input type="password" name="sftp_passphrase" value={formData.sftp_passphrase} onChange={handleChange} style={inputStyle} placeholder="Leave blank if no passphrase"/>
          </div>

          {/* Info box */}
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.375rem', padding: '0.875rem', fontSize: '0.82rem', color: '#1e40af' }}>
            <strong>ℹ️ Connection Details:</strong>
            <ul style={{ margin: '0.4rem 0 0 0', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
              <li><strong>Test Server:</strong> wwwtest.myvan.descartes.com:22</li>
              <li><strong>Production:</strong> ftp.myvan.descartes.com:22</li>
              <li>No public IP needed — with SSH key authentication any internet connection works</li>
              <li>Max 4 parallel sessions allowed (Descartes policy)</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" disabled={saving}
              style={{ ...btn('#2563eb'), opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Save size={16}/> {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button type="button" onClick={handleTestConnection} disabled={testing}
              style={{ ...btn('#0f172a', '#f8fafc'), border: '1px solid #cbd5e1', opacity: testing ? 0.7 : 1, cursor: testing ? 'not-allowed' : 'pointer' }}>
              <Activity size={16}/> {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
