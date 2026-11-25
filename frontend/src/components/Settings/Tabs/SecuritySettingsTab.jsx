import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { settingsApi } from '../settingsApi';
import { StatusBanner } from './SettingsParts/Notices';
import { SettingsCard, SettingsHeading } from './SettingsParts/SettingsCard';
import { SettingsFields } from './SettingsParts/SettingsFields';

const PUBLIC_URL_PATTERN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const IP_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

const ADDRESS_FIELDS = [
  {
    name: 'app_public_url', label: 'EagleView public address', placeholder: 'https://eagleview.committedgroup.com', controlClassName: 'tw:md:max-w-[520px]',
    note: 'The internet address of EagleView (with https). Password reset links use only this address, and only this site may call EagleView from a browser.',
  },
  {
    name: 'office_ips', label: 'Office IP addresses', placeholder: 'e.g. 203.0.113.10, 203.0.113.11', controlClassName: 'tw:md:max-w-[520px]',
    note: 'Public IPs of the office / branches. Logins from these and from the office LAN need no e-mailed code. Separate with commas.',
  },
];

const OTP_FIELDS = [
  {
    name: 'loginOtp', kind: 'checkbox', label: 'Ask for an e-mailed code when someone logs in from outside the office',
    note: "After the password, a 6-digit code goes to the user's e-mail (valid 10 minutes). Users without an e-mail cannot log in from outside. Needs Settings > Email to work.",
  },
];

function ConnectionBanner({ connection }) {
  return (
    <StatusBanner tone={connection.office ? 'success' : 'warning'} icon={false} className="tw:font-normal tw:text-foreground">
      You are connected from <b>{connection.ip}</b> - {connection.office ? 'office / LAN (no login code needed)' : 'outside the office (login code needed)'}
      {connection.https ? ', over HTTPS' : ''}. Links in e-mails go to <b>{connection.linkBase || 'nowhere yet - set the public address below'}</b>.
    </StatusBanner>
  );
}

export default function SecuritySettingsTab() {
  const [values, setValues] = useState({ app_public_url: '', office_ips: '', login_otp_outside: 'on' });
  const [connection, setConnection] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [saved, check] = await Promise.all([settingsApi.settings(), settingsApi.securityCheck()]);
      const settings = saved || {};
      setValues({
        app_public_url: settings.app_public_url || '',
        office_ips: settings.office_ips || '',
        login_otp_outside: String(settings.login_otp_outside || 'on').toLowerCase() === 'off' ? 'off' : 'on',
      });
      setConnection(check && check.data);
    } catch {
      toast.error('Could not read the settings');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeField = (name, value) => {
    if (name === 'loginOtp') setValues((current) => ({ ...current, login_otp_outside: value ? 'on' : 'off' }));
    else setValues((current) => ({ ...current, [name]: value }));
  };

  const save = async () => {
    const url = values.app_public_url.trim().replace(/\/+$/, '');
    if (url && !PUBLIC_URL_PATTERN.test(url)) {
      toast.error('Public address: like https://eagleview.committedgroup.com (https, no path)');
      return;
    }
    const ips = values.office_ips.split(/[,\s]+/).map((ip) => ip.trim()).filter(Boolean);
    const badIps = ips.filter((ip) => !IP_PATTERN.test(ip));
    if (badIps.length) {
      toast.error(`Office IP not valid: ${badIps.join(', ')}`);
      return;
    }
    setBusy(true);
    try {
      await settingsApi.saveSettings({ app_public_url: url, office_ips: ips.join(', '), login_otp_outside: values.login_otp_outside });
      toast.success('Security settings saved');
      load();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-3.5 tw:p-1">
      <SettingsHeading icon={ShieldCheck} title="Security"
        description="For EagleView opened from the internet (public IP / domain). Only an admin can save." />
      {connection && <ConnectionBanner connection={connection} />}
      <SettingsCard>
        <SettingsFields fields={ADDRESS_FIELDS} values={values} onChange={changeField} className="tw:gap-4 tw:pt-3" />
      </SettingsCard>
      <SettingsCard>
        <SettingsFields fields={OTP_FIELDS} values={{ loginOtp: values.login_otp_outside !== 'off' }} onChange={changeField} className="tw:pt-3" />
      </SettingsCard>
      <div>
        <Button variant="default" size="lg" onClick={save} disabled={busy}><Save /> {busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </div>
  );
}
