import { Info } from 'lucide-react';
import { Button, Field, Input } from '@/components/ui';

export function OpenPopupButton({ onClick, title = 'Open the details window' }) {
  return (
    <Button variant="ghost" size="icon-sm" title={title} aria-label={title} onClick={onClick}>
      <Info />
    </Button>
  );
}

/**
 * A flag box of the item form. It is uncontrolled on purpose: SAVE / MODIFY read it from the form by its name and
 * the popups write 'Y' straight into it. Typing Y opens the popup.
 */
export default function PopupFlagField({ label, note, name, defaultValue, onOpen, required, labelWidth, className }) {
  const openOnY = (event) => {
    if (event.target.value.toUpperCase() === 'Y') onOpen();
  };
  return (
    <Field
      label={note ? <>{label} <span className="tw:text-muted-foreground">{note}</span></> : label}
      required={required}
      labelWidth={labelWidth}
      className={className}
    >
      <Input name={name} defaultValue={defaultValue} required={required} data-allow-text=""
        className="tw:w-10 tw:flex-none tw:px-0 tw:text-center" onChange={onOpen ? openOnY : undefined} />
      {onOpen && <OpenPopupButton onClick={onOpen} />}
    </Field>
  );
}
