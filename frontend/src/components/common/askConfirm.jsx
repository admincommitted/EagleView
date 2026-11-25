// Question windows used in place of the browser's confirm() / prompt():
//
//   const goAhead = await askConfirm({ title, message, note, okLabel, cancelLabel, tone });   // true = the okLabel button
//   const text = await askText({ title, message, label, value, placeholder, choices, check, required, upper });   // null = Cancel
//
// The safe button has the focus, so a stray Enter does not go ahead. Esc, the X and a click outside the window give the
// safe answer. Only one window at a time: a question asked while one is open gets the safe answer at once (a double
// click on Save must not stack two windows). Each window is drawn in its own React root on <body>, so it also works
// outside the React tree and on top of an open dialog.
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { AlertTriangle, PenLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';

const TONES = {
  warn: { icon: 'tw:bg-warning/15 tw:text-warning', okVariant: 'warning' },
  danger: { icon: 'tw:bg-destructive/10 tw:text-destructive', okVariant: 'destructive' },
};

let windowOpen = false;

function NoteLines({ note }) {
  return (
    <div className="tw:grid tw:gap-1 tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-2.5 tw:py-2 tw:text-[11.5px] tw:leading-relaxed tw:text-muted-foreground">
      {String(note).split('\n').map((line, index) => {
        const colon = line.indexOf(': ');
        const hasName = colon > 0 && colon < 45;
        return (
          <div key={index}>
            {hasName ? <><b className="tw:text-foreground">{line.slice(0, colon)}</b>{line.slice(colon)}</> : line}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The frame of both windows: overlay, title row with icon and X, body, button row.
 * Radix keeps the layers of separate React roots in one shared stack, so a window opened over a ui Modal is the top
 * layer: it gets the clicks and the keyboard, and the Modal under it stays open.
 */
function AskWindow({ container, role = 'dialog', icon: Icon, iconClassName, title, onCancel, onSubmit, initialFocusRef, selectOnFocus, footer, children }) {
  const [focusedBefore] = useState(() => document.activeElement);

  useEffect(() => {
    // capture on window: the screens have their own Esc handlers (JSON preview, menus) - Esc only closes this window
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [onCancel]);

  const focusFirst = (event) => {
    event.preventDefault();
    const field = initialFocusRef.current;
    field?.focus();
    if (selectOnFocus) field?.select?.();
  };
  // the focus goes back to what had it - unless the next window is already open (two questions one after the other)
  const giveFocusBack = (event) => {
    event.preventDefault();
    if (!windowOpen) focusedBefore?.focus?.();
  };

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogPortal container={container}>
        <DialogOverlay />
        <DialogPrimitive.Content asChild role={role} onOpenAutoFocus={focusFirst} onCloseAutoFocus={giveFocusBack}>
          <form
            onSubmit={(event) => { event.preventDefault(); onSubmit?.(); }}
            className="tw:fixed tw:top-1/2 tw:left-1/2 tw:z-[3000] tw:m-0 tw:w-[470px] tw:max-w-[calc(100%-32px)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:overflow-hidden tw:rounded-lg tw:bg-background tw:text-foreground tw:normal-case tw:shadow-2xl tw:outline-none"
          >
            <div className="tw:flex tw:items-center tw:gap-2.5 tw:border-b tw:border-border tw:bg-page tw:px-3.5 tw:py-2.5">
              <span className={cn('tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full', iconClassName)}>
                <Icon className="tw:size-4" />
              </span>
              <DialogTitle className="tw:flex-1 tw:text-[14px] tw:font-bold">{title}</DialogTitle>
              <Button variant="ghost" size="icon" tabIndex={-1} aria-label="Close" onClick={onCancel}><X className="tw:size-[18px]" /></Button>
            </div>
            <div className="tw:grid tw:gap-2.5 tw:px-4 tw:pt-3.5 tw:pb-3">{children}</div>
            <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2 tw:border-t tw:border-border tw:bg-page tw:px-3.5 tw:py-2.5">{footer}</div>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function Message({ children }) {
  return <DialogDescription className="tw:text-[13px] tw:leading-normal tw:font-semibold tw:whitespace-pre-line tw:text-foreground">{children}</DialogDescription>;
}

function ConfirmWindow({ container, title, message, note, okLabel, cancelLabel, tone, onDone }) {
  const safeButtonRef = useRef(null);
  const toneStyle = TONES[tone] || TONES.warn;
  const answerSafe = () => onDone(false);
  return (
    <AskWindow
      container={container}
      role="alertdialog"
      icon={AlertTriangle}
      iconClassName={toneStyle.icon}
      title={title || 'Please confirm'}
      onCancel={answerSafe}
      initialFocusRef={safeButtonRef}
      footer={(
        <>
          <Button variant={toneStyle.okVariant} size="lg" className="tw:font-bold" onClick={() => onDone(true)}>{okLabel || 'OK'}</Button>
          <Button ref={safeButtonRef} variant="default" size="lg" className="tw:font-bold" onClick={answerSafe}>{cancelLabel || 'Cancel'}</Button>
        </>
      )}
    >
      <Message>{message}</Message>
      {note && <NoteLines note={note} />}
    </AskWindow>
  );
}

/** A list to pick one from: click picks, Up / Down / Home / End / Page Up / Page Down move, double-click answers. */
function ChoiceList({ id, choices, value, onValueChange, onPick, listRef, invalid }) {
  const index = choices.findIndex((choice) => String(choice.value) === value);
  const rows = Math.min(8, Math.max(3, choices.length));
  const moveTo = (nextIndex) => onValueChange(String(choices[Math.max(0, Math.min(choices.length - 1, nextIndex))].value));
  const keyMoves = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: choices.length - 1, PageDown: index + rows, PageUp: index - rows };

  const handleKeyDown = (event) => {
    if (!(event.key in keyMoves)) return;
    event.preventDefault();
    moveTo(keyMoves[event.key]);
  };

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [value, listRef]);

  return (
    <div
      id={id}
      ref={listRef}
      role="listbox"
      tabIndex={0}
      aria-activedescendant={index >= 0 ? `${id}-${index}` : undefined}
      onKeyDown={handleKeyDown}
      style={{ '--list-rows': rows }}
      className={cn(
        'tw:max-h-[calc(var(--list-rows)*24px+8px)] tw:overflow-y-auto tw:rounded-md tw:border tw:border-input tw:bg-background tw:p-1 tw:text-[13px] tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-2 tw:focus-visible:ring-ring/25',
        invalid && 'tw:border-destructive',
      )}
    >
      {choices.map((choice, choiceIndex) => (
        <div
          key={String(choice.value)}
          id={`${id}-${choiceIndex}`}
          role="option"
          aria-selected={choiceIndex === index}
          onClick={() => onValueChange(String(choice.value))}
          onDoubleClick={onPick}
          className={cn('tw:cursor-pointer tw:truncate tw:rounded-sm tw:px-1.5 tw:leading-6', choiceIndex === index ? 'tw:bg-primary tw:text-primary-foreground' : 'tw:hover:bg-accent')}
        >
          {choice.label || String(choice.value)}
        </div>
      ))}
    </div>
  );
}

/**
 * value = the text already in the box; choices = [{ value, label }] shows a list instead of a box;
 * check(text) returns '' or a message shown under the box (the window stays open); required: false lets OK take a blank.
 */
function TextWindow({ container, title, message, note, label, value, placeholder, okLabel, cancelLabel, required, choices, check, upper, onDone }) {
  const choiceList = Array.isArray(choices) && choices.length ? choices : null;
  const [text, setText] = useState(value !== undefined && value !== null ? String(value) : (choiceList ? String(choiceList[0].value) : ''));
  const [problem, setProblem] = useState('');
  const fieldRef = useRef(null);
  const cancel = () => onDone(null);

  const changeText = (nextText) => { setText(nextText); setProblem(''); };
  const submit = () => {
    const answer = String(text ?? '').trim();
    if (required !== false && !answer) { setProblem('Please fill this in'); return; }
    const checkProblem = typeof check === 'function' ? check(answer) : '';
    if (checkProblem) { setProblem(checkProblem); return; }
    onDone(answer);
  };

  return (
    <AskWindow
      container={container}
      icon={PenLine}
      iconClassName="tw:bg-primary/10 tw:text-primary"
      title={title || 'Please type'}
      onCancel={cancel}
      onSubmit={submit}
      initialFocusRef={fieldRef}
      selectOnFocus={!choiceList}
      footer={(
        <>
          <Button size="lg" className="tw:font-bold" onClick={cancel}>{cancelLabel || 'Cancel'}</Button>
          <Button type="submit" variant="default" size="lg" className="tw:font-bold">{okLabel || 'OK'}</Button>
        </>
      )}
    >
      {message ? <Message>{message}</Message> : <DialogDescription className="tw:sr-only">{title || 'Please type'}</DialogDescription>}
      <Field label={label || (choiceList ? 'Pick one' : 'Value')} layout="col" labelClassName="tw:mb-0.5 tw:text-[11.5px] tw:font-bold tw:text-muted-foreground">
        {choiceList ? (
          <ChoiceList choices={choiceList} value={text} onValueChange={changeText} onPick={submit} listRef={fieldRef} invalid={!!problem} />
        ) : (
          <Input
            ref={fieldRef}
            value={text}
            placeholder={placeholder || ''}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!problem}
            onChange={(event) => changeText(upper ? event.target.value.toUpperCase() : event.target.value)}
            className="tw:h-8 tw:rounded-md tw:px-2.5 tw:text-[13px]"
          />
        )}
      </Field>
      {problem && <div role="alert" className="tw:text-entry tw:font-semibold tw:text-destructive">{problem}</div>}
      {note && <div className="tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-2.5 tw:py-2 tw:text-[11.5px] tw:leading-relaxed tw:whitespace-pre-line tw:text-muted-foreground">{note}</div>}
    </AskWindow>
  );
}

// draws one window on <body>; resolves what the window answers (busyAnswer = the answer while another window is open)
function openWindow(Window, options, busyAnswer, toAnswer) {
  if (typeof document === 'undefined' || !document.body || windowOpen) return Promise.resolve(busyAnswer);
  windowOpen = true;
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.setAttribute('data-ask-confirm', '');
    // own stacking context above every window of the app (old screens use z-index up to 99999)
    host.className = 'tw:relative tw:z-[2147483600]';
    document.body.appendChild(host);
    const root = createRoot(host);
    let answered = false;
    const finish = (answer) => {
      if (answered) return;
      answered = true;
      setTimeout(() => { root.unmount(); host.remove(); }, 0);
      windowOpen = false;
      resolve(toAnswer(answer));
    };
    // drawn at once, so a second click on the button that asked lands on this window, not on the button
    flushSync(() => root.render(<Window {...options} container={host} onDone={finish} />));
  });
}

export default function askConfirm(options = {}) {
  return openWindow(ConfirmWindow, options, false, (answer) => !!answer);
}
export { askConfirm };

export function askText(options = {}) {
  return openWindow(TextWindow, options, null, (answer) => (answer === null || answer === undefined ? null : String(answer)));
}

// "X has changes that were not put in with MODIFY" before a job is saved / checked / built / filed.
// what = 'build the file', 'validate' ... ; back = the button that keeps the changes on the screen.
export function askUnsavedEdits(message, what, back = 'Go back to MODIFY') {
  const action = String(what || 'go ahead');
  const Action = action.charAt(0).toUpperCase() + action.slice(1);
  return askConfirm({
    title: 'Changes not put in',
    message,
    note: Action + ' anyway: uses the values already put in - the changes on the screen are left out.\n'
      + back + ': the changes stay on the screen - press ' + String(back).replace(/^go back to /i, '') + ' first, then ' + action + ' again.',
    okLabel: Action + ' anyway',
    cancelLabel: back,
  });
}
