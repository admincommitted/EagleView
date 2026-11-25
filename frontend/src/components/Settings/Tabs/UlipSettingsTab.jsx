import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, Key, Save } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { replyOf, settingsApi } from '../settingsApi';
import { StatusBanner } from './SettingsParts/Notices';
import { SettingsCard } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { UlipApiManager } from './SettingsParts/UlipApiManager';

const BASE_URL_PATTERN = /^https:\/\/[^\s]+$/;

const LOGIN_FIELDS = [
  { name: 'ULIP_USERNAME', label: 'ULIP API username', placeholder: 'ULIP user' },
  {
    name: 'ULIP_PASSWORD', label: 'ULIP API password', kind: 'password', leftIcon: Key,
    placeholder: ({ ULIP_PASSWORD }) => (ULIP_PASSWORD === '***' ? 'Saved' : 'Enter password'),
  },
  { name: 'ULIP_BASE_URL', label: 'Base URL', placeholder: 'https://www.ulip.dpiit.gov.in/ulip/v1.0.0', clean: (text) => text.trim(), controlClassName: 'tw:normal-case' },
];

export default function UlipSettingsTab() {
  const [settings, setSettings] = useState({ ULIP_USERNAME: '', ULIP_PASSWORD: '', ULIP_BASE_URL: '' });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadSettings = async () => {
    try {
      const saved = await settingsApi.settings();
      setSettings({ ULIP_USERNAME: saved.ULIP_USERNAME || '', ULIP_PASSWORD: saved.ULIP_PASSWORD || '', ULIP_BASE_URL: saved.ULIP_BASE_URL || '' });
    } catch {
      toast.error('Failed to load ULIP Settings');
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const changeField = (name, value) => setSettings((current) => ({ ...current, [name]: value }));

  const save = async () => {
    if (settings.ULIP_BASE_URL && !BASE_URL_PATTERN.test(settings.ULIP_BASE_URL)) {
      toast.error('Base URL must start with https://');
      return;
    }
    setLoading(true);
    try {
      const { status, body } = await replyOf(settingsApi.saveSettings(settings));
      if (status < 300) {
        toast.success('ULIP login saved');
        loadSettings();
      } else {
        toast.error(body.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Network error saving settings');
    }
    setLoading(false);
  };

  const testConnection = async () => {
    if (!settings.ULIP_USERNAME) {
      toast.error('Username is required to test');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // a saved password is shown as *** - the backend then uses the saved one
      const { body } = await replyOf(settingsApi.testUlipLogin({
        username: settings.ULIP_USERNAME,
        password: settings.ULIP_PASSWORD === '***' ? '' : settings.ULIP_PASSWORD,
      }));
      if (body.success) {
        setTestResult({ success: true, message: body.message || 'Connection successful' });
        toast.success('Connected to ULIP');
      } else {
        setTestResult({ success: false, message: typeof body.error === 'string' ? body.error : JSON.stringify(body.error || 'Connection failed') });
        toast.error('Failed to connect to ULIP');
      }
    } catch {
      setTestResult({ success: false, message: 'Network/Server Error' });
    }
    setTesting(false);
  };

  return (
    <Card className="tw:gap-4.5 tw:p-4 tw:md:p-6">
      <div className="tw:rounded-lg tw:border tw:border-primary/30 tw:bg-linear-to-r tw:from-primary/5 tw:to-primary/15 tw:px-4 tw:py-3.5">
        <h2 className="tw:m-0 tw:mb-1.5 tw:flex tw:items-center tw:gap-2 tw:text-[17px] tw:font-semibold tw:text-head"><Activity className="tw:size-5.5" /> ULIP API Integration</h2>
        <p className="tw:m-0 tw:text-entry tw:text-primary">ULIP login, then each ULIP API (DGFT, VAHAN, SARATHI, FASTag, ICEGATE, LDB ...) added one by one below.</p>
      </div>

      <SettingsCard title="ULIP login"
        footer={(
          <div className="tw:flex tw:w-full tw:flex-wrap tw:justify-end tw:gap-2.5">
            <Button size="lg" onClick={testConnection} disabled={testing}>{testing ? 'Testing...' : 'Test Connection'}</Button>
            <Button variant="default" size="lg" onClick={save} disabled={loading}><Save /> {loading ? 'Saving...' : 'Save Login'}</Button>
          </div>
        )}>
        <SettingsFields fields={LOGIN_FIELDS} values={settings} onChange={changeField} className="tw:md:grid-cols-3" />
        {testResult && <StatusBanner tone={testResult.success ? 'success' : 'error'} className="tw:font-normal">{testResult.message}</StatusBanner>}
      </SettingsCard>

      <UlipApiManager />
    </Card>
  );
}
