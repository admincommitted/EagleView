import { RefreshCw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Label } from '@/components/ui';

export function StockField({ label, required, className, children }) {
  return (
    <Field label={label} required={required} labelWidth="120px" className={className} labelClassName="tw:font-bold tw:uppercase tw:md:justify-end">
      {children}
    </Field>
  );
}

// the digit boxes of one stock number, in a row that wraps on a phone
export function NumberRow({ children }) {
  return <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-wrap tw:items-center tw:gap-1">{children}</div>;
}

export function InlineLabel({ children, className }) {
  return <Label className={cn('tw:font-bold tw:uppercase tw:md:ml-3', className)}>{children}</Label>;
}

export function StockPanel({ title, children }) {
  return (
    <div className="tw:flex tw:flex-col tw:overflow-hidden tw:rounded-md tw:border tw:border-border tw:bg-card tw:shadow-sm">
      <div className="tw:border-b tw:border-l-[6px] tw:border-border tw:border-l-primary tw:bg-primary/10 tw:px-4 tw:py-1.5 tw:text-entry tw:font-bold tw:uppercase">{title}</div>
      <div className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:py-3">{children}</div>
    </div>
  );
}

export function ButtonBar({ children }) {
  return <div className="tw:mt-3 tw:flex tw:flex-wrap tw:justify-center tw:gap-3 tw:border-t tw:border-border tw:pt-3">{children}</div>;
}

// Save / Delete / Clear / Void and who is entering the stock - the same on the AWB and HAWB tabs
export function StockButtons({ onSave, onClear, changeStock, enteredBy, enteredDate }) {
  return (
    <>
      <ButtonBar>
        <Button variant="success" size="lg" onClick={onSave}><Save /> Save</Button>
        <Button variant="destructive" size="lg" title="Deletes the selected AVAILABLE rows in Query Detail" onClick={() => changeStock('delete', 'Delete')}><Trash2 /> Delete</Button>
        <Button variant="default" size="lg" onClick={onClear}><RefreshCw /> Clear</Button>
        <Button variant="destructive" size="lg" title="Voids the selected rows in Query Detail" onClick={() => changeStock('void', 'Void')}>Void</Button>
      </ButtonBar>
      <div className="tw:mt-1 tw:flex tw:flex-wrap tw:justify-center tw:gap-4">
        <Field label="Entered By" labelClassName="tw:font-bold tw:uppercase"><Input readOnly className="tw:md:w-[120px]" value={enteredBy} /></Field>
        <Field label="Entered Date" labelClassName="tw:font-bold tw:uppercase"><Input readOnly className="tw:md:w-[120px]" value={enteredDate} /></Field>
      </div>
    </>
  );
}
