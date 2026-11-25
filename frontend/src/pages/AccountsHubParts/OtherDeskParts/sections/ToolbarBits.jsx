import { Search } from 'lucide-react';
import { Input } from '@/components/ui';
import { cn } from '@/lib/utils';

export const ToolbarDivider = () => <span className="tw:mx-1 tw:h-[22px] tw:w-px tw:bg-border" />;

export function SearchInput({ value, onChange, placeholder, className }) {
  return (
    <div className={cn('tw:w-full tw:sm:w-auto', className)}>
      <Input data-allow-text leftIcon={Search} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
