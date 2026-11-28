import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ComboInput, DateInput, Field, Input, SelectBox, Sheet, SheetContent, Textarea } from '@/components/ui';

export function AwbCard({ icon: Icon, title, actions, className, children }) {
  return (
    <section className={cn('tw:relative tw:mb-6 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4 tw:transition-[translate,box-shadow] tw:duration-200 tw:hover:-translate-y-0.5 tw:md:p-6', className)}>
      {title && (
        <div className="tw:-mx-2 tw:-mt-2 tw:mb-5 tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:border-primary/15 tw:bg-primary/5 tw:px-4 tw:py-3 tw:text-sm tw:font-bold tw:text-primary tw:uppercase">
          <div className="tw:flex tw:items-center tw:gap-2">{Icon && <Icon className="tw:size-[18px]" />}{title}</div>
          {actions ?? <ChevronDown className="tw:size-[18px] tw:text-muted-foreground/60" />}
        </div>
      )}
      {children}
    </section>
  );
}

export const SubHeading = ({ className, children }) => (
  <div className={cn('tw:mb-4 tw:text-xs tw:font-bold tw:text-foreground tw:uppercase', className)}>{children}</div>
);

// A combo box whose text is a react-hook-form value
export function FormCombo({ ctx, name, ...props }) {
  return <ComboInput value={ctx.watch(name) || ''} onValueChange={(text) => ctx.setValue(name, text)} {...props} />;
}

export function UnitInput({ unit, className, ...props }) {
  return (
    <div className="tw:relative tw:w-full">
      <Input className={cn('tw:pr-8', className)} {...props} />
      <span className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:right-2.5 tw:-translate-y-1/2 tw:text-xs tw:text-muted-foreground">{unit}</span>
    </div>
  );
}

export function IconInput({ icon: Icon, className, ...props }) {
  return (
    <div className="tw:relative tw:w-full">
      <Input className={cn('tw:cursor-pointer tw:pr-8', className)} {...props} />
      <Icon className="tw:pointer-events-none tw:absolute tw:top-1/2 tw:right-2.5 tw:size-4 tw:-translate-y-1/2 tw:text-primary" />
    </div>
  );
}

// Boxes of this screen that are not saved with the AWB keep their own value.
export function LooseSelect({ options, defaultValue = '', ...props }) {
  const [value, setValue] = useState(defaultValue);
  return <SelectBox options={options} value={value} onValueChange={setValue} {...props} />;
}

function LooseDate(props) {
  const [value, setValue] = useState('');
  return <DateInput value={value} onValueChange={setValue} {...props} />;
}

const LOOSE_CONTROLS = {
  input: ({ field }) => <Input data-allow-text required={field.required} defaultValue={field.defaultValue} placeholder={field.placeholder} className={field.className} />,
  textarea: ({ field }) => <Textarea defaultValue={field.defaultValue} placeholder={field.placeholder} className={field.className} />,
  select: ({ field }) => <LooseSelect options={field.options || []} placeholder={field.placeholder} required={field.required} className="tw:w-full" />,
  date: () => <LooseDate />,
};

// fields: [{ label, required, kind: 'input' | 'textarea' | 'select' | 'date', defaultValue, placeholder, wide }]
export function LooseFields({ fields }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
      {fields.map((field, index) => {
        const Control = LOOSE_CONTROLS[field.kind || 'input'];
        return (
          <Field key={field.label || index} layout="col" label={field.label} required={field.required} className={field.wide ? 'tw:sm:col-span-2' : undefined}>
            <Control field={field} />
          </Field>
        );
      })}
    </div>
  );
}

export function AwbDrawer({ open, title, onClose, onConfirm, confirmLabel, className, children }) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent side="right" title={title} className={cn('tw:w-full tw:sm:w-[550px]', className)} onInteractOutside={(event) => event.preventDefault()}>
        <div className="tw:flex tw:min-h-full tw:flex-col">
          <div className="tw:flex-1 tw:p-5">{children}</div>
          {onConfirm && (
            <div className="tw:sticky tw:bottom-0 tw:flex tw:gap-2.5 tw:border-t tw:border-border tw:bg-background tw:p-4">
              <Button variant="default" size="lg" onClick={onConfirm}>{confirmLabel}</Button>
              <Button size="lg" onClick={onClose}>Cancel</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// these wrap a box the floating Field label can sit in
LooseSelect.floatsLabel = true;
FormCombo.floatsLabel = true;
UnitInput.floatsLabel = true;
