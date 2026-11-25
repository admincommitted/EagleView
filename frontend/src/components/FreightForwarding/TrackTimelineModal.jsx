// Full status history of one AWB / HAWB, with "add milestone by hand".
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge, Button, Field, Input, Modal, SelectBox } from '@/components/ui';
import { askConfirm } from '../common/askConfirm';
import { freightApi } from './freightApi';

const MILESTONES = [['RCS', 'Received by airline'], ['FOH', 'Freight on hand'], ['FMA', 'Accepted (FMA)'], ['FNA', 'Rejected (FNA)'], ['DEP', 'Departed'], ['TFD', 'Transferred'], ['ARR', 'Arrived'], ['RCF', 'Received at destination'], ['NFD', 'Consignee notified'], ['DLV', 'Delivered']];
const MILESTONE_OPTIONS = MILESTONES.map(([code, name]) => ({ value: code, label: `${code} - ${name}` }));
const TONE = {
  red: { dot: 'tw:bg-[#dc2626]', text: 'tw:text-[#dc2626]' },
  blue: { dot: 'tw:bg-[#2563eb]', text: 'tw:text-[#2563eb]' },
  green: { dot: 'tw:bg-[#059669]', text: 'tw:text-[#059669]' },
  violet: { dot: 'tw:bg-[#7c3aed]', text: 'tw:text-[#7c3aed]' },
  cyan: { dot: 'tw:bg-[#0891b2]', text: 'tw:text-[#0891b2]' },
  delivered: { dot: 'tw:bg-[#15803d]', text: 'tw:text-[#15803d]' },
  none: { dot: 'tw:bg-[#64748b]', text: 'tw:text-foreground' },
};
const TONE_OF_CODE = { FNA: 'red', FMA: 'blue', RCS: 'green', FOH: 'green', DEP: 'violet', TFD: 'violet', ARR: 'cyan', RCF: 'cyan', NFD: 'cyan', DLV: 'delivered' };
const toneOf = (code) => TONE[TONE_OF_CODE[code] || 'none'];

