import KeySeg from '@/components/common/KeySeg';
import { cn } from '@/lib/utils';

const SEGMENT_CLASSES = [
  'tw:inline-flex tw:h-[22px] tw:shrink-0 tw:overflow-hidden tw:rounded-sm tw:border tw:border-input tw:bg-background',
  'tw:[&>button]:m-0 tw:[&>button]:h-full tw:[&>button]:cursor-pointer tw:[&>button]:rounded-none tw:[&>button]:border-y-0 tw:[&>button]:border-l-0',
  'tw:[&>button]:border-r tw:[&>button]:border-border tw:[&>button]:bg-background tw:[&>button]:px-2 tw:[&>button]:text-[11px] tw:[&>button]:font-bold',
  'tw:[&>button]:text-muted-foreground tw:[&>button:last-child]:border-r-0',
  'tw:[&>button.on]:bg-primary tw:[&>button.on]:text-primary-foreground tw:[&>button:focus-visible]:relative tw:[&>button:focus-visible]:z-[1]',
  'tw:[&>button:focus-visible]:outline-2 tw:[&>button:focus-visible]:outline-ring',
].join(' ');

/** Segmented choice that works from the keyboard (one Tab stop, arrow keys or the first letter change it). */
export default function SegmentedChoice({ value, options, onChange, title, className }) {
  return <KeySeg className={cn(SEGMENT_CLASSES, className)} value={value} options={options} onChange={onChange} title={title} />;
}
