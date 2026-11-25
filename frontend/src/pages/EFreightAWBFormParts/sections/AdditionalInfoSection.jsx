import { Calendar, Clock, Info, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Button, Field, Input } from '@/components/ui';
import { AwbCard, IconInput, LooseSelect } from '../awbParts';

const INFORMATION_IDENTIFIERS = [{ value: 'General Information', label: 'General Information' }];
const ACCOUNTING_ROWS = 2;
const CUSTOMS_INFO_ROWS = 8;
const CUSTOMS_INFO_LABELS = ['ISO CountryCode', 'Info. ID', 'Customs Info. ID', 'Supp. Customs Info.'];
const ACCOUNTING_GRID = 'tw:grid tw:grid-cols-[1fr_1fr_40px] tw:gap-3 tw:md:grid-cols-[1.2fr_1.2fr_40px_auto] tw:md:gap-5';
const CUSTOMS_GRID = 'tw:grid tw:grid-cols-2 tw:gap-3 tw:md:grid-cols-[1fr_1fr_1fr_1fr_40px] tw:md:gap-4';

const showDeleted = () => toast.error('Item Deleted');
const showRowAdded = () => toast.success('New Info row added!');

const DeleteRowButton = () => (
  <Button variant="secondary" size="icon" aria-label="Delete row" className="tw:size-8" onClick={showDeleted}>
    <Trash2 className="tw:size-4 tw:text-destructive" />
  </Button>
);

const AddInfoLink = ({ className }) => (
  <Button variant="link" className={cn('tw:font-bold', className)} onClick={showRowAdded}>+ Add Info</Button>
);

const Heading = ({ children }) => <div className="tw:mb-3 tw:text-[13px] tw:font-bold tw:text-foreground">{children}</div>;

const LabelledOrBare = ({ label, children }) => (label ? <Field layout="col" label={label}>{children}</Field> : children);

function AccountingRows() {
  return Array.from({ length: ACCOUNTING_ROWS }, (_, row) => (
    <div key={row} className={cn(ACCOUNTING_GRID, row === 0 ? 'tw:mb-2 tw:items-end' : 'tw:mb-3 tw:items-center')}>
      <LabelledOrBare label={row === 0 && 'Information Identifier'}>
        <LooseSelect options={INFORMATION_IDENTIFIERS} placeholder="Select" className="tw:w-full" />
      </LabelledOrBare>
      <LabelledOrBare label={row === 0 && 'Information'}><Input data-allow-text /></LabelledOrBare>
      <DeleteRowButton />
    </div>
  ));
}

function CustomsInfoRows() {
  return Array.from({ length: CUSTOMS_INFO_ROWS }, (_, row) => (
    <div key={row} className={cn(CUSTOMS_GRID, 'tw:mb-2', row === 0 ? 'tw:items-end' : 'tw:items-center')}>
      {CUSTOMS_INFO_LABELS.map((label) => (
        <LabelledOrBare key={label} label={row === 0 && label}><Input data-allow-text /></LabelledOrBare>
      ))}
      <DeleteRowButton />
    </div>
  ));
}

export default function AdditionalInfoSection() {
  return (
    <AwbCard icon={Info} title="Additional Info">
      <div className="tw:mb-6 tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:md:gap-10">
        <Field layout="col" label="Special Service Request"><Input data-allow-text /></Field>
        <Field layout="col" label="Shippers Certification"><Input data-allow-text /></Field>
      </div>

      <div className="tw:mb-6">
        <div className="tw:mb-4 tw:text-xs tw:font-bold tw:text-foreground tw:uppercase">Carrier&apos;s Execution Signature</div>
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-[1.2fr_1fr_1fr]">
          <Field layout="col" label="Date">
            <div className="tw:flex tw:gap-2.5">
              <IconInput icon={Calendar} placeholder="Select Date" readOnly />
              <div className="tw:w-[90px] tw:shrink-0"><IconInput icon={Clock} placeholder="Time" readOnly /></div>
            </div>
          </Field>
          <Field layout="col" label="Place"><Input data-allow-text /></Field>
          <Field layout="col" label="Authorization"><Input data-allow-text className="tw:bg-muted" /></Field>
        </div>
      </div>

      <div className="tw:mb-6">
        <Heading>Accounting Info</Heading>
        <AccountingRows />
        <AddInfoLink />
      </div>

      <div>
        <Heading>Other &amp; Customs Information</Heading>
        <CustomsInfoRows />
        <AddInfoLink className="tw:mt-1" />
      </div>
    </AwbCard>
  );
}
