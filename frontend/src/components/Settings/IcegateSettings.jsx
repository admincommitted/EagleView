import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { Badge, Button, Field, Input, Textarea } from '@/components/ui';
import { replyOf, settingsApi } from './settingsApi';
import SettingsNotice from './SettingsNotice';

const DEFAULT_BASE_URL = 'https://cisapi.icegate.gov.in';
// GET /settings never returns the saved password, only this mask
const SAVED_PASSWORD_MASK = '***';

const ENDPOINTS = [
  { label: 'Auth', path: '/authentication/v1.0/api/authenticate' },
  { label: 'File Submit', path: '/jsonfiling/v1.0/api/fileSubmit' },
  { label: 'File Status', path: '/jsonfiling/v1.0/api/fileStatus' },
];

function authFailureText(reply) {
  const errors = reply.details?.errors || [];
  const details = errors.join(', ') || reply.details?.message || '';
  const hint = errors.some((error) => error.includes('API Key'))
    ? ' ⚠️ ICEGATE API Key needs to be activated on the ICEGATE portal first (Settings > API Key Activation).'
    : '';
  return `Auth Failed: ${reply.error}${details ? ` → ${details}` : ''}${hint}`;
}

export default function IcegateSettings() {
  const [form, setForm] = useState({
    icegate_login_id: '',
    icegate_password: '',
    icegate_api_key: '',
    icegate_base_url: DEFAULT_BASE_URL,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [tokenInfo, setTokenInfo] = useState(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const setField = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { body } = await replyOf(settingsApi.settings());
        setForm((current) => ({
          ...current,
          icegate_login_id: body.icegate_login_id || '',
          icegate_password: '',
          icegate_api_key: body.icegate_api_key || '',
          icegate_base_url: body.icegate_base_url || DEFAULT_BASE_URL,
        }));
        if (body.icegate_password === SAVED_PASSWORD_MASK) setPasswordSaved(true);
      } catch (error) {
        console.error(error);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });
    const settings = {
      icegate_login_id: form.icegate_login_id,
      icegate_api_key: form.icegate_api_key,
      icegate_base_url: form.icegate_base_url,
    };
    if (form.icegate_password) settings.icegate_password = form.icegate_password;
    try {
      const { body } = await replyOf(settingsApi.saveSettings(settings));
      setMessage(body.success
        ? { text: 'ICEGATE settings saved successfully!', type: 'success' }
        : { text: `Save failed: ${body.error || 'Unknown error'}`, type: 'error' });
    } catch (error) {
      setMessage({ text: `Network error: ${error.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage({ text: '', type: '' });
    setTokenInfo(null);
    try {
      const { body } = await replyOf(settingsApi.testIcegateAuth());
      if (body.success) {
        setMessage({ text: 'ICEGATE Authentication Successful!', type: 'success' });
        setTokenInfo(body);
      } else {
        setMessage({ text: authFailureText(body), type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Network Error: ${error.message}`, type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="tw:max-w-[720px]">
      <div className="tw:mb-5 tw:flex tw:flex-wrap tw:items-center tw:gap-2.5 tw:rounded-lg tw:bg-linear-135 tw:from-blue-900 tw:to-blue-700 tw:px-4 tw:py-3 tw:text-white">
        <Shield className="tw:size-[22px]" />
        <div>
          <div className="tw:text-[15px] tw:font-bold">ICEGATE API Configuration</div>
          <div className="tw:text-[11px] tw:opacity-85">Customs Integrated System — BE/SB JSON Filing</div>
        </div>
        <div className="tw:ml-auto tw:rounded-xl tw:bg-white/15 tw:px-2.5 tw:py-1 tw:text-[11px]">CBIC · India Customs</div>
      </div>

      <div className="tw:mb-5 tw:rounded-md tw:border tw:border-black tw:bg-sky-50 tw:p-3 tw:text-[11px] tw:text-(--primary-text)">
        <div className="tw:mb-1.5 tw:font-bold">ICEGATE API Endpoints</div>
        <div className="tw:flex tw:flex-col tw:gap-1 tw:break-all tw:font-mono">
          {ENDPOINTS.map((endpoint) => (
            <span key={endpoint.label}><strong>{endpoint.label}:</strong> {endpoint.path}</span>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="tw:flex tw:flex-col tw:gap-4">
        <Field label="ICEGATE Login ID" layout="col" note="Your registered ICEGATE user ID">
          <Input className="tw:font-mono" data-allow-text="" autoComplete="off" value={form.icegate_login_id} placeholder="e.g. CCCPL1998" onChange={setField('icegate_login_id')} />
        </Field>

        <Field
          label={<>ICEGATE Password {passwordSaved && <Badge variant="success" className="tw:ml-2">✓ Saved</Badge>}</>}
          layout="col"
          note={passwordSaved && !form.icegate_password && <span className="tw:text-emerald-600">Password is already saved. Enter new password only if you want to change it.</span>}
        >
          <Input
            type="password"
            className="tw:font-mono"
            autoComplete="new-password"
            value={form.icegate_password}
            placeholder={passwordSaved ? 'Leave blank to keep existing password' : 'Enter your ICEGATE portal password'}
            onChange={(event) => { setField('icegate_password')(event); setPasswordSaved(false); }}
          />
        </Field>

        <Field label="API Key (X-Api-Key Header)" layout="col" note="Provided by ICEGATE after registration. Sent as X-Api-Key header.">
          <Textarea className="tw:h-20 tw:resize-none tw:font-mono tw:text-[11px]" value={form.icegate_api_key} placeholder="Paste your ICEGATE API Key here..." onChange={setField('icegate_api_key')} />
        </Field>

        <Field label="Base URL" layout="col" note={`Production: ${DEFAULT_BASE_URL}`}>
          <Input className="tw:font-mono" data-allow-text="" value={form.icegate_base_url} placeholder={DEFAULT_BASE_URL} onChange={setField('icegate_base_url')} />
        </Field>

        {message.text && <SettingsNotice tone={message.type}>{message.text}</SettingsNotice>}

        {tokenInfo && (
          <div className="tw:rounded-md tw:border tw:border-black tw:bg-green-50 tw:px-3.5 tw:py-2.5 tw:text-xs tw:text-green-800">
            <div className="tw:mb-1 tw:font-bold">Token Details</div>
            <div>Status: <strong>{tokenInfo.status || 'Authenticated'}</strong></div>
            {tokenInfo.expiresAt && <div>Expires: <strong>{tokenInfo.expiresAt}</strong></div>}
          </div>
        )}

        <div className="tw:flex tw:flex-wrap tw:gap-2.5">
          <Button type="submit" variant="default" size="lg" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          <Button variant="success" size="lg" disabled={testing} onClick={handleTestConnection}>{testing ? 'Testing...' : 'Test ICEGATE Connection'}</Button>
        </div>
      </form>
    </div>
  );
}
