import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function BrandLogo({ className }) {
  return (
    <Link to="/dashboard" aria-label="EagleView 360 - Dashboard"
      className={cn('tw:flex tw:shrink-0 tw:items-center tw:gap-1.5 tw:text-[1.4rem] tw:leading-none tw:font-black tw:tracking-[-0.5px] tw:text-white tw:normal-case tw:no-underline', className)}>
      EagleView
      <span className="tw:rounded-lg tw:border tw:border-white/40 tw:bg-[linear-gradient(135deg,rgba(255,255,255,0.3),rgba(255,255,255,0.05))] tw:px-2 tw:py-0.5 tw:text-[1.1rem]">
        360
      </span>
    </Link>
  );
}
