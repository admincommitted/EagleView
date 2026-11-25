import { cn } from '@/lib/utils';
import { bubbleLook } from '../../../TimelineDrawerParts/timelineBubble';

function PreviewBlock({ title, children }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:text-[11px] tw:font-bold tw:text-muted-foreground tw:uppercase">{title}</div>
      {children}
    </div>
  );
}

// the colour chip of a status, as the dashboards show it
export function StatusChip({ status, children }) {
  return (
    <span style={{ '--chip-fill': status.colorCode || '#e2e8f0', '--chip-ink': status.textColor || '#1e293b' }}
      className="tw:rounded-full tw:bg-(--chip-fill) tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-bold tw:text-(--chip-ink)">
      {children}
    </span>
  );
}

// the same look the job timeline gives a status entry (TimelineDrawerParts/TimelineEntry)
export default function StatusPreview({ status }) {
  const look = bubbleLook(status, { isMe: false });
  const label = status.code || 'STATUS_CODE';
  return (
    <div className="tw:flex tw:w-full tw:flex-col tw:gap-4 tw:border-dashed tw:border-border tw:pt-4 tw:md:border-l tw:md:pt-0 tw:md:pl-6">
      <PreviewBlock title="Dashboard Preview">
        <div className="tw:flex tw:items-start tw:justify-between tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3 tw:shadow-xs">
          <div className="tw:text-entry tw:font-bold tw:text-foreground">Job #12345</div>
          <StatusChip status={status}>{label}</StatusChip>
        </div>
      </PreviewBlock>

      <PreviewBlock title="Timeline Bubble Preview">
        <div style={look.cssVariables}
          className={cn('tw:relative tw:w-[90%] tw:self-start tw:rounded-lg tw:rounded-bl-[2px] tw:bg-[color:var(--bubble-fill)] tw:px-3 tw:py-2 tw:text-[color:var(--bubble-ink)]', look.className)}>
          <div className="tw:mb-0.5 tw:flex tw:items-baseline tw:justify-between tw:gap-2">
            <strong className="tw:text-[10px] tw:uppercase">ADMIN</strong>
            <span className={cn('tw:rounded-full tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:font-bold tw:tracking-wide',
              look.onColour ? 'tw:bg-white/25 tw:text-white' : 'tw:bg-[color:color-mix(in_srgb,var(--bubble-chip)_8%,transparent)]')}>
              10:30 AM
            </span>
          </div>
          <div className="tw:text-[13px] tw:font-semibold">{label}</div>
        </div>
      </PreviewBlock>
    </div>
  );
}
