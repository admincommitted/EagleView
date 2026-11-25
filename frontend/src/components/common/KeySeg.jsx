import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const asPairs = (options) => options.map((option) => (Array.isArray(option) ? option : [option, option]));
const startsWith = ([choice, label], letter) =>
  String(label).toUpperCase().startsWith(letter) || String(choice).toUpperCase().startsWith(letter);

// Segmented choice (FOB | CI | CIF | CF ...) for the keyboard: one Tab stop on the chosen option, arrows change it,
// a letter picks the next option that starts with it (C -> CI -> CIF -> CF).
// options: ['A', 'B'] or [['Y', 'Yes'], ['N', 'No']].
export default function KeySeg({ value, options, onChange, className, title, style, btnStyle }) {
  const choices = asPairs(options);
  const chosenIndex = choices.findIndex(([choice]) => choice === value);
  const tabStop = chosenIndex >= 0 ? chosenIndex : 0;
  const buttonRefs = useRef([]);

  const pick = (index) => {
    onChange(choices[index][0]);
    setTimeout(() => buttonRefs.current[index]?.focus(), 0);
  };

  const handleKeyDown = (event, index) => {
    const count = choices.length;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      pick((index + 1) % count);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      pick((index - 1 + count) % count);
      return;
    }
    if (event.key.length !== 1 || !/[a-z0-9%]/i.test(event.key) || event.ctrlKey || event.altKey) return;
    const letter = event.key.toUpperCase();
    for (let step = 1; step <= count; step++) {
      const next = (index + step) % count;
      if (startsWith(choices[next], letter)) {
        event.preventDefault();
        pick(next);
        return;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      title={title}
      style={style}
      className={cn('tw:inline-flex tw:h-[26px] tw:shrink-0 tw:overflow-hidden tw:rounded-sm tw:border tw:border-input tw:bg-background', className)}
    >
      {choices.map(([choice, label], index) => (
        <Button
          key={choice}
          ref={(element) => { buttonRefs.current[index] = element; }}
          variant="ghost"
          role="radio"
          aria-checked={choice === value}
          tabIndex={index === tabStop ? 0 : -1}
          style={btnStyle}
          className={cn(
            'tw:h-full tw:rounded-none tw:border-y-0 tw:border-l-0 tw:border-r tw:border-r-border tw:px-2.5 tw:font-bold tw:text-muted-foreground tw:last:border-r-0',
            'tw:aria-checked:bg-primary tw:aria-checked:text-primary-foreground tw:aria-checked:hover:bg-primary/85',
            choice === value && 'on'
          )}
          onClick={() => onChange(choice)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
