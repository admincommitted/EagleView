import { cn } from '@/lib/utils';

const TONES = {
  warn: 'tw:border-warning/40 tw:bg-warning/10 tw:text-warning',
  info: 'tw:border-primary/30 tw:bg-primary/10 tw:text-head',
  ok: 'tw:border-success/40 tw:bg-success/10 tw:text-foreground',
};

// coloured note strip above / below a form (modifying, reverse charge, OCR result ...)
export function Notice({ tone = 'warn', className, children }) {
  return (
    <div className={cn('tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-entry tw:font-semibold tw:normal-case', TONES[tone], className)}>
      {children}
    </div>
  );
}
