import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui';

const toNumber = (value) => (value ? parseInt(value, 10) : null);

const fitLines = (text, lineLimit, charLimit) => {
  let lines = text.split('\n');
  if (lineLimit && lines.length > lineLimit) lines = lines.slice(0, lineLimit);
  if (charLimit) lines = lines.map((line) => line.substring(0, charLimit));
  return lines.join('\n');
};

export default function CharCountTextarea({ maxLength, maxLines, maxCharsPerLine, value, onChange, defaultValue, className, style, ...props }) {
  const isControlled = value !== undefined;
  const [text, setText] = useState(isControlled ? value : (defaultValue || ''));
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isControlled) setText(value);
  }, [value, isControlled]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [text]);

  const lineLimit = toNumber(maxLines);
  const charLimit = toNumber(maxCharsPerLine);
  const totalLimit = toNumber(maxLength) ?? (lineLimit && charLimit ? lineLimit * charLimit : null);

  const handleChange = (event) => {
    if (lineLimit || charLimit) {
      const fitted = fitLines(event.target.value, lineLimit, charLimit);
      if (fitted !== event.target.value) event.target.value = fitted;
    }
    setText(event.target.value);
    onChange?.(event);
  };

  const length = text ? String(text).length : 0;
  const remaining = totalLimit ? totalLimit - length : null;
  const lineCount = text === '' ? 1 : String(text).split('\n').length;
  let counter = remaining !== null ? `${remaining} chars left` : '';
  if (maxLines && maxCharsPerLine) counter = `${lineCount}/${maxLines} lines | ${remaining} chars left`;

  return (
    <div className="tw:relative tw:flex tw:w-full tw:flex-col">
      <Textarea
        ref={textareaRef}
        maxLength={totalLimit || undefined}
        value={text}
        onChange={handleChange}
        className={cn('tw:min-h-[72px] tw:resize-none tw:overflow-hidden', counter && 'tw:pb-5', className)}
        style={style}
        {...props}
      />
      {counter && (
        <span className={cn('tw:pointer-events-none tw:absolute tw:bottom-1.5 tw:left-2 tw:text-[9px]', remaining < 20 ? 'tw:text-destructive' : 'tw:text-muted-foreground')}>
          {counter}
        </span>
      )}
    </div>
  );
}
