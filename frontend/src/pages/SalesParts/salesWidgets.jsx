import { Badge, Card, CardContent, CardHeader, CardTitle, Checkbox, Field, Label } from '@/components/ui';
import { cn } from '@/lib/utils';
import { dmy } from './salesFormat';

const CUSTOMER_STATUS = { PROSPECT: 'info', ACTIVE: 'success', ON_HOLD: 'warning', LOST: 'neutral', BLOCKED: 'danger' };
const BILLING_ACTIVITY = {
  ACTIVE: { variant: 'success', label: 'Billing' },
  SLOWING: { variant: 'warning', label: 'Slowing' },
  DORMANT: { variant: 'danger', label: 'Dormant' },
  NONE: { variant: 'neutral', label: 'Not billed' },
};
export function StatusBadge({ status, label }) {
  return <Badge variant={CUSTOMER_STATUS[status] || 'neutral'}>{label || status}</Badge>;
}

export function ActivityBadge({ activity, lastBill }) {
  const shown = BILLING_ACTIVITY[activity] || BILLING_ACTIVITY.NONE;
  return <Badge variant={shown.variant} title={lastBill ? `Last bill ${dmy(lastBill)}` : 'No sales bill since last year'}>{shown.label}</Badge>;
}

export function DealBadge({ status, variants, labels }) {
  return <Badge variant={variants[status] || 'neutral'}>{labels?.[status] || status}</Badge>;
}

const SPAN = { 2: 'tw:sm:col-span-2', 3: 'tw:sm:col-span-2 tw:lg:col-span-3' };

export function FormField({ span, className, ...props }) {
  return <Field layout="col" labelClassName="tw:whitespace-normal" className={cn(SPAN[span], className)} {...props} />;
}

export function Muted({ className, children }) {
  return <div className={cn('tw:text-[11px] tw:text-muted-foreground', className)}>{children}</div>;
}

const NOTICE_TONES = {
  info: 'tw:border-primary/25 tw:bg-primary/10 tw:text-head',
  warning: 'tw:border-warning/30 tw:bg-warning/10 tw:text-warning',
  danger: 'tw:border-destructive/30 tw:bg-destructive/10 tw:text-destructive',
  neutral: 'tw:border-border tw:bg-muted tw:text-muted-foreground',
};

export function Notice({ tone = 'info', className, children, ...props }) {
  return <div className={cn('tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry', NOTICE_TONES[tone], className)} {...props}>{children}</div>;
}

const splitCodes = (value) => new Set((Array.isArray(value) ? value : String(value || '').split(',')).map((code) => code.trim()).filter(Boolean));

/** Tick boxes for picking several codes; options are [code, label] pairs, onChange gets the ticked codes. */
export function CheckGrid({ label, options, value, onChange, disabled }) {
  const ticked = splitCodes(value);
  const toggle = (code) => {
    const next = new Set(ticked);
    if (next.has(code)) next.delete(code); else next.add(code);
    onChange([...next]);
  };
  return (
    <div className="tw:flex tw:flex-col tw:gap-1">
      {label && <Label className="tw:whitespace-normal tw:font-semibold tw:text-muted-foreground">{label}</Label>}
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(min(180px,100%),1fr))] tw:gap-x-2.5 tw:gap-y-1">
        {options.map(([code, text]) => (
          <Label key={code} className={cn('tw:cursor-pointer tw:whitespace-normal', !ticked.has(code) && 'tw:text-muted-foreground')}>
            <Checkbox disabled={disabled} checked={ticked.has(code)} onCheckedChange={() => toggle(code)} />
            {text}
          </Label>
        ))}
      </div>
    </div>
  );
}

export function CheckLabel({ checked, onCheckedChange, disabled, children }) {
  return (
    <Label className="tw:cursor-pointer tw:whitespace-normal">
      <Checkbox checked={Boolean(checked)} onCheckedChange={(value) => onCheckedChange(value === true)} disabled={disabled} />
      {children}
    </Label>
  );
}

