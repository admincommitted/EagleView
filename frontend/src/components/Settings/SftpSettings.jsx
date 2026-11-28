import { useEffect, useState } from 'react';
import { Activity, CheckCircle, ChevronDown, ChevronUp, Copy, Download, Info, Key, Save, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@/lib/download';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { replyOf, settingsApi } from './settingsApi';
import SettingsNotice from './SettingsNotice';

const COPIED_FOR_MS = 2000;
const GENERATED_KEY_PLACEHOLDER = '*** (generated & saved)';

const CREDENTIAL_FIELDS = [
  { name: 'sftp_username', label: <>Username <span className="tw:text-red-600">*</span> (given by Descartes)</>, placeholder: 'e.g. GLN_YOURCOMPANY' },
  { name: 'sftp_password', label: 'Password (Optional — Private Key ho to khali chhod dein)', placeholder: 'Leave blank to use Private Key', type: 'password' },
  { name: 'sftp_private_key', label: 'Private Key (PEM format — saved automatically when generated above)', kind: 'textarea',
    placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----' },
  { name: 'sftp_passphrase', label: 'Passphrase (Optional — for Private Key, if one was set)', placeholder: 'Leave blank if no passphrase', type: 'password' },
];

const MANUAL_STEPS = [
  { comment: '# Step 1: Run this command in PowerShell', commands: ['ssh-keygen -t rsa -b 4096 -C "edi-automation-descartes" -f "$env:USERPROFILE\\.ssh\\descartes_id_rsa"'] },
  { comment: '# Step 2: Press Enter for passphrase (leave blank)', commands: ['Enter passphrase: [ENTER]', 'Enter same passphrase again: [ENTER]'] },
  { comment: '# Step 3: Copy the public key', commands: ['type "$env:USERPROFILE\\.ssh\\descartes_id_rsa.pub"'] },
];

const textFile = (text) => new Blob([text], { type: 'text/plain' });

function StepCard({ title, intro, children }) {
  return (
    <div className="tw:mb-6 tw:rounded-lg tw:bg-card tw:p-4 tw:md:p-6">
      <h2 className="tw:mt-0 tw:mb-1 tw:text-lg tw:font-semibold tw:text-slate-800">{title}</h2>
      <p className="tw:mt-0 tw:mb-4 tw:text-[13.5px] tw:text-slate-500">{intro}</p>
      {children}
    </div>
  );
}

function ManualSteps() {
  return (
    <div className="tw:mt-3 tw:overflow-x-auto tw:rounded-lg tw:bg-slate-800 tw:p-4 tw:font-mono tw:text-[13px] tw:leading-[1.7] tw:text-slate-200">
      {MANUAL_STEPS.map((step, index) => (
        <div key={step.comment}>
          <div className={cn('tw:text-slate-400', index === 0 ? 'tw:mb-2' : 'tw:mt-3 tw:mb-1')}>{step.comment}</div>
          {step.commands.map((command) => <div key={command} className="tw:text-green-300">{command}</div>)}
        </div>
      ))}
      <div className="tw:mt-3 tw:text-slate-400">
        # Files generated:<br />
        # descartes_id_rsa      → Private Key (keep with you)<br />
        # descartes_id_rsa.pub  → Public Key  (send to Descartes)
      </div>
    </div>
  );
}

function GeneratedKeyPanel({ generatedKey, copied, onCopy }) {
  return (
    <div className="tw:mt-5 tw:overflow-hidden tw:rounded-lg tw:border tw:border-lime-400">
      <div className="tw:border-b tw:border-emerald-100 tw:bg-green-50 tw:p-4">
        <div className="tw:mb-2 tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
          <span className="tw:text-sm tw:font-semibold tw:text-green-700">📤 PUBLIC KEY — Send to Descartes (Dejin)</span>
          <div className="tw:flex tw:flex-wrap tw:gap-2">
            <Button variant="default" onClick={onCopy}><Copy /> {copied ? 'Copied!' : 'Copy'}</Button>
            <Button onClick={() => downloadBlob(textFile(generatedKey.publicKey), 'descartes_id_rsa.pub')}><Download /> Download .pub</Button>
          </div>
        </div>
        <Textarea readOnly rows={3} className="tw:bg-card tw:font-mono tw:text-xs" value={generatedKey.publicKey} />
        <p className="tw:mt-1.5 tw:mb-0 tw:text-[12.5px] tw:text-gray-500">
          ⬆ Email this file/text to <strong>Dejin</strong> as an attachment → they will create the user account
        </p>
      </div>
      <div className="tw:bg-orange-50 tw:p-4">
        <div className="tw:mb-2 tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:justify-between">
          <span className="tw:text-sm tw:font-semibold tw:text-orange-700">🔒 PRIVATE KEY — Saved to Database</span>
          <Button variant="warning" className="tw:self-start" onClick={() => downloadBlob(textFile(generatedKey.privateKeyPem), 'descartes_id_rsa')}>
            <Download /> Backup (.pem)
          </Button>
        </div>
        <p className="tw:m-0 tw:text-[13px] tw:text-amber-800">
          ⚠ Never share your Private Key. It is used automatically for the SFTP connection.
          Download it for backup and keep it in a safe place.
        </p>
      </div>
    </div>
  );
}

export default function SftpSettings() {
  const [formData, setFormData] = useState({
    sftp_host: 'ftp.myvan.descartes.com',
    sftp_port: '22',
    sftp_username: '',
    sftp_password: '',
    sftp_private_key: '',
    sftp_passphrase: '',
  });
  const [status, setStatus] = useState({ configured: false, loading: true });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const setField = (name, value) => setFormData((current) => ({ ...current, [name]: value }));

  const loadSettings = async () => {
    try {
      const settings = await settingsApi.settings();
      setFormData((current) => ({
        ...current,
        sftp_host: settings.sftp_host || current.sftp_host,
        sftp_port: settings.sftp_port || current.sftp_port,
        sftp_username: settings.sftp_username || '',
        sftp_password: settings.sftp_password || '',
        sftp_private_key: settings.sftp_private_key || '',
        sftp_passphrase: settings.sftp_passphrase || '',
      }));
      const configured = Boolean(settings.sftp_username && (settings.sftp_password || settings.sftp_private_key));
      setStatus({ configured, loading: false });
    } catch (error) {
      console.error('Failed to fetch settings', error);
      setStatus((current) => ({ ...current, loading: false }));
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!formData.sftp_host || !formData.sftp_port) {
      setMessage({ text: `Please fill in ${formData.sftp_host ? 'Port' : 'SFTP Host'}.`, type: 'error' });
      return;
    }
    setSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const { status: httpStatus, body } = await replyOf(settingsApi.saveSettings(formData));
      if (httpStatus < 400 && body.success) {
        setMessage({ text: '✅ Settings saved successfully!', type: 'success' });
        loadSettings();
      } else {
        setMessage({ text: body.error || 'Failed to save settings', type: 'error' });
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
      const { body } = await replyOf(settingsApi.testSftp());
      setMessage(body.success
        ? { text: `✅ ${body.message || 'Connection successful!'}`, type: 'success' }
        : { text: `❌ ${body.message || 'Connection failed'}`, type: 'error' });
      setStatus((current) => ({ ...current, configured: Boolean(body.success) }));
    } catch {
      setMessage({ text: 'Error testing connection', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateKey = async () => {
    setGenerating(true);
    setMessage({ text: '', type: '' });
    setGeneratedKey(null);
    try {
      const { body } = await replyOf(settingsApi.generateSshKey(true));
      if (body.success) {
        setGeneratedKey({ publicKey: body.publicKey, privateKeyPem: body.privateKeyPem });
        setField('sftp_private_key', GENERATED_KEY_PLACEHOLDER);
        setMessage({ text: '🔑 SSH Key generated & private key saved to database!', type: 'success' });
      } else {
        setMessage({ text: body.error || 'Key generation failed', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Error generating SSH key', type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyPublicKey = () => {
    navigator.clipboard.writeText(generatedKey.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_FOR_MS);
  };

  return (
    <div className="tw:mx-auto tw:min-h-screen tw:max-w-[860px] tw:bg-(--bg-app) tw:p-4 tw:md:p-8">
      <div className="tw:mb-6 tw:flex tw:flex-col tw:gap-3 tw:md:flex-row tw:md:items-center tw:md:justify-between">
        <h1 className="tw:m-0 tw:text-2xl tw:font-bold tw:text-foreground tw:md:text-[28px]">SFTP Settings — Descartes myVAN</h1>
        {!status.loading && (
          <div className={cn(
            'tw:flex tw:items-center tw:gap-2 tw:self-start tw:rounded-full tw:px-4 tw:py-1.5 tw:text-sm tw:font-medium tw:md:self-auto',
            status.configured ? 'tw:bg-success/10 tw:text-success' : 'tw:bg-destructive/10 tw:text-destructive'
          )}>
            {status.configured ? <CheckCircle className="tw:size-4" /> : <XCircle className="tw:size-4" />}
            {status.configured ? 'Configured' : 'Not Configured'}
          </div>
        )}
      </div>

      {message.text && <SettingsNotice tone={message.type} className="tw:mb-5 tw:text-sm tw:font-normal">{message.text}</SettingsNotice>}

      <StepCard
        title="🔑 Step 1 — Generate SSH Key Pair"
        intro={<>
          To connect with the Descartes SFTP server, an SSH Public Key is required.
          Click the button below — the Private Key will be saved automatically, and you can copy/download the Public Key
          and email it to <strong>Dejin (Descartes)</strong>.
        </>}
      >
        <Button size="lg" className="tw:h-auto tw:min-h-8 tw:whitespace-normal tw:border-violet-600 tw:bg-violet-600 tw:text-white tw:hover:bg-violet-700"
          disabled={generating} onClick={handleGenerateKey}>
          <Key className="tw:size-[18px]" />
          {generating ? 'Generating...' : 'Generate New SSH Key Pair (RSA 4096-bit)'}
        </Button>

        {generatedKey && <GeneratedKeyPanel generatedKey={generatedKey} copied={copied} onCopy={handleCopyPublicKey} />}

        <div className="tw:mt-4">
          <Button variant="link" className="tw:h-auto tw:text-[13.5px]" onClick={() => setShowInstructions((shown) => !shown)}>
            <Info /> {showInstructions ? 'Hide Instructions' : 'How to do manual steps? (via PowerShell)'}
            {showInstructions ? <ChevronUp /> : <ChevronDown />}
          </Button>
          {showInstructions && <ManualSteps />}
        </div>
      </StepCard>

      <StepCard
        title="⚙️ Step 2 — SFTP Credentials (fill in after Descartes sends them)"
        intro="Enter the username below once Descartes sends it. If you generated the private key above, it is already saved."
      >
        <form onSubmit={handleSave} className="tw:flex tw:flex-col tw:gap-5">
          <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-[1fr_120px]">
            <Field label="SFTP Host" layout="col">
              <Input required data-allow-text="" className="tw:h-9" value={formData.sftp_host} onChange={(event) => setField('sftp_host', event.target.value)} />
            </Field>
            <Field label="Port" layout="col">
              <Input required type="number" className="tw:h-9" value={formData.sftp_port} onChange={(event) => setField('sftp_port', event.target.value)} />
            </Field>
          </div>

          {CREDENTIAL_FIELDS.map((field) => (
            <Field key={field.name} label={field.label} layout="col" labelClassName="tw:whitespace-normal">
              {field.kind === 'textarea' ? (
                <Textarea className="tw:min-h-[120px] tw:font-mono tw:text-[13px]" value={formData[field.name]} placeholder={field.placeholder}
                  onChange={(event) => setField(field.name, event.target.value)} />
              ) : (
                <Input type={field.type} data-allow-text="" className="tw:h-9" value={formData[field.name]} placeholder={field.placeholder}
                  onChange={(event) => setField(field.name, event.target.value)} />
              )}
            </Field>
          ))}

          <div className="tw:rounded-md tw:border tw:border-blue-200 tw:bg-blue-50 tw:p-3.5 tw:text-[13px] tw:text-blue-800">
            <strong>ℹ️ Connection Details:</strong>
            <ul className="tw:mt-1.5 tw:mb-0 tw:pl-5 tw:leading-[1.8]">
              <li><strong>Test Server:</strong> wwwtest.myvan.descartes.com:22</li>
              <li><strong>Production:</strong> ftp.myvan.descartes.com:22</li>
              <li>No public IP needed — with SSH key authentication any internet connection works</li>
              <li>Max 4 parallel sessions allowed (Descartes policy)</li>
            </ul>
          </div>

          <div className="tw:flex tw:flex-wrap tw:gap-3">
            <Button type="submit" variant="default" size="lg" disabled={saving}><Save className="tw:size-4" /> {saving ? 'Saving...' : 'Save Settings'}</Button>
            <Button size="lg" className="tw:border-slate-300 tw:bg-slate-900 tw:text-slate-50 tw:hover:bg-slate-800" disabled={testing} onClick={handleTestConnection}>
              <Activity className="tw:size-4" /> {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </div>
        </form>
      </StepCard>
    </div>
  );
}
