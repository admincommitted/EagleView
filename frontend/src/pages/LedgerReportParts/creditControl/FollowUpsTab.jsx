import { Calendar, Mail, MessageSquare, PhoneCall, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, DateInput, Field, NumberInput, SelectBox, Textarea } from '@/components/ui';
import { dayFirst, formatInr } from '../format';

const CHANNEL_OPTIONS = [
  { value: 'CALL', label: 'Phone call' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISIT', label: 'Visit' },
];

const CHANNEL_ICONS = { EMAIL: Mail, VISIT: Calendar, SYSTEM: Send };

const PROMISE_STATES = [
  { met: true, label: 'kept', className: 'tw:text-success', buttonClassName: 'tw:border-success tw:text-success' },
  { met: false, label: 'broken', className: 'tw:text-destructive', buttonClassName: 'tw:border-destructive tw:text-destructive' },
];

const labelClassName = 'tw:font-semibold tw:text-muted-foreground';

function FollowUpForm({ draft, onDraftChange, saving, onSave }) {
  const setField = (key) => (value) => onDraftChange({ ...draft, [key]: value });
  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:md:flex-1">
      <h4 className="tw:m-0 tw:text-sm tw:text-foreground">Log New Follow-up</h4>
      <Field label="How did you reach them?" layout="col" labelClassName={labelClassName}>
        <SelectBox options={CHANNEL_OPTIONS} value={draft.channel} onValueChange={setField('channel')} />
      </Field>
      <Field label="Communication Notes" layout="col" labelClassName={labelClassName}>
        <Textarea
          rows={4}
          value={draft.note}
          onChange={(event) => setField('note')(event.target.value)}
          placeholder="E.g. Spoke to Accounts Manager. They said cheque will be signed by Friday."
        />
      </Field>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
        <Field label="Promise to Pay (PTP) Date" layout="col" labelClassName={labelClassName}>
          <DateInput value={draft.promiseDate} onValueChange={setField('promiseDate')} />
        </Field>
        <Field label="Amount promised (₹)" layout="col" labelClassName={labelClassName}>
          <NumberInput value={draft.promiseAmount} onValueChange={setField('promiseAmount')} placeholder="blank = whole outstanding" />
        </Field>
      </div>
      <Button variant="default" size="lg" disabled={saving} onClick={onSave}>
        <MessageSquare /> {saving ? 'Saving...' : 'Save Follow-up Log'}
      </Button>
      <div className="tw:text-[11px] tw:text-muted-foreground">
        A Promise-to-Pay date feeds the &quot;Expected This Week&quot; figure at the top. Without one, that figure stays zero.
      </div>
    </div>
  );
}

function PromiseLine({ followUp, onMarkPromise }) {
  const state = PROMISE_STATES.find((candidate) => candidate.met === followUp.promiseMet);
  return (
    <div className={cn('tw:mt-1.5 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px] tw:font-bold', state ? state.className : 'tw:text-warning')}>
      <Calendar className="tw:size-3" /> Promised {dayFirst(followUp.promiseDate)}
      {followUp.promiseAmount ? ` for ₹ ${formatInr(followUp.promiseAmount)}` : ''}
      {state && ` · ${state.label}`}
      {followUp.promiseMet == null && PROMISE_STATES.map((option) => (
        <Button key={option.label} size="sm" variant="ghost" className={cn('tw:h-4 tw:border tw:px-1.5 tw:text-[10px] tw:font-normal', option.buttonClassName)} onClick={() => onMarkPromise(followUp.id, option.met)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function FollowUpEntry({ followUp, onMarkPromise }) {
  const Icon = CHANNEL_ICONS[followUp.channel] || PhoneCall;
  const isSystem = followUp.channel === 'SYSTEM';
  return (
    <div className="tw:relative">
      <div className={cn('tw:absolute tw:top-0 tw:-left-[25px] tw:flex tw:rounded-full tw:border-2 tw:bg-card tw:p-1', isSystem ? 'tw:border-muted-foreground tw:text-muted-foreground' : 'tw:border-primary tw:text-primary')}>
        <Icon className="tw:size-3" />
      </div>
      <div className="tw:text-entry tw:font-semibold tw:text-muted-foreground">
        {new Date(followUp.createdAt).toLocaleString('en-GB')} &middot; {followUp.channel}
        {followUp.createdByName ? ` · ${followUp.createdByName}` : ''}
      </div>
      <div className="tw:mt-1 tw:rounded-md tw:border tw:border-border tw:bg-page tw:p-2.5 tw:text-[13px] tw:whitespace-pre-wrap tw:text-foreground">{followUp.note}</div>
      {followUp.promiseDate && <PromiseLine followUp={followUp} onMarkPromise={onMarkPromise} />}
    </div>
  );
}

export default function FollowUpsTab({ draft, onDraftChange, saving, onSave, followUps, onMarkPromise }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-6 tw:md:flex-row">
      <FollowUpForm draft={draft} onDraftChange={onDraftChange} saving={saving} onSave={onSave} />
      <div className="tw:md:flex-[1.5] tw:md:border-l tw:md:border-border tw:md:pl-6">
        <h4 className="tw:m-0 tw:mb-4 tw:text-sm tw:text-foreground">Communication History</h4>
        {!followUps.length && <div className="tw:text-[13px] tw:text-muted-foreground">Nothing logged for this customer yet.</div>}
        <div className={cn('tw:flex tw:flex-col tw:gap-5 tw:pl-4', followUps.length > 0 && 'tw:ml-2 tw:border-l-2 tw:border-input')}>
          {followUps.map((followUp) => <FollowUpEntry key={followUp.id} followUp={followUp} onMarkPromise={onMarkPromise} />)}
        </div>
      </div>
    </div>
  );
}
