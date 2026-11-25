import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui';

// FWB (IATA Cargo-IMP) free text: upper case letters, digits, space and . , - / only, in lines of a fixed length
const NOT_ALLOWED = /[^A-Z0-9\s.,\-/]/g;

const wrapLine = (line, width) => {
  if (line.length <= width) return [line];
  const parts = [];
  for (let start = 0; start < line.length; start += width) parts.push(line.substring(start, start + width));
  return parts;
};

const limitTotal = (lines, total) => {
  const kept = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length <= total) {
      kept.push(line);
      used += line.length + 1;
      continue;
    }
    const room = total - used;
    if (room > 0) kept.push(line.substring(0, room));
    break;
  }
  return kept;
};

export default function FWBTextArea({ maxLines = 3, maxCharsPerLine = 65, totalMaxChars, value, className, ...props }) {
  const [text, setText] = useState(value || '');

  useEffect(() => {
    if (value !== undefined) setText(value);
  }, [value]);

  const handleChange = (event) => {
    const cleaned = (event.target.value || '').toUpperCase().replace(NOT_ALLOWED, '');
    let lines = cleaned.split('\n').flatMap((line) => wrapLine(line, maxCharsPerLine));
    if (totalMaxChars) lines = limitTotal(lines, totalMaxChars);
    const fitted = lines.slice(0, maxLines).join('\n');
    setText(fitted);
    props.onChange?.({
      target: { value: fitted, name: props.name },
      preventDefault: () => event.preventDefault(),
      stopPropagation: () => event.stopPropagation(),
    });
  };

  const lineCount = text === '' ? 0 : text.split('\n').length;
  const counter = totalMaxChars
    ? `${text.length}/${totalMaxChars} Chars (Max ${maxLines} lines)`
    : `${lineCount}/${maxLines} lines (Max ${maxCharsPerLine} chars/line)`;

  return (
    <div className="tw:relative tw:mb-3.5 tw:w-full">
      <Textarea
        data-allow-text=""
        {...props}
        value={text}
        onChange={handleChange}
        wrap="off"
        className={cn('tw:overflow-x-hidden tw:whitespace-pre-wrap', className)}
        maxLength={totalMaxChars || (maxLines * maxCharsPerLine + (maxLines - 1))}
      />
      <div className="tw:absolute tw:right-0 tw:-bottom-[15px] tw:text-[10px] tw:font-bold tw:text-muted-foreground">{counter}</div>
    </div>
  );
}
