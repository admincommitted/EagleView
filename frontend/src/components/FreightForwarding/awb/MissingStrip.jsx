// "What is still to fill" line for the three AWB screens.
// It reads the screen: every must-fill box (red border, or a ui box marked required) that is still empty is listed by
// its label; a click on a name puts the cursor in that box. The full e-AWB check is still VALIDATE EDI ("Full check").
// Nothing is saved or changed by this line.
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

const RED_BORDER = /rgb\(239, 68, 68\)|#ef4444/i;
const SCAN_EVERY_MS = 1200;
const SHOWN_NAMES = 6;
const LABEL_SEARCH_DEPTH = 4;

// a ui box carries data-required itself; a box inside RequiredBox gets it from the wrapper
const isMustFill = (element) => element.getAttribute('data-required') === 'true'
  || Boolean(element.closest('[data-required="true"]'))
  || RED_BORDER.test(element.getAttribute('style') || '');

function nearestLabelText(element) {
  let label = null;
  for (let node = element.parentElement, depth = 0; node && depth < LABEL_SEARCH_DEPTH && !label; node = node.parentElement, depth++) {
    label = node.querySelector(':scope > label, :scope > span > label');
  }
  if (label) return label.textContent;
  const cell = element.closest('div');
  if (cell && cell.previousElementSibling && cell.previousElementSibling.tagName === 'LABEL') return cell.previousElementSibling.textContent;
  return element.getAttribute('placeholder') || element.getAttribute('name') || 'Box';
}

function labelOf(element) {
  let label = String(nearestLabelText(element)).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (/^prefi/i.test(label) || /digit no/i.test(label)) label = /create-hawb/.test(window.location.pathname) ? 'MAWB No' : 'AWB No';
  if (/DEL001/i.test(label)) label = 'HAWB No';
  const party = element.closest('.party-row-container');
  if (party && party.getAttribute('data-title')) label = party.getAttribute('data-title') + ' ' + label.toLowerCase();
  return label;
}

function findEmptyMustFillBoxes() {
  const root = document.querySelector('.main-content') || document;
  const boxes = [];
  root.querySelectorAll('input, select, textarea').forEach((element) => {
    if (element.disabled || element.readOnly || ['checkbox', 'radio', 'hidden'].includes(element.type)) return;
    if (!element.offsetParent || !isMustFill(element)) return;
    if (String(element.value || '').trim() !== '') return;
    const label = labelOf(element);
    if (!boxes.some((box) => box.label === label)) boxes.push({ label, element });
  });
  return boxes;
}

const linkClass = 'tw:h-auto tw:px-0 tw:text-[11px] tw:font-semibold tw:whitespace-nowrap';

export default function MissingStrip({ ctx, align }) {
  const [boxes, setBoxes] = useState([]);
  const lastKeyRef = useRef('');

  useEffect(() => {
    const refresh = () => {
      const found = findEmptyMustFillBoxes();
      const key = found.map((box) => box.label).join('|');
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      setBoxes(found);
    };
    refresh();
    const timer = setInterval(refresh, SCAN_EVERY_MS);
    return () => clearInterval(timer);
  }, []);

  const goTo = (label) => {
    const box = findEmptyMustFillBoxes().find((found) => found.label === label);
    if (!box) return;
    box.element.scrollIntoView({ block: 'center' });
    box.element.focus();
  };

  const shown = boxes.slice(0, SHOWN_NAMES);
  return (
    <div
      className={cn(
        'awb-missing tw:flex tw:flex-wrap tw:items-center tw:gap-x-2 tw:gap-y-0.5 tw:text-[11px] tw:leading-normal tw:normal-case',
        align === 'flex-start' ? 'tw:justify-start' : align === 'center' ? 'tw:justify-center' : 'tw:justify-end',
      )}
    >
      {boxes.length === 0
        ? <span className="tw:font-semibold tw:text-success">Must-fill boxes are filled</span>
        : (
          <>
            <span className="tw:font-bold tw:text-destructive">{boxes.length} to fill:</span>
            {shown.map((box) => (
              <Button key={box.label} variant="link" tabIndex={-1} title={'Go to ' + box.label} onClick={() => goTo(box.label)} className={cn(linkClass, 'tw:text-destructive tw:underline')}>
                {box.label}
              </Button>
            ))}
            {boxes.length > shown.length && <span className="tw:text-destructive">+{boxes.length - shown.length} more</span>}
          </>
        )}
      <Button variant="link" tabIndex={-1} onClick={() => ctx?.runIataValidation?.()} title="Full e-AWB check (same as VALIDATE EDI)" className={linkClass}>
        Full check
      </Button>
    </div>
  );
}
