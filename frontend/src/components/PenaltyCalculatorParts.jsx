// Shared layout of the import and export penalty calculators: dates / free days on the left, the exposure on the right.
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateInput, Field, Modal, NumberInput } from '@/components/ui';

const TONES = {
  danger: { text: 'tw:text-destructive', border: 'tw:border-l-destructive' },
  warn: { text: 'tw:text-warning', border: 'tw:border-l-warning' },
  good: { text: 'tw:text-success', border: 'tw:border-l-success' },
  info: { text: 'tw:text-primary', border: 'tw:border-l-primary' },
};

export function CalculatorModal({ open, onClose, title, jobRef, width, inputs, results }) {
  const heading = (
    <span className="tw:flex tw:items-center tw:gap-3">
      <span className="tw:rounded-lg tw:bg-primary/10 tw:p-2"><Calculator className="tw:size-5 tw:text-primary" /></span>
      <span className="tw:flex tw:flex-col">
        <span className="tw:text-base tw:font-extrabold">{title}</span>
        <span className="tw:text-[11px] tw:font-semibold tw:text-muted-foreground">JOB REF: <span className="tw:text-primary">{jobRef}</span></span>
      </span>
    </span>
  );
  return (
    <Modal open={open} onClose={onClose} title={heading} description={title} width={width} closeOnOutside={false} bodyClassName="tw:p-0">
      <div className="tw:flex tw:flex-col tw:md:flex-row">
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-5 tw:p-5">{inputs}</div>
        <div className="tw:flex tw:flex-col tw:gap-3.5 tw:border-t tw:border-border tw:bg-page tw:p-5 tw:md:w-[380px] tw:md:border-t-0 tw:md:border-l">{results}</div>
      </div>
    </Modal>
  );
}

export function InputGroup({ icon: Icon, title, children }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <h3 className="tw:m-0 tw:flex tw:items-center tw:gap-1.5 tw:border-b tw:border-border tw:pb-2 tw:text-[13px] tw:font-bold tw:text-foreground">
        <Icon className="tw:size-3.5 tw:text-primary" /> {title}
      </h3>
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">{children}</div>
    </div>
  );
}

function FieldLabel({ icon: Icon, text }) {
  return <span className="tw:flex tw:items-center tw:gap-1 tw:text-[10px] tw:font-semibold tw:text-muted-foreground"><Icon className="tw:size-2.5" /> {text}</span>;
}

export function DateField({ icon, label, name, value, onChange, wide = false }) {
  return (
    <Field layout="col" label={<FieldLabel icon={icon} text={label} />} className={cn(wide && 'tw:sm:col-span-2')}>
      <DateInput name={name} value={value} onChange={onChange} />
    </Field>
  );
}

export function NumberField({ icon, label, name, value, onChange, wide = false, className }) {
  return (
    <Field layout="col" label={<FieldLabel icon={icon} text={label} />} className={cn(wide && 'tw:sm:col-span-2')}>
      <NumberInput name={name} value={String(value)} onChange={onChange} className={className} />
    </Field>
  );
}

export function ExposureTotal({ amount, tone }) {
  const isRisk = tone === 'danger';
  return (
    <div className={cn('tw:rounded-xl tw:border tw:p-5 tw:text-center', isRisk ? 'tw:border-destructive/30 tw:bg-destructive/5' : 'tw:border-success/30 tw:bg-success/5')}>
      <span className={cn('tw:text-[11px] tw:font-bold tw:tracking-[1.5px] tw:uppercase', TONES[tone].text)}>Total Exposure</span>
      <div className={cn('tw:mt-1.5 tw:text-[32px] tw:font-extrabold', TONES[tone].text)}>&#8377; {amount}</div>
    </div>
  );
}

export function ExposureLine({ icon: Icon, title, note, amount, tone }) {
  return (
    <div className={cn('tw:flex tw:items-center tw:justify-between tw:rounded-lg tw:border tw:border-l-4 tw:border-border tw:bg-card tw:px-3.5 tw:py-2.5', TONES[tone].border)}>
      <div className="tw:flex tw:items-center tw:gap-2.5">
        <Icon className={cn('tw:size-4', TONES[tone].text)} />
        <div>
          <div className="tw:text-entry tw:font-bold tw:text-foreground">{title}</div>
          <div className="tw:text-[10px] tw:text-muted-foreground">{note}</div>
        </div>
      </div>
      <div className={cn('tw:text-sm tw:font-extrabold', TONES[tone].text)}>&#8377; {amount}</div>
    </div>
  );
}
