import { Edit2 } from 'lucide-react';
import { Button, Field, Input, Label, Separator } from '@/components/ui';
import { AwbCard, FormCombo, LooseSelect } from '../awbParts';
import { codeOptions } from '../awbFormat';

const PRODUCTS = ['ARP', 'AIR', 'AGC'];
const SCI_CODES = ['C', 'F', 'T1', 'T2', 'TD', 'TF', 'X'];
const THREE_COLUMNS = 'tw:mb-4 tw:grid tw:grid-cols-1 tw:gap-5 tw:md:grid-cols-3';

function NoteColumn({ title, action, className, children }) {
  return (
    <div className={className}>
      <div className="tw:mb-2 tw:flex tw:items-center tw:justify-between">
        <Label className="tw:font-semibold">{title}</Label>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function ShipmentBasicsSection({ ctx }) {
  const { airports, currencies, sphList, register, openDrawer } = ctx;
  const airportOptions = codeOptions(airports, 'name');
  const sphOptions = codeOptions(sphList, 'description');

  return (
    <AwbCard>
      <div className={THREE_COLUMNS}>
        <Field layout="col" label="Origin" required><FormCombo ctx={ctx} name="origin" options={airportOptions} required /></Field>
        <Field layout="col" label="Destination" required><FormCombo ctx={ctx} name="destination" options={airportOptions} required /></Field>
        <Field layout="col" label="Shipping Date" required><FormCombo ctx={ctx} name="currency" options={codeOptions(currencies, 'name')} required /></Field>
      </div>

      <div className={THREE_COLUMNS}>
        <Field layout="col" label="Commodity" required><Input data-allow-text required {...register('commodity')} placeholder="Search Commodity..." /></Field>
        <Field layout="col" label="Product" required><LooseSelect options={PRODUCTS} placeholder="Select" required className="tw:w-full" /></Field>
        <Field layout="col" label="SCI"><LooseSelect options={SCI_CODES} placeholder="Select the SCI" className="tw:w-full" /></Field>
      </div>

      <div className="tw:mb-6 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-[13px]">
        <Label required>SHC * :</Label>
        <FormCombo ctx={ctx} name="shc1" options={sphOptions} upper placeholder="--" className="tw:w-[60px] tw:flex-none" />
        <FormCombo ctx={ctx} name="shc2" options={sphOptions} upper placeholder="--" className="tw:w-[60px] tw:flex-none" />
        <Button variant="link" className="tw:font-bold">+Add More</Button>
      </div>

      <Separator className="tw:mb-5" />

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2 tw:md:gap-0">
        <NoteColumn
          title="Remarks"
          className="tw:md:border-r tw:md:border-border tw:md:pr-5"
          action={<Button variant="ghost" size="icon-sm" aria-label="Edit remarks" onClick={() => openDrawer('remarks')}><Edit2 className="tw:text-primary" /></Button>}
        >
          <div className="tw:text-[13px] tw:text-muted-foreground">GENERAL CARGO</div>
        </NoteColumn>
        <NoteColumn
          title="Handling Instructions"
          className="tw:md:pl-5"
          action={<Button variant="link" className="tw:font-bold" onClick={() => openDrawer('remarks')}>+Add</Button>}
        />
      </div>
    </AwbCard>
  );
}
