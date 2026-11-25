import { ArrowUpDown, CheckSquare, Pencil, RefreshCw, X } from 'lucide-react';
import { Button, Field, Input, Section } from '@/components/ui';
import { cn } from '@/lib/utils';
import PopupFlagField from './PopupFlagField';

// The item particulars ICEGATE wants on every BE item: brand, model and end use are mandatory.
const itemParticulars = (headerOrigin) => [
  { name: 'brandName', label: 'Brand', maxLength: 20, required: true, placeholder: 'N.A. when none', title: 'Mandatory on every item - type N.A. when the goods have no brand' },
  { name: 'model', label: 'Model', maxLength: 20, required: true, placeholder: 'N.A. when none', title: 'Mandatory - N.A. when none' },
  { name: 'endUse', label: 'End use', maxLength: 20, required: true, placeholder: 'e.g. GNX200', title: 'ICEGATE end-use code, e.g. GNX200 (general), GNX100...' },
  { name: 'countryOfOrigin', label: 'Country of origin', maxLength: 2, placeholder: headerOrigin || 'CC', title: `Two-letter code; blank = the country of origin on the Job Header (${headerOrigin || '-'})` },
  { name: 'genericDesc', label: 'Generic description', maxLength: 60, wide: true, labelClassName: 'tw:md:min-w-[130px]', title: 'Generic name of the goods for ICEGATE (60 characters)' },
  { name: 'manufacturer', label: 'Manufacturer', maxLength: 50, wide: true },
  { name: 'accessories', label: 'Accessories', maxLength: 2000, wide: true, placeholder: 'accessories supplied with the item, if any' },
  { name: 'sourceCountry', label: 'Source country', maxLength: 2, placeholder: 'CC', title: 'Country the goods were bought from, when different' },
  { name: 'transitCountry', label: 'Transit country', maxLength: 2, placeholder: 'CC' },
];

const ITEM_ACTIONS = [
  { label: 'Save', icon: CheckSquare, variant: 'success', handler: 'handleSave' },
  { label: 'Modify', icon: Pencil, variant: 'success', handler: 'handleModify' },
  { label: 'Delete', icon: X, variant: 'destructive', handler: 'handleDelete' },
  { label: 'Delete Multiple Item', icon: X, variant: 'destructive', handler: 'handleDeleteMultiple' },
  { label: 'Arrange Item Serial No', icon: ArrowUpDown, variant: 'success', handler: 'handleArrangeItemSerial', title: 'Re-number the items of each invoice 1, 2, 3 ... in their present order' },
  { label: 'Clear', icon: RefreshCw, variant: 'default', handler: 'handleClear' },
  { label: 'Validate Job', icon: CheckSquare, variant: 'destructive', handler: 'onValidate', title: 'Check this job against the ICEGATE rules without saving or sending' },
];

const FLAG_LABEL_WIDTH = '110px';

export default function AdditionalDetailsSection({ ctx }) {
  const { addInMiddle, openPolicyParaModal, openPreviousBeModal, saveItemTemplate, selectedItem, setAddInMiddle, useItemTemplate, jobData, askItemHistory } = ctx;
  const headerOrigin = jobData?.autoField_20 || jobData?.countryOfOrigin || '';

  return (
    <>
      <Section title="Item Particulars (ICEGATE)" bodyClassName="tw:grid tw:grid-cols-1 tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        {itemParticulars(headerOrigin).map((particular) => (
          <Field key={particular.name} label={particular.label} required={particular.required} labelClassName={particular.labelClassName || 'tw:md:min-w-[90px]'}
            className={cn(particular.wide && 'tw:sm:col-span-2')}>
            <Input name={particular.name} maxLength={particular.maxLength} required={particular.required} placeholder={particular.placeholder}
              title={particular.title} defaultValue={selectedItem[particular.name] || ''} className="tw:uppercase"
              onBlur={particular.name === 'model' ? () => askItemHistory(false) : undefined} />
          </Field>
        ))}
      </Section>

      <Section title="Additional Details" bodyClassName="tw:grid tw:grid-cols-1 tw:items-center tw:gap-2 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
        <PopupFlagField label="Policy Para" name="policyParaFlag" labelWidth={FLAG_LABEL_WIDTH} className="tw:lg:col-start-2"
          defaultValue={selectedItem.policyParaFlag || ''} onOpen={openPolicyParaModal} />
        <PopupFlagField label="Customs Notn Exempting Central Excise Flag (C)" name="exciseFlag" className="tw:sm:col-span-2"
          defaultValue={selectedItem.exciseFlag || ''} />

        <PopupFlagField label="Print Gen Desc." name="printGenDescFlag" labelWidth={FLAG_LABEL_WIDTH} defaultValue={selectedItem.printGenDescFlag || ''} />
        <PopupFlagField label="Previous BE" name="previousBeFlag" labelWidth={FLAG_LABEL_WIDTH}
          defaultValue={selectedItem.previousBeFlag || ''} onOpen={openPreviousBeModal} />
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4">
          <PopupFlagField label="FOC" name="foc" defaultValue={selectedItem.foc || 'N'} />
          <Field label="Add In Middle">
            <Input value={addInMiddle} onChange={(event) => setAddInMiddle(event.target.value.toUpperCase())} className="tw:w-10 tw:flex-none tw:text-center" />
            {addInMiddle === 'Y' && (
              <span className="tw:rounded-sm tw:bg-warning/15 tw:px-2.5 tw:py-1 tw:text-[11px] tw:whitespace-normal tw:text-warning">
                Type the wanted Item Sr. No. in the box on the first row - later items move down
              </span>
            )}
          </Field>
        </div>
        {/* the Item Template master (Masters > Item Template) */}
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:lg:pl-2">
          <Button size="sm" onClick={saveItemTemplate} title="Save this item in the Item Template master so it can be used in any job">Add to Template</Button>
          <Button size="sm" onClick={useItemTemplate} title="Add an item from the Item Template master to this invoice">Use Template</Button>
        </div>
      </Section>

      <div className="tw:mt-auto tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-1.5 tw:pt-3 tw:pb-6">
        {ITEM_ACTIONS.map(({ label, icon: Icon, variant, handler, title }) => (
          <Button key={label} variant={variant} title={title} onClick={ctx[handler]}><Icon /> {label}</Button>
        ))}
      </div>
    </>
  );
}
