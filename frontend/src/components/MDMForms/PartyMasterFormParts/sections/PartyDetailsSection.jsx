import { CheckCircle2, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Checkbox, Field, Input, SelectBox } from '@/components/ui';
import { mercView } from '../dgftMatch';
import { CLASS_OPTIONS, MERC_OPTIONS, PARTY_FLAGS } from '../partyMasterData';
import { CheckField, PanelCard, RecordTextField } from './formBits';

const LABEL_WIDTH = '130px';
// ICEGATE takes 50 characters of the party name; AWB / IATA EDI keeps the first 35
const NAME_RULE = 'ICEGATE takes 50 characters; AWB / IATA EDI keeps the first 35';

export default function PartyDetailsSection({ ctx }) {
  const { formData, setFormField, setKycApproved, openDgft } = ctx;
  const nameLength = (formData.name || '').length;
  const textField = (field, label, placeholder, extra) => (
    <RecordTextField label={label} field={field} placeholder={placeholder} record={formData} onChange={setFormField} labelWidth={LABEL_WIDTH} {...extra} />
  );
  const checkField = (field, label) => (
    <CheckField label={label} labelFirst checked={formData[field]} onCheckedChange={(checked) => setFormField(field, checked)} />
  );

  return (
    <PanelCard title="Party Details" icon={Users}>
      <div className="tw:grid tw:grid-cols-1 tw:gap-x-8 tw:gap-y-1 tw:lg:grid-cols-2">
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <div className="tw:flex tw:flex-col tw:gap-1 tw:rounded-md tw:border tw:border-border tw:bg-page tw:px-2.5 tw:py-1.5 tw:md:flex-row tw:md:items-center">
            <span className="tw:w-[120px] tw:shrink-0 tw:text-[11px] tw:font-bold tw:text-head">PARTY TYPE:</span>
            <div className="tw:flex tw:flex-1 tw:flex-wrap tw:gap-x-3 tw:gap-y-1">
              {PARTY_FLAGS.map((flag) => (
                <CheckField key={flag.key} label={flag.label} checked={formData[flag.key]} onCheckedChange={(checked) => setFormField(flag.key, checked)} />
              ))}
            </div>
          </div>

          <Field label="Party Name" required labelWidth={LABEL_WIDTH}>
            <Input required data-allow-text="" maxLength={50} title={NAME_RULE} placeholder="NAME" value={formData.name}
              className={cn(nameLength >= 50 && 'tw:ring-2 tw:ring-destructive/50')} onChange={(event) => setFormField('name', event.target.value)} />
            {nameLength > 35 && <span className="tw:text-[10px] tw:whitespace-nowrap tw:normal-case tw:text-warning" title={NAME_RULE}>{nameLength}/50, AWB keeps 35</span>}
            <label title="Mark as KYC Verified" className="tw:m-0 tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:rounded tw:border tw:border-success/40 tw:bg-success/10 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-bold tw:whitespace-nowrap tw:text-success">
              <Checkbox checked={formData.kycApproved} onCheckedChange={(checked) => setKycApproved(checked === true)} /> KYC APPROVED <CheckCircle2 className="tw:size-3.5" />
            </label>
          </Field>
          {textField('extendedName', 'Extended Name', 'EXTENDED NAME')}
          <Field label="[R]Merc / [F]Manuf" labelWidth={LABEL_WIDTH}>
            <SelectBox required options={MERC_OPTIONS} value={mercView(formData.mercManuf)} onValueChange={(value) => setFormField('mercManuf', value)} />
          </Field>
          {textField('rbiNumber', 'RBI Number', 'RBI NUMBER')}
          {textField('marketingPerson2', 'Marketing Person2', 'MARKETING PERSON2')}
          <Field label="Branch" labelWidth={LABEL_WIDTH}>
            <Input data-allow-text="" placeholder="BRANCH" />
          </Field>
          {textField('sezWarehouseCode', 'SEZ Warehouse Code', 'SEZ WAREHOUSE CODE')}
        </div>

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1">
          <Field labelWidth={LABEL_WIDTH} labelClassName="tw:text-[10px]"
            label={<>IEC / TAX ID / EORI <Checkbox title="IEC No. Reqd." checked={formData.iecNoReqd} onCheckedChange={(checked) => setFormField('iecNoReqd', checked === true)} /></>}>
            <Input required data-allow-text="" placeholder="IEC / EORI / VAT" value={formData.taxId} onChange={(event) => setFormField('taxId', event.target.value)} />
            <Button variant="default" size="sm" onClick={openDgft} title="Opens the DGFT captcha here and lists all IEC branches">
              <Search /> Fetch from DGFT
            </Button>
          </Field>
          <Field label="Class" labelWidth={LABEL_WIDTH}>
            <SelectBox required options={CLASS_OPTIONS} value={formData.classType} onValueChange={(value) => setFormField('classType', value)} />
          </Field>
          <Field label="PAN Number" labelWidth={LABEL_WIDTH} hint="Optional - individuals may have only Aadhar or a passport">
            <Input data-allow-text="" placeholder="PAN NUMBER (IF ANY)" value={formData.panNumber} onChange={(event) => setFormField('panNumber', event.target.value)} />
          </Field>
          {textField('marketingPerson1', 'Marketing Person1', 'MARKETING PERSON1')}
          {textField('marketingPerson3', 'Marketing Person3', 'MARKETING PERSON3')}
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-4 tw:py-0.5">
            {checkField('paymentDeferred', 'Payment Method Deffered?')}
            {checkField('blackList', 'Black List')}
          </div>
          {textField('insuranceRate', 'Insurance Rate(%)', 'INSURANCE RATE')}
        </div>
      </div>
      {textField('remarks', 'Remarks', '')}
    </PanelCard>
  );
}
