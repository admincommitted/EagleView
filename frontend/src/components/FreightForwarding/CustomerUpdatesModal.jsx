// Customer shipment updates settings: OFF until an admin switches it on (backend utils/awbNotify.js).
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Field, Input, Modal } from '@/components/ui';
import { freightApi } from './freightApi';

const MILESTONES = [['RCS', 'Received by airline'], ['DEP', 'Departed'], ['ARR', 'Arrived'], ['RCF', 'Received at destination'], ['NFD', 'Consignee notified'], ['DLV', 'Delivered'], ['FNA', 'Rejected (FNA)'], ['FMA', 'Accepted (FMA)'], ['FOH', 'Freight on hand'], ['TFD', 'Transferred']];
const CHANNELS = [['email', 'Email (Settings → Email SMTP)'], ['whatsapp', 'WhatsApp (Settings → WhatsApp)']];
const RECIPIENTS = [['toShipper', 'Shipper (email / mobile saved on the AWB)'], ['toConsignee', 'Consignee']];

function CheckRow({ checked, onToggle, disabled, className, children }) {
  return (
    <label className={cn('tw:flex tw:items-center tw:gap-2 tw:py-[3px] tw:text-entry', className)}>
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      <span>{children}</span>
    </label>
  );
}

function GroupTitle({ children }) {
  return <div className="tw:mt-2 tw:mb-1 tw:text-[11px] tw:font-extrabold tw:uppercase">{children}</div>;
}

const loadFailText = (error) => 'Error: ' + (error.response ? error.response.data?.error || 'could not load' : error.message);

export default function CustomerUpdatesModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const answer = await freightApi.notifySettings();
        if (answer.success) { setSettings(answer.settings); setCanEdit(Boolean(answer.canEdit)); }
        else setMessage('Error: ' + (answer.error || 'could not load'));
      } catch (error) {
        setMessage(loadFailText(error));
      }
    };
    load();
  }, []);

  const toggle = (key) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const toggleMilestone = (code) => setSettings((current) => ({
    ...current,
    milestones: current.milestones.includes(code) ? current.milestones.filter((item) => item !== code) : [...current.milestones, code],
  }));
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const answer = await freightApi.saveNotifySettings(settings);
      if (!answer.success) throw new Error(answer.error || 'Could not save');
      setSettings(answer.settings);
      setMessage(answer.settings.enabled ? 'Saved - customer updates are ON' : 'Saved - customer updates are OFF');
    } catch (error) {
      setMessage('Error: ' + (error.response?.data?.error || error.message || 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const locked = !canEdit || saving;
  const footer = settings && (
    <>
      {message && <span className={cn('tw:mr-auto tw:text-entry', message.startsWith('Error') ? 'tw:text-destructive' : 'tw:text-success')}>{message}</span>}
      <Button variant="default" disabled={locked} onClick={save}><Save /> {saving ? 'Saving...' : 'Save'}</Button>
    </>
  );

  return (
    <Modal open onClose={onClose} title="Customer shipment updates" width={520} footer={footer}>
      {!settings ? <div className="tw:text-entry">{message || 'Loading...'}</div> : (
        <>
          {!canEdit && <div className="tw:rounded-sm tw:bg-[#fef3c7] tw:px-2 tw:py-1.5 tw:text-[11px] tw:text-warning">Only an admin can change these settings.</div>}
          <CheckRow checked={settings.enabled} disabled={locked} onToggle={() => toggle('enabled')} className="tw:text-[13px] tw:font-extrabold">Send updates to customers automatically</CheckRow>
          <div className="tw:text-[11px] tw:text-muted-foreground">When a chosen milestone comes from the airline (or is entered by hand), the customer of that AWB gets a message. For a MAWB, the shippers of its houses get it. Each milestone is sent only once.</div>
          <div className={cn(!settings.enabled && 'tw:opacity-50')}>
            <GroupTitle>Send by</GroupTitle>
            {CHANNELS.map(([key, label]) => <CheckRow key={key} checked={settings[key]} disabled={locked} onToggle={() => toggle(key)}>{label}</CheckRow>)}
            <GroupTitle>To</GroupTitle>
            {RECIPIENTS.map(([key, label]) => <CheckRow key={key} checked={settings[key]} disabled={locked} onToggle={() => toggle(key)}>{label}</CheckRow>)}
            <Field label="Also email (CC), comma separated" layout="col" className="tw:py-[3px]">
              <Input data-allow-text disabled={locked} value={settings.ccEmails} placeholder="ops@yourcompany.com"
                onChange={(event) => setSettings((current) => ({ ...current, ccEmails: event.target.value }))} />
            </Field>
            <GroupTitle>On these milestones</GroupTitle>
            <div className="tw:grid tw:grid-cols-1 tw:gap-x-3 tw:sm:grid-cols-2">
              {MILESTONES.map(([code, name]) => (
                <CheckRow key={code} checked={settings.milestones.includes(code)} disabled={locked} onToggle={() => toggleMilestone(code)}><b>{code}</b> {name}</CheckRow>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
