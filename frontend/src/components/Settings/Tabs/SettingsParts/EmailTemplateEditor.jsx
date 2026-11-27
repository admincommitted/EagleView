import { useState } from 'react';
import { Clock, Eye, Loader2, Save, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Card, Field, HtmlPreview, Input, Label, Switch, Textarea } from '@/components/ui';
import { EMAIL_TYPES, fillWithSample, PREVIEW_FOOTER, PREVIEW_HEADER, SUBJECT_VARIABLES } from './emailTemplates';

const NOTIFY_MODES = [
  { id: 'instant', icon: Zap, label: 'Instant', desc: 'Send immediately' },
  { id: 'scheduled', icon: Clock, label: 'Scheduled', desc: 'Send at a set time' },
];

const panelClass = 'tw:gap-2 tw:px-4 tw:py-3.5';
const captionClass = 'tw:text-[11px] tw:font-bold tw:uppercase tw:text-muted-foreground';

/** The list of e-mail kinds on the left; a green dot marks the switched-on ones. */
export function EmailTypeList({ activeType, typeConfig, onPick }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      {EMAIL_TYPES.map((type) => {
        const active = activeType === type.id;
        const Icon = type.icon;
        return (
          <Button key={type.id} variant="ghost" size="block" onClick={() => onPick(type.id)}
            className={cn('tw:gap-2.5 tw:rounded-lg tw:border-input tw:border-l-4 tw:border-l-transparent tw:bg-card',
              active && 'tw:border-primary tw:border-l-primary tw:bg-accent')}>
            <Icon className={cn('tw:size-4', type.iconClassName)} />
            <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
              <span className={cn('tw:text-entry tw:font-bold', active ? 'tw:text-primary' : 'tw:text-foreground')}>{type.label}</span>
              <span className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{type.desc}</span>
            </span>
            <span className={cn('tw:size-2 tw:shrink-0 tw:rounded-full', typeConfig[type.id]?.enabled ? 'tw:bg-success' : 'tw:bg-border')} />
          </Button>
        );
      })}
    </div>
  );
}

function EmailPreview({ config }) {
  return (
    <div className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:bg-white">
      <div className="tw:border-b tw:border-border tw:bg-page tw:px-3 tw:py-2 tw:text-[11px]">
        <span className="tw:font-semibold tw:text-muted-foreground">Subject: </span>
        <span className="tw:font-bold tw:text-foreground">{fillWithSample(config.subject || '')}</span>
      </div>
      <HtmlPreview title="E-mail preview" html={PREVIEW_HEADER + fillWithSample(config.body || '') + PREVIEW_FOOTER} />
      <div className="tw:border-t tw:border-border tw:bg-page tw:px-3 tw:py-1.5 tw:text-center tw:text-[10px] tw:text-muted-foreground">
        Sample preview with dummy data
      </div>
    </div>
  );
}

/** Subject, sending mode and HTML body of one e-mail kind, with a live preview. */
export function EmailTemplateEditor({ type, config, onChange, onSave, saving }) {
  const [showPreview, setShowPreview] = useState(true);
  const Icon = type.icon;

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-3">
      <Card className="tw:flex-row tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:gap-2.5">
          <Icon className={cn('tw:size-4', type.iconClassName)} />
          <div>
            <div className="tw:text-[13px] tw:font-bold">{type.label}</div>
            <div className="tw:text-[11px] tw:text-muted-foreground">{type.desc}</div>
          </div>
        </div>
        <Label className="tw:cursor-pointer tw:gap-2 tw:font-semibold tw:text-muted-foreground">
          Enabled
          <Switch checked={Boolean(config.enabled)} onCheckedChange={(checked) => onChange('enabled', checked)} />
        </Label>
      </Card>

      <Card className={panelClass}>
        <Field layout="col" label="Email Subject" labelClassName={captionClass}>
          <Input data-allow-text="" value={config.subject || ''} onChange={(event) => onChange('subject', event.target.value)} placeholder="Email subject..." />
        </Field>
        <p className="tw:m-0 tw:flex tw:flex-wrap tw:items-center tw:gap-1 tw:text-[11px] tw:text-muted-foreground">
          Variables: {SUBJECT_VARIABLES.map((variable) => <code key={variable} className="tw:rounded-sm tw:bg-secondary tw:px-1 tw:text-[10px]">{variable}</code>)}
        </p>
      </Card>

      <Card className={panelClass}>
        <span className={captionClass}>Notification Mode</span>
        <div className="tw:flex tw:flex-col tw:gap-2.5 tw:md:flex-row">
          {NOTIFY_MODES.map((mode) => {
            const ModeIcon = mode.icon;
            const chosen = config.notifyMode === mode.id;
            return (
              <Button key={mode.id} variant="ghost" size="block" aria-pressed={chosen} onClick={() => onChange('notifyMode', mode.id)}
                className={cn('tw:flex-1 tw:gap-2 tw:rounded-lg tw:border-input tw:bg-page', chosen && 'tw:border-primary tw:bg-accent')}>
                <span className={cn('tw:flex tw:items-center tw:gap-1 tw:font-bold', chosen ? 'tw:text-primary' : 'tw:text-foreground')}><ModeIcon /> {mode.label}</span>
                <span className="tw:text-[11px] tw:text-muted-foreground">{mode.desc}</span>
              </Button>
            );
          })}
          {config.notifyMode === 'scheduled' && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-warning/40 tw:bg-warning/10 tw:px-3 tw:py-2 tw:text-warning">
              <Clock className="tw:size-3.5" />
              <Input type="time" className="tw:w-[120px] tw:font-bold" value={config.notifyTime || '09:00'} onChange={(event) => onChange('notifyTime', event.target.value)} />
              <span className="tw:text-[11px]">IST</span>
            </div>
          )}
        </div>
      </Card>

      <Card className={panelClass}>
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span className={captionClass}>Email Body (HTML)</span>
          <Button size="sm" onClick={() => setShowPreview(!showPreview)}><Eye /> {showPreview ? 'Hide' : 'Show'} Preview</Button>
        </div>
        <div className={cn('tw:grid tw:grid-cols-1 tw:gap-3', showPreview && 'tw:md:grid-cols-2')}>
          <Field layout="col" label="✏️ HTML Editor" labelClassName={captionClass}>
            <Textarea data-allow-text="" rows={14} className="tw:font-mono tw:text-[11px] tw:leading-relaxed tw:normal-case"
              value={config.body || ''} onChange={(event) => onChange('body', event.target.value)} />
          </Field>
          {showPreview && (
            <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
              <span className={captionClass}>📧 Email Preview</span>
              <EmailPreview config={config} />
            </div>
          )}
        </div>
        <div className="tw:mt-1 tw:flex tw:flex-wrap tw:gap-2">
          <Button variant="default" size="lg" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="tw:animate-spin" /> : <Save />}{saving ? 'Saving...' : 'Save This Template'}
          </Button>
          <Button size="lg" onClick={() => onChange('body', type.defaultBody || '')}>Reset to Default</Button>
        </div>
      </Card>
    </div>
  );
}
