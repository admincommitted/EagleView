// Field Tracking > Phone access: the office code a phone needs to register, "old field app allowed", and which phones
// use the new app (own device token) or the old one. Admin changes; others only see.
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, Checkbox, DataTable, Input, Modal } from '@/components/ui';
import askConfirm from '@/components/common/askConfirm';
import { cn } from '@/lib/utils';
import { fieldTrackingApi } from '../fieldTrackingApi';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const MIN_CODE_LENGTH = 6;

const shortTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const randomCode = () => [...crypto.getRandomValues(new Uint32Array(CODE_LENGTH))].map((number) => CODE_LETTERS[number % CODE_LETTERS.length]).join('');

const cleanCode = (text) => text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

export default function PhoneAccessModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const answer = await fieldTrackingApi.deviceSettings();
      setSettings(answer.data);
      setCode(answer.data.code || '');
    } catch (error) {
      toast.error(error.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (change, message) => {
    setBusy(true);
    try {
      await fieldTrackingApi.saveDeviceSettings(change);
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (agent) => {
    const goAhead = await askConfirm({
      title: 'Disconnect phone',
      message: `Disconnect ${agent.name}'s phone? It must register again with the office code.`,
      okLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!goAhead) return;
    try {
      await fieldTrackingApi.disconnectPhone(agent.id);
      toast.success('Phone disconnected');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isAdmin = settings?.isAdmin;
  const oldAppCount = settings ? settings.agents.filter((agent) => !agent.phoneSecure).length : 0;

  const columns = [
    { key: 'name', header: 'Field staff', cell: (agent) => <><b>{agent.name}</b> <span className="tw:text-muted-foreground">{agent.id}</span></> },
    { key: 'phone', header: 'Mobile' },
    {
      key: 'app',
      header: 'App',
      cell: (agent) => (agent.phoneSecure
        ? <span className="tw:font-bold tw:text-success">New app (registered {shortTime(agent.deviceIssuedAt)})</span>
        : <span className="tw:font-bold tw:text-warning">Old app / not registered</span>),
    },
    { key: 'lastLegacyAt', header: 'Old app last used', className: 'tw:text-muted-foreground', cell: (agent) => shortTime(agent.lastLegacyAt) || '-' },
    {
      key: 'disconnect',
      header: '',
      align: 'right',
      cell: (agent) => isAdmin && agent.phoneSecure && <Button size="sm" variant="destructive" onClick={() => disconnect(agent)}>Disconnect phone</Button>,
    },
  ];

  const title = (
    <span className="tw:flex tw:items-center tw:gap-2">
      <ShieldCheck className="tw:size-[18px] tw:text-primary" /> Phone access
      <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={load}><RefreshCw className="tw:size-[15px]" /></Button>
    </span>
  );

  return (
    <Modal open width={720} title={title} onClose={onClose} className="tw:max-h-[90vh]" bodyClassName="tw:gap-3.5 tw:text-[12.5px]">
      {!settings ? (
        <span className="tw:text-entry tw:text-muted-foreground">Loading…</span>
      ) : (
        <>
          <section className="tw:flex tw:flex-col tw:gap-2">
            <b className="tw:text-foreground">Office code</b>
            <span className="tw:text-muted-foreground">
              A field boy opens the new field app, enters his mobile number and this code once. His phone then gets its own key and can send only his location and tasks.
            </span>
            {isAdmin ? (
              <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <Input
                  data-allow-text
                  aria-label="Office code"
                  value={code}
                  onChange={(event) => setCode(cleanCode(event.target.value))}
                  placeholder="6-20 letters / digits"
                  className="tw:h-8 tw:w-[220px] tw:font-mono tw:text-[14px] tw:tracking-wider"
                />
                <Button onClick={() => setCode(randomCode())}>New random code</Button>
                <Button variant="default" disabled={busy || code.length < MIN_CODE_LENGTH} onClick={() => save({ code }, 'Office code saved')}>Save code</Button>
                {settings.codeSet && <span className="tw:text-muted-foreground">Changing it does not disconnect phones already registered.</span>}
              </div>
            ) : (
              <div>{settings.codeSet ? 'Set (ask the admin for it).' : <b className="tw:text-destructive">Not set yet - ask the admin.</b>}</div>
            )}
          </section>

          <section className={cn('tw:rounded-lg tw:border tw:px-3 tw:py-2.5', settings.legacy ? 'tw:border-warning/40 tw:bg-warning/10' : 'tw:border-success/40 tw:bg-success/10')}>
            <label className={cn('tw:m-0 tw:flex tw:items-start tw:gap-2', isAdmin ? 'tw:cursor-pointer' : 'tw:cursor-default')}>
              <Checkbox
                className="tw:mt-0.5"
                checked={Boolean(settings.legacy)}
                disabled={!isAdmin || busy}
                onCheckedChange={(checked) => save({ legacy: checked === true }, checked === true ? 'Old field app allowed' : 'Old field app stopped')}
              />
              <span>
                <b>Allow the old field app</b> (no office code)<br />
                <span className="tw:text-muted-foreground">
                  Keep this on until every field boy has the new app ({oldAppCount} of {settings.agents.length} not registered yet). While on, old phones keep working but get no one's location or phone number; turn it off after the switch.
                </span>
              </span>
            </label>
          </section>

          <section className="tw:flex tw:flex-col tw:gap-1.5">
            <b className="tw:text-foreground">Phones</b>
            <DataTable columns={columns} rows={settings.agents} emptyText="No field staff" />
          </section>
        </>
      )}
    </Modal>
  );
}
