import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { formatTimelineDate } from './timelineFormat';
import { accentOfMessage, statusOfMessage } from './timelineStatuses';
import { bubbleLook } from './timelineBubble';

// the job's own events (created / saved / ICEGATE / BE No / OOC), not remarks
function SystemEvent({ log }) {
  return (
    <div className="tw:max-w-[95%] tw:self-center tw:rounded-full tw:bg-muted tw:px-2.5 tw:py-0.5 tw:text-center tw:text-[11px] tw:text-muted-foreground">
      {log.message} · {formatTimelineDate(log.timestamp)}
    </div>
  );
}

export default function TimelineEntry({ log, statusRows, userName, onDelete }) {
  if (log.system) return <SystemEvent log={log} />;
  const isMe = String(log.author || '').toUpperCase() === String(userName).toUpperCase() || log.author === 'User';
  const status = statusOfMessage(statusRows, log.message);
  const look = bubbleLook(status, { isMe, accent: accentOfMessage(log.message) });
  const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const day = log.timestamp ? new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' }) : '';

  return (
    <div
      style={look.cssVariables}
      className={cn(
        'tw:relative tw:min-w-[60%] tw:max-w-[90%] tw:rounded-lg tw:bg-[color:var(--bubble-fill)] tw:px-3 tw:py-2 tw:text-[color:var(--bubble-ink)]',
        isMe ? 'tw:self-end tw:rounded-br-[2px]' : 'tw:self-start tw:rounded-bl-[2px]',
        look.className,
      )}
    >
      <div className="tw:mb-0.5 tw:flex tw:items-baseline tw:justify-between tw:gap-2">
        <strong className="tw:text-[10px] tw:uppercase">{log.author === 'User' ? userName : log.author}</strong>
        <span className={cn('tw:rounded-full tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:font-bold tw:tracking-wide',
          look.onColour ? 'tw:bg-white/25 tw:text-white' : 'tw:bg-[color:color-mix(in_srgb,var(--bubble-chip)_8%,transparent)]')}>
          {time}
        </span>
      </div>
      <div className={cn('tw:flex tw:items-end tw:justify-between tw:gap-2 tw:text-[13px] tw:leading-tight tw:break-words tw:normal-case', status && 'tw:font-semibold')}>
        <span>{log.eventType === 'STATUS' && <span className="tw:mr-1 tw:text-[10px] tw:opacity-70">STATUS:</span>}{log.message}</span>
        <span className="tw:flex tw:items-center tw:gap-1 tw:text-[9px] tw:whitespace-nowrap tw:opacity-80">
          {day}
          {isMe && log.id && (
            <Button variant="ghost" size="icon-sm" className="tw:size-4 tw:text-current" title="Delete this remark" onClick={() => onDelete(log)}>
              <Trash2 className="tw:size-3" />
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}
