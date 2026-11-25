import { Bell, Clock, Loader2, PlayCircle, Save, Zap } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, StatCard } from '@/components/ui';
import { ChoiceButton, RadioDot } from '../ChoiceButton';
import { NOTIFY_MODES } from '../whatsappOptions';

const NOTIFY_MODE_ICONS = { instant: Zap, scheduled: Clock };

function ScheduledTime({ notifyTime, setNotifyTime }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-4 tw:py-3.5 tw:sm:flex-row tw:sm:items-center">
      <Clock className="tw:size-4.5 tw:shrink-0 tw:text-warning" />
      <div className="tw:flex tw:flex-col tw:gap-1">
        <span className="tw:text-[11px] tw:font-bold tw:text-warning">Send at (IST)</span>
        <Input type="time" value={notifyTime} onChange={(event) => setNotifyTime(event.target.value)} className="tw:h-8 tw:w-[140px] tw:text-base tw:font-bold tw:text-warning" />
      </div>
      <div className="tw:text-[11px] tw:leading-relaxed tw:text-warning">
        Every day at <b>{notifyTime}</b> IST, all pending AWB status<br />updates will be sent in a batch.
      </div>
    </div>
  );
}

function QueueStats({ queueStats, flushing, onFlush }) {
  const nothingPending = queueStats.pending === 0;
  return (
    <div className="tw:grid tw:grid-cols-2 tw:gap-2.5 tw:sm:flex">
      <StatCard label="Pending in Queue" value={queueStats.pending} tone="warning" className="tw:sm:flex-1" />
      <StatCard label="Sent Today" value={queueStats.sentToday} tone="success" className="tw:sm:flex-1" />
      {queueStats.failed > 0 && <StatCard label="Failed (5 tries)" value={queueStats.failed} tone="danger" title={queueStats.lastError || ''} className="tw:sm:flex-1" />}
      <Button variant="warning" onClick={onFlush} disabled={flushing || nothingPending} className="tw:h-auto tw:flex-col tw:gap-1 tw:px-4 tw:py-2.5 tw:[&_svg:not([class*=size-])]:size-4.5">
        {flushing ? <Loader2 className="tw:animate-spin" /> : <PlayCircle />}
        <span className="tw:text-[11px]">{flushing ? 'Sending...' : 'Send Now'}</span>
      </Button>
    </div>
  );
}

export default function NotificationModeSection({ ctx }) {
  const { flushing, handleFlushNow, handleSaveNotify, notifyMode, notifyTime, queueStats, savingNotify, setNotifyMode, setNotifyTime } = ctx;
  return (
    <Card>
      <CardHeader><CardTitle icon={<Bell className="tw:text-warning" />}>Client Status Notification Mode</CardTitle></CardHeader>
      <CardContent className="tw:gap-4">
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
          {NOTIFY_MODES.map((mode) => {
            const Icon = NOTIFY_MODE_ICONS[mode.id];
            const selected = notifyMode === mode.id;
            return (
              <ChoiceButton key={mode.id} selected={selected} onClick={() => setNotifyMode(mode.id)} className="tw:items-start tw:gap-3 tw:px-4 tw:py-3.5">
                <RadioDot selected={selected} />
                <span className="tw:flex tw:flex-col tw:gap-0.5">
                  <span className="tw:flex tw:items-center tw:gap-1.5 tw:font-bold tw:text-foreground"><Icon />{mode.label}</span>
                  <span className="tw:text-[11px] tw:text-muted-foreground">{mode.desc}</span>
                </span>
              </ChoiceButton>
            );
          })}
        </div>

        {notifyMode === 'scheduled' && <ScheduledTime notifyTime={notifyTime} setNotifyTime={setNotifyTime} />}

        <QueueStats queueStats={queueStats} flushing={flushing} onFlush={handleFlushNow} />

        {queueStats.lastError && <div className="tw:text-[11px] tw:text-destructive">Last send error: {queueStats.lastError}</div>}
        <Button variant="default" className="tw:self-start" onClick={handleSaveNotify} disabled={savingNotify}>
          {savingNotify ? <Loader2 className="tw:animate-spin" /> : <Save />}
          {savingNotify ? 'Saving...' : 'Save Notification Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
