// Settings > Security (14-Nov-2026): what EagleView needs when it is opened from the internet.
//   - EagleView public address: used in e-mailed links (password reset) and allowed for browser calls (CORS)
//   - Office IP addresses: logins from these (and from the office LAN) need no e-mailed code
//   - Code for logins from outside the office: on / off
import React from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShieldCheck, Save } from 'lucide-react';

const box = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', marginBottom: '14px' };
const lbl = { display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '4px' };
const help = { fontSize: '12px', color: '#64748b', marginTop: '4px' };
const inp = { width: '100%', maxWidth: '520px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' };

export default function SecuritySettingsTab() {
  const [v, setV] = React.useState({ app_public_url: '', office_ips: '', login_otp_outside: 'on' });
  const [me, setMe] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      const [s, c] = await Promise.all([axios.get('/api/settings'), axios.get('/api/settings/security-check')]);
      const d = s.data || {};
      setV({ app_public_url: d.app_public_url || '', office_ips: d.office_ips || '', login_otp_outside: String(d.login_otp_outside || 'on').toLowerCase() === 'off' ? 'off' : 'on' });
      setMe(c.data && c.data.data);
    } catch (e) { toast.error('Could not read the settings'); }
  }, []);
  React.useEffect(() => { load(); }, [load]);
  const save = async () => {
    const url = v.app_public_url.trim().replace(/\/+$/, '');
    if (url && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url)) { toast.error('Public address: like https://eagleview.committedgroup.com (https, no path)'); return; }
    const ips = v.office_ips.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
    const bad = ips.filter(x => !/^\d{1,3}(\.\d{1,3}){3}$/.test(x));
    if (bad.length) { toast.error('Office IP not valid: ' + bad.join(', ')); return; }
    setBusy(true);
    try {
      await axios.post('/api/settings/bulk', { settings: { app_public_url: url, office_ips: ips.join(', '), login_otp_outside: v.login_otp_outside } });
      toast.success('Security settings saved'); load();
    } catch (e) { toast.error((e.response && e.response.data && e.response.data.error) || 'Could not save'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ padding: '4px 4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <ShieldCheck size={22} color="#0f766e" />
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Security</h2>
          <div style={{ fontSize: '12px', color: '#64748b' }}>For EagleView opened from the internet (public IP / domain). Only an admin can save.</div>
        </div>
      </div>
      {me && (
        <div style={{ ...box, background: me.office ? '#f0fdf4' : '#fffbeb', borderColor: me.office ? '#bbf7d0' : '#fde68a', fontSize: '13px' }}>
          You are connected from <b>{me.ip}</b> - {me.office ? 'office / LAN (no login code needed)' : 'outside the office (login code needed)'}{me.https ? ', over HTTPS' : ''}.
          {' '}Links in e-mails go to <b>{me.linkBase || 'nowhere yet - set the public address below'}</b>.
        </div>
      )}
      <div style={box}>
        <label style={lbl} htmlFor="sec-url">EagleView public address</label>
        <input id="sec-url" style={inp} value={v.app_public_url} placeholder="https://eagleview.committedgroup.com" onChange={e => setV({ ...v, app_public_url: e.target.value })} />
        <div style={help}>The internet address of EagleView (with https). Password reset links use only this address, and only this site may call EagleView from a browser.</div>
      </div>
      <div style={box}>
        <label style={lbl} htmlFor="sec-ips">Office IP addresses</label>
        <input id="sec-ips" style={inp} value={v.office_ips} placeholder="e.g. 203.0.113.10, 203.0.113.11" onChange={e => setV({ ...v, office_ips: e.target.value })} />
        <div style={help}>Public IPs of the office / branches. Logins from these and from the office LAN need no e-mailed code. Separate with commas.</div>
      </div>
      <div style={box}>
        <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={v.login_otp_outside !== 'off'} onChange={e => setV({ ...v, login_otp_outside: e.target.checked ? 'on' : 'off' })} style={{ marginTop: '3px' }} />
          <span style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: '13px', color: '#0f172a' }}>Ask for an e-mailed code when someone logs in from outside the office</b>
            <span style={{ ...help, display: 'block' }}>After the password, a 6-digit code goes to the user's e-mail (valid 10 minutes). Users without an e-mail cannot log in from outside. Needs Settings &gt; Email to work.</span></span>
        </label>
      </div>
      <button type="button" onClick={save} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#0f766e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: busy ? 'default' : 'pointer' }}>
        <Save size={15} /> {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
