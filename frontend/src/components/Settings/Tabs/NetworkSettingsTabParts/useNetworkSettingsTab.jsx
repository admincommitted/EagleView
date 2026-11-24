// State and logic
// Split out of NetworkSettingsTab.jsx (28-Oct-2026). Code moved as-is; only the wiring (imports / ctx) is new.
import React, { useEffect, useState } from 'react';
import { NETWORK_PRESETS } from './helpers';

export default function useNetworkSettingsTab(ctx) {
  const [selectedNetwork, setSelectedNetwork] = useState('descartes');
  const [activeEnv, setActiveEnv]             = useState('test');
  const [showPassword, setShowPassword]       = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [testing, setTesting]                 = useState(false);
  const [testLog, setTestLog]                 = useState([]); // live progress steps
  const [message, setMessage]                 = useState({ text: '', type: '' });

  // SSH key generation
  const [generating, setGenerating]             = useState(false);
  const [generatedKey, setGeneratedKey]         = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied]                     = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [downloadingPubKey, setDownloadingPubKey] = useState(false);

  // Main form — one set of credentials + shared SSH key
  const [form, setForm] = useState({
    sftp_test_host:      'ftptest.myvan.descartes.com',
    sftp_prod_host:      'ftp.myvan.descartes.com',
    sftp_port:           '22',
    sftp_active_env:     'test',
    sftp_username:       '',
    sftp_password:       '',
    sftp_private_key:    '',
    sftp_passphrase:     '',
    van_recipient_id:    'TDVAIR01GLNDTCR',
      van_sender_pima:     '',
    company_name:        '',
    default_currency:    'USD',
    default_charge_code: 'PP',
  });

  // ── Load settings from DB ─────────────────────────────────────────────────
  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const d = await res.json();
      const loaded = {
        sftp_test_host:      d.sftp_test_host      || 'ftptest.myvan.descartes.com',
        sftp_prod_host:      d.sftp_prod_host       || d.sftp_host || 'ftp.myvan.descartes.com',
        sftp_port:           d.sftp_port            || '22',
        sftp_active_env:     d.sftp_active_env      || 'test',
        sftp_username:       d.sftp_username        || '',
        sftp_password:       d.sftp_password        || '',
        sftp_private_key:    d.sftp_private_key     || '',
        sftp_passphrase:     d.sftp_passphrase      || '',
        van_recipient_id:    d.van_recipient_id     || 'TDVAIR01GLNDTCR',
          van_sender_pima:     d.van_sender_pima      || '',
        company_name:        d.company_name         || '',
        default_currency:    d.default_currency     || 'USD',
        default_charge_code: d.default_charge_code  || 'PP',
      };
      setForm(loaded);
      setActiveEnv(loaded.sftp_active_env);
      const host  = loaded.sftp_prod_host;
      const match = NETWORK_PRESETS.find(p => p.id !== 'custom' && (p.prod === host || p.test === host));
      if (match) setSelectedNetwork(match.id);
      else if (host) setSelectedNetwork('custom');
    } catch (err) { console.error('Failed to fetch settings:', err); }
  };

  const handleChange   = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleEnvSwitch = (env) => { setActiveEnv(env); setForm(prev => ({ ...prev, sftp_active_env: env })); };
  const activeHost     = activeEnv === 'test' ? form.sftp_test_host : form.sftp_prod_host;

  const handleNetworkSelect = (preset) => {
    setSelectedNetwork(preset.id);
    if (preset.id !== 'custom') {
      setForm(prev => ({
        ...prev,
        sftp_test_host:   preset.test,
        sftp_prod_host:   preset.prod,
        sftp_port:        preset.port,
        van_recipient_id: preset.recipientId || prev.van_recipient_id,
      }));
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const settings = {
        sftp_test_host:      form.sftp_test_host,
        sftp_prod_host:      form.sftp_prod_host,
        sftp_port:           form.sftp_port,
        sftp_active_env:     form.sftp_active_env,
        sftp_username:       form.sftp_username,
        sftp_passphrase:     form.sftp_passphrase,
        van_recipient_id:    form.van_recipient_id,
          van_sender_pima:     form.van_sender_pima,
        company_name:        form.company_name,
        default_currency:    form.default_currency,
        default_charge_code: form.default_charge_code,
        sftp_host: form.sftp_active_env === 'test' ? form.sftp_test_host : form.sftp_prod_host,
      };
      if (form.sftp_password    && form.sftp_password    !== '***') settings.sftp_password    = form.sftp_password;
      if (form.sftp_private_key && form.sftp_private_key !== '***') settings.sftp_private_key = form.sftp_private_key;

      const res  = await fetch('/api/settings/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) });
      const data = await res.json();
      if (res.ok && data.success) showMsg(`✅ Settings saved! Active environment: ${form.sftp_active_env.toUpperCase()} (${activeHost})`, 'success');
      else showMsg(data.error || 'Save failed', 'error');
    } catch (err) { showMsg('Error: ' + err.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Test SFTP ─────────────────────────────────────────────────────────────
  const handleTestSftp = async () => {
    setTesting(true);
    setTestLog([]);

    const addLog = (text, status = 'running') =>
      setTestLog(prev => [...prev, { text, status, time: new Date().toLocaleTimeString() }]);

    const updateLast = (text, status) =>
      setTestLog(prev => prev.map((l, i) => i === prev.length - 1 ? { ...l, text, status } : l));

    try {
      addLog(`🔌 Connecting to ${activeHost}:${form.sftp_port || 22}...`);
      await new Promise(r => setTimeout(r, 500));
      updateLast(`🔌 Connecting to ${activeHost}:${form.sftp_port || 22}...`, 'done');

      addLog('🤝 TCP socket established — starting SSH handshake...');
      await new Promise(r => setTimeout(r, 800));
      updateLast('🤝 TCP connected — negotiating ciphers & key exchange...', 'done');

      addLog(`🔑 Authenticating as "${form.sftp_username || 'gdev'}" with SSH private key...`);

      const res  = await fetch('/api/settings/test-sftp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: activeHost, port: parseInt(form.sftp_port) || 22,
          username:   form.sftp_username,
          password:   form.sftp_password    !== '***' ? form.sftp_password    : undefined,
          privateKey: form.sftp_private_key !== '***' ? form.sftp_private_key : undefined,
          passphrase: form.sftp_passphrase,
          env:        activeEnv,
        }),
      });
      const data = await res.json();

      if (data.success) {
        updateLast(`🔑 Auth success — SSH session ready!`, 'success');
        addLog(`✅ SFTP session established on ${activeHost}`, 'success');
        showMsg(`✅ ${activeEnv.toUpperCase()} — ${data.message}`, 'success');
      } else {
        updateLast(`🔑 Auth failed — ${data.message}`, 'error');
        addLog(`❌ Connection failed: ${data.message}`, 'error');
        showMsg(`❌ ${activeEnv.toUpperCase()} — ${data.message}`, 'error');
      }
    } catch (err) {
      setTestLog(prev => [...prev, { text: `❌ Network error: ${err.message}`, status: 'error', time: new Date().toLocaleTimeString() }]);
      showMsg('Test failed: ' + err.message, 'error');
    }
    finally { setTesting(false); }
  };

  // ── SSH Key Generation ────────────────────────────────────────────────────
  // ── Warning modal before generating a new key ─────────────────────────────
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [confirmText, setConfirmText]       = useState('');

  // Step 1: button click → show warning modal
  const handleGenerateKeyClick = () => {
    setConfirmText('');
    setShowKeyWarning(true);
  };

  // Step 2: user confirms → actually generate
  const handleGenerateKey = async () => {
    setShowKeyWarning(false);
    setConfirmText('');
    setGenerating(true); setGeneratedKey(null);
    try {
      const res  = await fetch('/api/settings/generate-ssh-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saveToDb: true }) });
      const data = await res.json();
      if (data.success) {
        setGeneratedKey({ publicKey: data.publicKey, privateKeyPem: data.privateKeyPem });
        setForm(prev => ({ ...prev, sftp_private_key: '*** (generated & saved)' }));
        showMsg('🔑 New SSH Key pair generated. Private key saved to database. Send the NEW Public Key to Descartes.', 'success');
      } else showMsg(data.error || 'Key generation failed', 'error');
    } catch (err) { showMsg('Error: ' + err.message, 'error'); }
    finally { setGenerating(false); }
  };

  const handleCopyPublicKey = () => {
    if (!generatedKey?.publicKey) return;
    navigator.clipboard.writeText(generatedKey.publicKey);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = (content, name) => {
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([content], { type: 'text/plain' })), download: name,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const handleDownloadPrivateKeyBackup = async () => {
    setDownloadingBackup(true);
    try {
      const res  = await fetch('/api/settings/export-private-key', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.privateKey) {
        downloadFile(data.privateKey, 'descartes_id_rsa.pem');
        showMsg('✅ Private key backup downloaded successfully.', 'success');
      } else {
        showMsg('❌ ' + (data.message || 'Private key not found. Please generate an SSH key first.'), 'error');
      }
    } catch (err) { showMsg('Error: ' + err.message, 'error'); }
    finally { setDownloadingBackup(false); }
  };

  const handleDownloadPublicKey = async () => {
    setDownloadingPubKey(true);
    try {
      const res  = await fetch('/api/settings/export-public-key', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.publicKey) {
        downloadFile(data.publicKey, 'descartes_id_rsa.pub');
        setGeneratedKey(prev => ({ ...(prev || {}), publicKey: data.publicKey }));
        showMsg('✅ Public key downloaded (descartes_id_rsa.pub). Send this file to Descartes to register.', 'success');
      } else {
        showMsg('❌ ' + (data.message || 'Could not derive public key. Please generate an SSH key first.'), 'error');
      }
    } catch (err) { showMsg('Error: ' + err.message, 'error'); }
    finally { setDownloadingPubKey(false); }
  };

  const showMsg = (text, type) => {
    setMessage({ text, type });
    // Error: 60s, Success: 20s, Info: 10s — user can also dismiss with ✕
    const duration = type === 'error' ? 60000 : type === 'success' ? 20000 : 10000;
    setTimeout(() => setMessage({ text: '', type: '' }), duration);
  };

  // Key is in DB if value is '***' (masked by API) or actual PEM content
  const hasKeyInDb   = !!(form.sftp_private_key && form.sftp_private_key !== '');
  const hasAuth      = !!(form.sftp_password || hasKeyInDb);
  const isConfigured = !!(form.sftp_username && hasAuth);

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    label:   { display: 'block', fontSize: '12px', color: 'var(--text-muted,#64748b)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' },
    input:   { width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color,#cbd5e1)', fontSize: '13px', background: 'var(--bg-input,#f8fafc)', color: 'var(--text-main,#0f172a)', boxSizing: 'border-box' },
    section: { background: 'var(--bg-app,#f8fafc)', borderRadius: '12px', padding: '1.75rem', border: '1px solid var(--border-color,#e2e8f0)', marginBottom: '1.5rem' },
    btn:     (bg, fg = '#fff', extra = {}) => ({ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '7px', border: 'none', background: bg, color: fg, cursor: 'pointer', fontSize: '12px', fontWeight: 600, ...extra }),
  };
  return { S, activeEnv, activeHost, confirmText, copied, downloadFile, downloadingBackup, downloadingPubKey, fetchSettings, form, generatedKey, generating, handleChange, handleCopyPublicKey, handleDownloadPrivateKeyBackup, handleDownloadPublicKey, handleEnvSwitch, handleGenerateKey, handleGenerateKeyClick, handleNetworkSelect, handleSave, handleTestSftp, hasAuth, hasKeyInDb, isConfigured, message, saving, selectedNetwork, setActiveEnv, setConfirmText, setCopied, setDownloadingBackup, setDownloadingPubKey, setForm, setGeneratedKey, setGenerating, setMessage, setSaving, setSelectedNetwork, setShowInstructions, setShowKeyWarning, setShowPassword, setTestLog, setTesting, showInstructions, showKeyWarning, showMsg, showPassword, testLog, testing };
}
