import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Database, RotateCcw, Save } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { readTokenUser } from '@/components/common/tokenUser';
import { errorMessage } from '@/services/axiosInstance';
import { getToken } from '@/services/session';
import { settingsApi } from '../settingsApi';
import { StatusBanner } from './SettingsParts/Notices';
import { SettingsHeading } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';

const upper = (text) => text.toUpperCase();
const wide = 'tw:sm:col-span-2';

const PROFILE_FIELDS = [
  { name: 'companyName', label: 'Company name', required: true, className: wide },
  { name: 'legalName', label: 'Legal name (as in GST / IEC)', className: wide },
  { name: 'address1', label: 'Address line 1', className: wide },
  { name: 'address2', label: 'Address line 2', className: wide },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State', clean: upper },
  { name: 'pincode', label: 'PIN code', maxLength: 6 },
  { name: 'country', label: 'Country', clean: upper },
  { name: 'gstin', label: 'GSTIN', maxLength: 15, clean: upper },
  { name: 'pan', label: 'PAN', maxLength: 10, clean: upper },
  { name: 'iec', label: 'IEC', maxLength: 10, clean: upper },
  { name: 'cin', label: 'CIN', maxLength: 21, clean: upper },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email' },
  { name: 'website', label: 'Website', className: wide },
  { name: 'defaultCurrency', label: 'Default currency', maxLength: 3, clean: upper },
  { name: 'timezone', label: 'Time zone', kind: 'select', options: ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'] },
  { name: 'dateFormat', label: 'Date format', kind: 'select', options: ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD'] },
].map((field) => ({ maxLength: 255, labelClassName: 'tw:text-[11px] tw:font-bold tw:uppercase tw:text-muted-foreground', ...field }));

// A select shows its first choice until the company picks one.
const withSelectDefaults = (form) => Object.fromEntries(PROFILE_FIELDS.map((field) => [field.name, form[field.name] || (field.options ? field.options[0] : '')]));

function CompanyProfileCard() {
  const [form, setForm] = useState({});
  const [base, setBase] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await settingsApi.companyProfile();
        if (result.success) {
          setForm(result.data || {});
          setBase(result.data || {});
        }
      } catch (error) {
        toast.error(`Could not load company profile: ${errorMessage(error)}`);
      }
    };
    load();
  }, []);

  const dirty = PROFILE_FIELDS.some((field) => String(form[field.name] || '') !== String(base[field.name] || ''));
  const changeField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const save = async () => {
    if (!String(form.companyName || '').trim()) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const body = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.name, form[field.name] == null ? '' : form[field.name]]));
      const result = await settingsApi.saveCompanyProfile(body);
      if (!result.success) throw new Error(result.error || 'Save failed');
      setForm(result.data);
      setBase(result.data);
      toast.success('Company profile saved');
    } catch (error) {
      toast.error(`Not saved: ${error.response?.data?.error || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <SettingsHeading icon={Building2} title="Company Profile" description="Your company details, used on reports and documents." />
      <SettingsFields fields={PROFILE_FIELDS} values={withSelectDefaults(form)} onChange={changeField}
        className="tw:sm:grid-cols-2 tw:lg:grid-cols-4 tw:xl:grid-cols-6" />
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2.5">
        <span className="tw:text-entry tw:text-muted-foreground">{dirty ? 'Changes not saved' : 'Saved'}</span>
        <Button size="lg" onClick={() => setForm(base)} disabled={!dirty || saving}><RotateCcw /> RESET</Button>
        <Button variant="default" size="lg" onClick={save} disabled={saving}><Save /> {saving ? 'SAVING...' : 'SAVE PROFILE'}</Button>
      </div>
    </div>
  );
}

const userRoleOf = () => (getToken() === 'dummy-token' ? 'admin' : readTokenUser().role || null);

function BackupTools() {
  const [backingUp, setBackingUp] = useState(false);
  const [result, setResult] = useState(null);

  const backup = async () => {
    if (!(await askConfirm({ title: 'Start complete system backup?', message: 'This might take a few seconds.', okLabel: 'Start backup' }))) return;
    setBackingUp(true);
    setResult(null);
    try {
      const data = await settingsApi.systemBackup();
      setResult({ tone: 'success', message: `Backup completed successfully! Saved to: ${data.backupDir}` });
    } catch (error) {
      setResult({ tone: 'error', message: error.response ? `Backup failed: ${error.response.data?.error}` : `Backup error: ${error.message}` });
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="tw:mt-6 tw:flex tw:flex-col tw:gap-4 tw:border-t tw:border-border tw:pt-6">
      <h4 className="tw:m-0 tw:text-[13px] tw:font-bold tw:text-head">Admin Tools</h4>
      {result && <StatusBanner tone={result.tone}>{result.message}</StatusBanner>}
      <div className="tw:flex tw:flex-col tw:gap-4 tw:rounded-lg tw:border tw:border-border tw:bg-page tw:p-5 tw:md:flex-row tw:md:items-center">
        <div className="tw:flex-1">
          <div className="tw:mb-1 tw:flex tw:items-center tw:gap-2 tw:text-[15px] tw:font-bold">
            <Database className="tw:size-4.5 tw:text-primary" /> Complete System Backup
          </div>
          <div className="tw:text-[13px] tw:text-muted-foreground">
            Copies the source code (Frontend + Backend, without node_modules) and a clean copy of the SQL database to the backups folder. Restricted to Admins.
          </div>
        </div>
        <Button variant="default" size="lg" onClick={backup} disabled={backingUp}>{backingUp ? 'BACKING UP...' : 'TRIGGER FULL BACKUP'}</Button>
      </div>
    </div>
  );
}

export default function SystemSetupTab() {
  const [userRole] = useState(userRoleOf);
  return (
    <Card className="tw:min-h-[500px] tw:p-4 tw:md:p-6">
      <CompanyProfileCard />
      {userRole === 'admin' && <BackupTools />}
    </Card>
  );
}
