import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/** Attached files as links with a remove cross; `inline` lays them out as one wrapping row of chips. */
export default function AttachmentList({ docs, onRemove, showSize = false, inline = false, title, className }) {
  if (!docs.length) return null;
  return (
    <div className={cn('tw:rounded-md tw:border tw:border-border tw:p-2 tw:text-entry',
      inline ? 'tw:flex tw:flex-wrap tw:items-center tw:gap-3 tw:bg-page' : 'tw:flex tw:max-h-[110px] tw:flex-col tw:gap-0.5 tw:overflow-y-auto', className)}>
      {title && <b className="tw:text-muted-foreground">{title}</b>}
      {docs.map((doc) => (
        <span key={doc.id} className={cn('tw:flex tw:min-w-0 tw:items-center tw:gap-1.5', inline && 'tw:inline-flex')}>
          <a href={doc.filePath} target="_blank" rel="noreferrer" className={cn('tw:normal-case tw:text-primary tw:no-underline', !inline && 'tw:flex-1 tw:truncate')}>
            {doc.originalName}
          </a>
          {showSize && <span className="tw:text-muted-foreground">{Math.round((doc.size || 0) / 1024)} KB</span>}
          <Button variant="ghost" size="icon-sm" className="tw:size-4 tw:text-destructive" title="Remove" aria-label="Remove" onClick={() => onRemove(doc.id)}>
            <X />
          </Button>
        </span>
      ))}
    </div>
  );
}
