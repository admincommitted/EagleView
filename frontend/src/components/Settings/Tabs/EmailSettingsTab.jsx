import { useEffect, useState } from 'react';
import { Loader2, Mail, Save, Send, Settings2, TestTube2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import CbicWatchCard from './CbicWatchCard';
import PoApprovalContacts from './PoApprovalContacts';
import { EmailTemplateEditor, EmailTypeList } from './SettingsParts/EmailTemplateEditor';
import { defaultTypeConfigs, EMAIL_TYPES, templateSettingKey } from './SettingsParts/emailTemplates';
import { CornerToast } from './SettingsParts/Notices';
import { SettingsCard, SettingsHeading } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';
import { useTimedNotice } from './SettingsParts/useTimedNotice';

const TOAST_MS = 4000;
const EMPTY_SMTP = { SMTP_HOST: '', SMTP_PORT: '587', SMTP_USER: '', SMTP_PASS: '', SMTP_SECURE: 'false', SMTP_FROM_NAME: 'Committed Cargo ERP' };

const SERVER_FIELDS = [
  { name: 'SMTP_HOST', label: 'SMTP Host', placeholder: 'smtp.gmail.com', className: 'tw:md:col-span-2' },
  { name: 'SMTP_PORT', label: 'Port', placeholder: '587' },
  {
    name: 'SMTP_SECURE', label: 'Encryption', kind: 'select',
    options: [{ value: 'false', label: 'STARTTLS (Port 587)' }, { value: 'true', label: 'SSL/TLS (Port 465)' }],
  },
];

const ACCOUNT_FIELDS = [
  { name: 'SMTP_USER', label: 'Email (Username)', kind: 'email', placeholder: 'noreply@committedcargo.com' },
  { name: 'SMTP_PASS', label: 'Password / App Password', kind: 'password', revealable: true, placeholder: 'App password' },
  { name: 'SMTP_FROM_NAME', label: 'From Name (Display)', placeholder: 'Committed Cargo ERP' },
];

export default function EmailSettingsTab() {
  const [smtp, setSmtp] = useState(EMPTY_SMTP);
  const [testEmail, setTestEmail] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [typeConfig, setTypeConfig] = useState(defaultTypeConfigs);
  const [activeType, setActiveType] = useState('password_reset');
  const [savingAll, setSavingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, showNotice] = useTimedNotice(TOAST_MS);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await settingsApi.settings();
        setSmtp((current) => ({
          SMTP_HOST: saved.SMTP_HOST || current.SMTP_HOST,
          SMTP_PORT: saved.SMTP_PORT || current.SMTP_PORT,
          SMTP_USER: saved.SMTP_USER || current.SMTP_USER,
          // a saved password comes back as *** and is shown as an empty box
          SMTP_PASS: (saved.SMTP_PASS === '***' ? '' : saved.SMTP_PASS) || '',
          SMTP_SECURE: saved.SMTP_SECURE || current.SMTP_SECURE,
          SMTP_FROM_NAME: saved.SMTP_FROM_NAME || current.SMTP_FROM_NAME,
        }));
        EMAIL_TYPES.forEach((type) => {
          const stored = saved[templateSettingKey(type.id)];
          if (!stored) return;
          try {
            const parsed = JSON.parse(stored);
            setTypeConfig((current) => ({ ...current, [type.id]: { ...current[type.id], ...parsed } }));
          } catch {
            // a broken template keeps the default
          }
        });
      } catch {
        // the defaults stay
      }
    };
    load();
  }, []);

  const setSmtpField = (name, value) => setSmtp((current) => ({ ...current, [name]: value }));
  const setTypeField = (name, value) => setTypeConfig((current) => ({ ...current, [activeType]: { ...current[activeType], [name]: value } }));
  const currentType = EMAIL_TYPES.find((type) => type.id === activeType);
  const currentConfig = typeConfig[activeType] || {};

  const testSmtp = async () => {
    if (!testEmail) { showNotice('Enter a test email address', 'error'); return; }
    setTestingSmtp(true);
    try {
      await settingsApi.sendTestEmail(testEmail, smtp);
      showNotice(`Test email sent to ${testEmail}! Check inbox.`);
    } catch (error) {
      showNotice(error.response?.data?.error || 'SMTP test failed. Check credentials.', 'error');
    } finally {
      setTestingSmtp(false);
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    try {
      const settings = { ...smtp };
      EMAIL_TYPES.forEach((type) => { settings[templateSettingKey(type.id)] = JSON.stringify(typeConfig[type.id]); });
      await settingsApi.saveSettings(settings);
      showNotice('All email settings saved!');
    } catch (error) {
      showNotice(error.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSavingAll(false);
    }
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      await settingsApi.saveSettings({ [templateSettingKey(activeType)]: JSON.stringify(currentConfig) });
      showNotice(`${currentType?.label} template saved!`);
    } catch (error) {
      showNotice(error.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-4">
      <CornerToast notice={notice} />

      <SettingsHeading icon={Mail} title="Email Notification Settings" description="Configure SMTP, templates and schedules for each notification type" />

      <PoApprovalContacts />
      <CbicWatchCard />

      <SettingsCard icon={Settings2} title="SMTP Configuration">
        <SettingsFields fields={SERVER_FIELDS} values={smtp} onChange={setSmtpField} className="tw:md:grid-cols-4" />
        <SettingsFields fields={ACCOUNT_FIELDS} values={smtp} onChange={setSmtpField} className="tw:md:grid-cols-3" />
        <div className="tw:mt-1 tw:flex tw:flex-col tw:gap-2.5 tw:rounded-lg tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-3.5 tw:py-3 tw:sm:flex-row tw:sm:items-center">
          <TestTube2 className="tw:hidden tw:size-4 tw:shrink-0 tw:text-warning tw:sm:block" />
          <Input type="email" data-allow-text="" className="tw:flex-1" value={testEmail} onChange={(event) => setTestEmail(event.target.value)}
            placeholder="Send test email to..." />
          <Button variant="warning" size="lg" onClick={testSmtp} disabled={testingSmtp}>
            {testingSmtp ? <Loader2 className="tw:animate-spin" /> : <Send />}{testingSmtp ? 'Sending...' : 'Send Test'}
          </Button>
        </div>
      </SettingsCard>

      <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-4 tw:lg:grid-cols-[220px_1fr]">
        <EmailTypeList activeType={activeType} typeConfig={typeConfig} onPick={setActiveType} />
        <EmailTemplateEditor type={currentType} config={currentConfig} onChange={setTypeField} onSave={saveTemplate} saving={saving} />
      </div>

      <div className="tw:sticky tw:bottom-0 tw:z-10 tw:flex tw:flex-col tw:gap-3 tw:bg-linear-to-t tw:from-page tw:from-80% tw:to-transparent tw:pt-4 tw:pb-1 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
        <div className="tw:text-[11px] tw:text-muted-foreground">
          💾 Click <b>Save All Settings</b> to save SMTP config + all email templates and schedules
        </div>
        <Button variant="default" size="lg" onClick={saveAll} disabled={savingAll}>
          {savingAll ? <Loader2 className="tw:animate-spin" /> : <Save />}{savingAll ? 'Saving...' : 'Save All Settings'}
        </Button>
      </div>
    </div>
  );
}