const TONES = {
  blue: { edge: 'tw:border-b-primary', icon: 'tw:bg-primary/10 tw:text-primary', tint: 'tw:bg-primary/5', value: 'tw:text-primary' },
  violet: { edge: 'tw:border-b-violet-600', icon: 'tw:bg-violet-600/10 tw:text-violet-600', tint: 'tw:bg-violet-600/5', value: 'tw:text-violet-600' },
  green: { edge: 'tw:border-b-success', icon: 'tw:bg-success/10 tw:text-success', tint: 'tw:bg-success/5', value: 'tw:text-success' },
  red: { edge: 'tw:border-b-destructive', icon: 'tw:bg-destructive/10 tw:text-destructive', tint: 'tw:bg-destructive/5', value: 'tw:text-destructive' },
  amber: { edge: 'tw:border-b-warning', icon: 'tw:bg-warning/10 tw:text-warning', tint: 'tw:bg-warning/5', value: 'tw:text-warning' },
  cyan: { edge: 'tw:border-b-cyan-600', icon: 'tw:bg-cyan-600/10 tw:text-cyan-600', tint: 'tw:bg-cyan-600/5', value: 'tw:text-cyan-600' },
  slate: { edge: 'tw:border-b-muted-foreground', icon: 'tw:bg-muted tw:text-muted-foreground', tint: 'tw:bg-muted', value: 'tw:text-muted-foreground' },
  pink: { edge: 'tw:border-b-pink-600', icon: 'tw:bg-pink-600/10 tw:text-pink-600', tint: 'tw:bg-pink-600/5', value: 'tw:text-pink-600' },
};

const toneOf = (tone) => TONES[tone] || TONES.blue;

export function IconBadge({ icon: Icon, tone, compact }) {
  return (
    <span aria-hidden="true" className={cn('tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full', compact ? 'tw:size-7' : 'tw:size-[34px]', toneOf(tone).icon)}>
      <Icon className={compact ? 'tw:size-3.5' : 'tw:size-4'} />
    </span>
  );
}

/** A figure: label, big value, icon in its colour, coloured bottom edge; clickable when it opens a list. */
export function KpiCard({ label, value, icon, tone = 'blue', tint, alert, compact, onClick, title, children }) {
  const colors = toneOf(tone);
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={(event) => onClick && (event.key === 'Enter' || event.key === ' ') && onClick()}
      className={cn(
        'tw:gap-0.5 tw:rounded-xl tw:border-b-4 tw:outline-none',
        compact ? 'tw:px-3 tw:py-2.5' : 'tw:px-4 tw:py-3.5',
        colors.edge,
        tint && colors.tint,
        onClick && 'tw:cursor-pointer tw:transition tw:hover:-translate-y-0.5 tw:focus-visible:ring-2 tw:focus-visible:ring-ring/40 tw:motion-reduce:transition-none tw:motion-reduce:hover:translate-y-0'
      )}
    >
      <div className="tw:flex tw:items-start tw:gap-2">
        <span className={cn('tw:min-w-0 tw:flex-1 tw:text-[11px] tw:font-bold tw:text-muted-foreground', compact ? 'tw:pt-1' : 'tw:pt-1.5')}>{label}</span>
        {icon && <IconBadge icon={icon} tone={tone} compact={compact} />}
      </div>
      <div className={cn('tw:leading-tight tw:font-extrabold tw:tabular-nums', compact ? 'tw:text-xl' : 'tw:text-2xl', alert ? colors.value : 'tw:text-foreground')}>{value}</div>
      {children && <div className="tw:flex tw:flex-col tw:gap-0.5 tw:text-[11.5px] tw:text-muted-foreground">{children}</div>}
    </Card>
  );
}

/** A panel with a coloured icon in its heading. */
export function Panel({ title, icon, tone = 'blue', actions, flush, className, children }) {
  return (
    <Card className={cn('tw:overflow-hidden tw:rounded-xl', className)}>
      <CardHeader className="tw:flex-wrap tw:justify-start tw:gap-2.5 tw:border-b tw:border-border tw:px-3.5 tw:py-2.5">
        {icon && <IconBadge icon={icon} tone={tone} compact />}
        <CardTitle className="tw:text-[13px] tw:font-extrabold tw:text-foreground">{title}</CardTitle>
        {actions && <div className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-1">{actions}</div>}
      </CardHeader>
      <CardContent className={cn('tw:min-h-0 tw:flex-1', flush ? 'tw:p-0' : 'tw:px-3.5 tw:py-3')}>{children}</CardContent>
    </Card>
  );
}

/** A form block (white box with a heading and optional buttons on the right). */
export function FormSection({ title, actions, className, children }) {
  return (
    <Card className={cn('tw:mb-2.5', className)}>
      <CardHeader className="tw:flex-wrap tw:rounded-t-lg tw:border-b tw:border-border tw:bg-page tw:py-1.5">
        <CardTitle>{title}</CardTitle>
        {actions && <div className="tw:ml-auto tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">{actions}</div>}
      </CardHeader>
      <CardContent className="tw:pt-2.5">{children}</CardContent>
    </Card>
  );
}

export function FigureTile({ label, value, note }) {
  return (
    <div className="tw:rounded-md tw:border tw:border-border tw:bg-card tw:px-2.5 tw:py-2">
      <Muted>{label}</Muted>
      <div className="tw:text-base tw:font-extrabold tw:text-foreground tw:tabular-nums">{value}</div>
      {note && <Muted>{note}</Muted>}
    </div>
  );
}
