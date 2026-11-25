import { cn } from '@/lib/utils';

export default function BookingHeading({ className, children }) {
  return <h4 className={cn('tw:mt-0 tw:mb-4 tw:border-b tw:border-primary/15 tw:pb-2 tw:text-head', className)}>{children}</h4>;
}
