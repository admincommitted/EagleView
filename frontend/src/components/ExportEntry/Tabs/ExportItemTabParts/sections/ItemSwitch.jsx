import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

/**
 * A Y/N switch of the item with its details window. Keyboard: Tab to it, then Y / N, Space switches, Enter opens the
 * details window. Switching to Y opens the window too.
 */
export default function ItemSwitch({ label, field, formData, handleFormChange, onOpen, count }) {
  const isOn = String(formData[field] || 'N').toUpperCase() === 'Y';
  const setSwitch = (answer) => {
    handleFormChange(field, answer);
    if (answer === 'Y' && onOpen) onOpen();
  };
  const handleKeyDown = (event) => {
    const key = event.key.toUpperCase();
    if (key === 'Y' || key === 'N') {
      event.preventDefault();
      if ((key === 'Y') !== isOn) setSwitch(key);
    } else if (event.key === 'Enter' && onOpen && isOn) {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <span className={cn('tw:inline-flex tw:h-[26px] tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:px-0.5', isOn ? 'tw:border-success/50 tw:bg-success/10' : 'tw:border-border tw:bg-background')}>
      <Button
        size="sm"
        variant={isOn ? 'default' : 'secondary'}
        className={cn('tw:h-5 tw:rounded-full tw:px-2 tw:text-[10.5px] tw:font-extrabold', isOn && 'tw:border-success tw:bg-success tw:hover:bg-success/85')}
        title={`${label}: ${isOn ? 'Yes' : 'No'} - Y / N keys, Space switches${onOpen ? ', Enter opens the details' : ''}`}
        onClick={() => setSwitch(isOn ? 'N' : 'Y')}
        onKeyDown={handleKeyDown}
      >
        <span className="tw:size-1.5 tw:rounded-full tw:bg-current tw:opacity-70" />
        {isOn ? 'Y' : 'N'}
      </Button>
      <span className="tw:whitespace-nowrap tw:pr-1 tw:text-[11px] tw:font-semibold tw:text-foreground" title={label}>{label}</span>
      {onOpen && (
        <Button size="sm" variant="outline" tabIndex={-1} className="tw:h-5 tw:min-w-[22px] tw:rounded-full tw:px-1.5 tw:font-extrabold tw:text-primary" title={`${label} details`} onClick={onOpen}>
          {count || '…'}
        </Button>
      )}
    </span>
  );
}
