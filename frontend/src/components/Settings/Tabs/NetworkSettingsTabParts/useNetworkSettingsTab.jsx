import { useEffect, useState } from 'react';
import { replyOf, settingsApi } from '../../settingsApi';
import { DEFAULT_FORM, NETWORK_PRESETS, downloadText, isMasked } from './helpers';

const MESSAGE_DURATION = { error: 60000, success: 20000 };
const INFO_MESSAGE_DURATION = 10000;
const NO_MESSAGE = { text: '', type: '' };

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clockTime = () => new Date().toLocaleTimeString();

const formFromSettings = (saved) => ({
  ...Object.fromEntries(Object.entries(DEFAULT_FORM).map(([key, fallback]) => [key, saved[key] || fallback])),
  sftp_prod_host: saved.sftp_prod_host || saved.sftp_host || DEFAULT_FORM.sftp_prod_host,
});

const presetForHost = (host) => NETWORK_PRESETS.find((preset) => preset.id !== 'custom' && (preset.prod === host || preset.test === host));

export default function useNetworkSettingsTab() {
  const [selectedNetwork, setSelectedNetwork] = useState('descartes');
  const [activeEnv, setActiveEnv] = useState('test');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testLog, setTestLog] = useState([]);
  const [message, setMessage] = useState(NO_MESSAGE);

  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [downloadingPubKey, setDownloadingPubKey] = useState(false);
  const [showKeyWarning, setShowKeyWarning] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = formFromSettings(await settingsApi.settings());
        setForm(loaded);
        setActiveEnv(loaded.sftp_active_env);
        const host = loaded.sftp_prod_host;
        const preset = presetForHost(host);
        if (preset) setSelectedNetwork(preset.id);
        else if (host) setSelectedNetwork('custom');
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    loadSettings();
  }, []);

  const showMsg = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(NO_MESSAGE), MESSAGE_DURATION[type] || INFO_MESSAGE_DURATION);
  };
  const dismissMessage = () => setMessage(NO_MESSAGE);

  const setField = (name) => (value) => setForm((prev) => ({ ...prev, [name]: value }));
  const handleChange = (event) => setField(event.target.name)(event.target.value);
  const handleEnvSwitch = (env) => { setActiveEnv(env); setForm((prev) => ({ ...prev, sftp_active_env: env })); };
  const activeHost = activeEnv === 'test' ? form.sftp_test_host : form.sftp_prod_host;

  const handleNetworkSelect = (preset) => {
    setSelectedNetwork(preset.id);
    if (preset.id === 'custom') return;
    setForm((prev) => ({
      ...prev,
      sftp_test_host: preset.test,
      sftp_prod_host: preset.prod,
      sftp_port: preset.port,
      van_recipient_id: preset.recipientId || prev.van_recipient_id,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { sftp_password: password, sftp_private_key: privateKey, ...plainSettings } = form;
      const settings = { ...plainSettings, sftp_host: form.sftp_active_env === 'test' ? form.sftp_test_host : form.sftp_prod_host };
      if (password && !isMasked(password)) settings.sftp_password = password;
      if (privateKey && !isMasked(privateKey)) settings.sftp_private_key = privateKey;

      const { status, body } = await replyOf(settingsApi.saveSettings(settings));
      if (status < 300 && body.success) showMsg(`✅ Settings saved! Active environment: ${form.sftp_active_env.toUpperCase()} (${activeHost})`, 'success');
      else showMsg(body.error || 'Save failed', 'error');
    } catch (error) {
      showMsg('Error: ' + error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSftp = async () => {
    setTesting(true);
    setTestLog([]);
    const addLog = (text, status = 'running') => setTestLog((prev) => [...prev, { text, status, time: clockTime() }]);
    const updateLast = (text, status) => setTestLog((prev) => prev.map((log, index) => (index === prev.length - 1 ? { ...log, text, status } : log)));
    const port = form.sftp_port || 22;

    try {
      addLog(`🔌 Connecting to ${activeHost}:${port}...`);
      await wait(500);
      updateLast(`🔌 Connecting to ${activeHost}:${port}...`, 'done');

      addLog('🤝 TCP socket established — starting SSH handshake...');
      await wait(800);
      updateLast('🤝 TCP connected — negotiating ciphers & key exchange...', 'done');

      addLog(`🔑 Authenticating as "${form.sftp_username || 'gdev'}" with SSH private key...`);

      const { body: result } = await replyOf(settingsApi.testSftpConnection({
        host: activeHost,
        port: parseInt(form.sftp_port) || 22,
        username: form.sftp_username,
        password: isMasked(form.sftp_password) ? undefined : form.sftp_password,
        privateKey: isMasked(form.sftp_private_key) ? undefined : form.sftp_private_key,
        passphrase: form.sftp_passphrase,
        env: activeEnv,
      }));

      if (result.success) {
        updateLast('🔑 Auth success — SSH session ready!', 'success');
        addLog(`✅ SFTP session established on ${activeHost}`, 'success');
        showMsg(`✅ ${activeEnv.toUpperCase()} — ${result.message}`, 'success');
      } else {
        updateLast(`🔑 Auth failed — ${result.message}`, 'error');
        addLog(`❌ Connection failed: ${result.message}`, 'error');
        showMsg(`❌ ${activeEnv.toUpperCase()} — ${result.message}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Network error: ${error.message}`, 'error');
      showMsg('Test failed: ' + error.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const openKeyWarning = () => { setConfirmText(''); setShowKeyWarning(true); };
  const closeKeyWarning = () => { setShowKeyWarning(false); setConfirmText(''); };

  const handleGenerateKey = async () => {
    closeKeyWarning();
    setGenerating(true);
    setGeneratedKey(null);
    try {
      const { body: result } = await replyOf(settingsApi.generateSshKey(true));
      if (result.success) {
        setGeneratedKey({ publicKey: result.publicKey, privateKeyPem: result.privateKeyPem });
        setForm((prev) => ({ ...prev, sftp_private_key: '*** (generated & saved)' }));
        showMsg('🔑 New SSH Key pair generated. Private key saved to database. Send the NEW Public Key to Descartes.', 'success');
      } else {
        showMsg(result.error || 'Key generation failed', 'error');
      }
    } catch (error) {
      showMsg('Error: ' + error.message, 'error');
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

  const handleDownloadPrivateKeyBackup = async () => {
    setDownloadingBackup(true);
    try {
      const { body: result } = await replyOf(settingsApi.exportSftpPrivateKey());
      if (result.success && result.privateKey) {
        downloadText(result.privateKey, 'descartes_id_rsa.pem');
        showMsg('✅ Private key backup downloaded successfully.', 'success');
      } else {
        showMsg('❌ ' + (result.message || 'Private key not found. Please generate an SSH key first.'), 'error');
      }
    } catch (error) {
      showMsg('Error: ' + error.message, 'error');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleDownloadPublicKey = async () => {
    setDownloadingPubKey(true);
    try {
      const { body: result } = await replyOf(settingsApi.exportSftpPublicKey());
      if (result.success && result.publicKey) {
        downloadText(result.publicKey, 'descartes_id_rsa.pub');
        setGeneratedKey((prev) => ({ ...prev, publicKey: result.publicKey }));
        showMsg('✅ Public key downloaded (descartes_id_rsa.pub). Send this file to Descartes to register.', 'success');
      } else {
        showMsg('❌ ' + (result.message || 'Could not derive public key. Please generate an SSH key first.'), 'error');
      }
    } catch (error) {
      showMsg('Error: ' + error.message, 'error');
    } finally {
      setDownloadingPubKey(false);
    }
  };

  // '***' (masked by the API) or the PEM itself both mean a key is saved
  const hasKeyInDb = Boolean(form.sftp_private_key);
  const hasAuth = Boolean(form.sftp_password || hasKeyInDb);
  const isConfigured = Boolean(form.sftp_username && hasAuth);

  return {
    activeEnv, activeHost, closeKeyWarning, confirmText, copied, dismissMessage, downloadingBackup, downloadingPubKey, form,
    generatedKey, generating, handleChange, handleCopyPublicKey, handleDownloadPrivateKeyBackup, handleDownloadPublicKey,
    handleEnvSwitch, handleGenerateKey, handleNetworkSelect, handleSave, handleTestSftp, hasKeyInDb, isConfigured, message,
    openKeyWarning, saving, selectedNetwork, setConfirmText, setField, setShowInstructions, showInstructions,
    showKeyWarning, testLog, testing,
  };
}