const formatWhen = (value) => {
  const when = new Date(value);
  return isNaN(when) ? String(value || '-') : when.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const EMPTY_DETAILS = { station: '', flight: '', pieces: '', weight: '', note: '' };
const failText = (error, fallback) => (error.response ? error.response.data?.error || fallback : error.message);

function TimelineEvent({ event, isLast, hawbNumber, onRemove }) {
  const tone = toneOf(event.code);
  const byHand = event.source === 'MANUAL';
  const details = [event.station && `Station ${event.station}`, event.flight && `Flight ${event.flight}`, event.pieces != null && `${event.pieces} pcs`, event.weight != null && `${event.weight} kg`].filter(Boolean);
  return (
    <div className="tw:relative tw:flex tw:gap-2.5 tw:pb-3">
      <div className="tw:flex tw:flex-col tw:items-center">
        <div className={cn('tw:mt-[3px] tw:size-3 tw:rounded-full', tone.dot)} />
        {!isLast && <div className="tw:w-0.5 tw:flex-1 tw:bg-border" />}
      </div>
      <div className="tw:flex-1 tw:text-entry">
        <div className="tw:flex tw:flex-wrap tw:items-baseline tw:gap-2">
          <b className={tone.text}>{event.code}</b><span>{event.name}</span>
          <span className="tw:text-muted-foreground">{formatWhen(event.eventAt)}</span>
          {event.scope === 'MAWB' && hawbNumber && <Badge variant="info">MAWB</Badge>}
          <Badge variant={byHand ? 'warning' : 'success'}>{byHand ? `BY HAND · ${event.user || ''}` : 'AIRLINE FSU'}</Badge>
          {byHand && <Button variant="ghost" size="icon-sm" className="tw:text-destructive" title="Remove this milestone" aria-label="Remove this milestone" onClick={() => onRemove(event)}><Trash2 /></Button>}
        </div>
        <div className="tw:text-[#475569]">{details.join(' · ')}</div>
        {event.note && <div className="tw:text-muted-foreground tw:italic">{event.note}</div>}
        {event.notified && <div className={cn('tw:text-[10px]', /FAILED|ERROR/.test(event.notified) ? 'tw:text-destructive' : 'tw:text-success')}>Customer update: {event.notified}</div>}
      </div>
    </div>
  );
}

export default function TrackTimelineModal({ awbNumber, hawbNumber, onClose, onChanged, onOpenAwb }) {
  const [history, setHistory] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ code: 'RCS', eventAt: nowLocal(), ...EMPTY_DETAILS });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const answer = await freightApi.trackingEvents(awbNumber, hawbNumber);
      if (!answer.success) throw new Error(answer.error || 'Could not load');
      setHistory(answer);
      setLoadError('');
    } catch (error) {
      setLoadError(failText(error, 'Could not load'));
    }
  }, [awbNumber, hawbNumber]);
  useEffect(() => { load(); }, [load]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const add = async () => {
    setSaving(true);
    setMessage('');
    try {
      const answer = await freightApi.addTrackingEvent({ awbNumber, hawbNumber: hawbNumber || undefined, ...form, eventAt: new Date(form.eventAt).toISOString() });
      if (!answer.success) throw new Error(answer.error || 'Could not save');
      setMessage(`${form.code} saved${answer.event?.notified ? ' · ' + answer.event.notified : ''}`);
      setForm((current) => ({ ...current, ...EMPTY_DETAILS }));
      await load();
      onChanged?.();
    } catch (error) {
      setMessage('Error: ' + failText(error, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (event) => {
    const goAhead = await askConfirm({ title: 'Remove milestone', message: `Remove ${event.code} of ${formatWhen(event.eventAt)} (entered by ${event.user || 'hand'})?`, okLabel: 'Remove', tone: 'danger' });
    if (!goAhead) return;
    try {
      await freightApi.deleteTrackingEvent(event.id);
      setMessage(`${event.code} removed`);
    } catch (error) {
      setMessage('Error: ' + failText(error, 'could not remove'));
    }
    await load();
    onChanged?.();
  };

  const events = history?.events || [];
  const subtitle = `${hawbNumber ? `MAWB ${awbNumber} · ` : ''}${history?.airline ? `${history.airline.name} (${history.airline.prefix})` : ''}`;

  return (
    <Modal open onClose={onClose} title={hawbNumber ? `HAWB ${hawbNumber}` : `AWB ${awbNumber}`} description={subtitle || undefined} width={920} className="tw:max-h-[90vh]">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
        {history?.airlineTrackingUrl && (
          <a href={history.airlineTrackingUrl} target="_blank" rel="noopener noreferrer" className="tw:flex tw:items-center tw:gap-1 tw:text-entry tw:font-bold tw:text-primary">
            Airline tracking <ExternalLink className="tw:size-3.5" />
          </a>
        )}
        {onOpenAwb && <Button onClick={onOpenAwb}>Open AWB</Button>}
        <Button variant="ghost" size="icon" title="Reload" aria-label="Reload" onClick={load}><RefreshCw /></Button>
      </div>

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-[minmax(0,3fr)_minmax(240px,2fr)]">
        <div>
          <div className="tw:mb-2 tw:text-entry tw:font-extrabold tw:uppercase">Status history</div>
          {loadError && <div className="tw:text-entry tw:text-destructive">{loadError}</div>}
          {!history && !loadError && <div className="tw:text-entry tw:text-muted-foreground">Loading...</div>}
          {history && !events.length && <div className="tw:text-entry tw:text-muted-foreground">No status received yet. FSUs from the airline appear here; you can also add one by hand.</div>}
          {events.map((event, index) => (
            <TimelineEvent key={event.id} event={event} isLast={index === events.length - 1} hawbNumber={hawbNumber} onRemove={remove} />
          ))}
          {history?.logs?.length > 0 && (
            <details className="tw:mt-2">
              <summary className="tw:cursor-pointer tw:text-entry tw:font-bold">AWB log ({history.logs.length})</summary>
              {history.logs.map((log, index) => <div key={index} className="tw:py-0.5 tw:text-[11px] tw:text-[#475569]">{formatWhen(log.at)} · {log.action} · {log.user} · {log.details}</div>)}
            </details>
          )}
        </div>

        <div className="tw:self-start tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-2.5">
          <div className="tw:mb-2 tw:flex tw:items-center tw:gap-1.5 tw:text-entry tw:font-extrabold tw:uppercase"><Plus className="tw:size-3.5" /> Add milestone by hand</div>
          <div className="tw:grid tw:grid-cols-2 tw:gap-2">
            <Field label="Milestone" layout="col" className="tw:col-span-2">
              <SelectBox className="tw:w-full" value={form.code} onValueChange={(code) => setField('code', code)} options={MILESTONE_OPTIONS} />
            </Field>
            <Field label="Date & time" layout="col" className="tw:col-span-2">
              <Input type="datetime-local" value={form.eventAt} max={nowLocal()} onChange={(event) => setField('eventAt', event.target.value)} />
            </Field>
            <Field label="Station" layout="col">
              <Input data-allow-text value={form.station} maxLength={3} placeholder="DEL" onChange={(event) => setField('station', event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} />
            </Field>
            <Field label="Flight" layout="col">
              <Input data-allow-text value={form.flight} maxLength={10} placeholder="EK511" onChange={(event) => setField('flight', event.target.value.toUpperCase())} />
            </Field>
            <Field label="Pieces" layout="col">
              <Input value={form.pieces} inputMode="numeric" onChange={(event) => setField('pieces', event.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label="Weight kg" layout="col">
              <Input value={form.weight} inputMode="decimal" onChange={(event) => setField('weight', event.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field label="Note" layout="col" className="tw:col-span-2">
              <Input data-allow-text value={form.note} maxLength={300} placeholder="e.g. confirmed by airline on phone" onChange={(event) => setField('note', event.target.value)} />
            </Field>
          </div>
          <Button variant="default" className="tw:mt-2.5 tw:w-full" disabled={saving || !form.eventAt} onClick={add}><Save /> {saving ? 'Saving...' : 'Save milestone'}</Button>
          {message && <div className={cn('tw:mt-1.5 tw:text-[11px]', message.startsWith('Error') ? 'tw:text-destructive' : 'tw:text-success')}>{message}</div>}
          <div className="tw:mt-1.5 tw:text-[10px] tw:text-muted-foreground">Only milestones entered by hand can be removed. Airline FSUs stay.</div>
        </div>
      </div>
    </Modal>
  );
}
