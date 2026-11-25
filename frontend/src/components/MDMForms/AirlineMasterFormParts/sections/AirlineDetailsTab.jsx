import { Upload } from 'lucide-react';
import { Field, FileButton, Input, Section, SelectBox } from '@/components/ui';
import FieldAutocomplete from '../../../FieldAutocomplete';
import AirlineLogo from './AirlineLogo';

const STATUSES = ['ACTIVE', 'INACTIVE'];
const COMMISSION_TYPES = ['NET', 'GROSS'];

const NAME_FIELDS = [
  { key: 'name', label: 'Airline Name', required: true, upper: true, className: 'tw:md:col-span-2' },
  { key: 'code3', label: '3 Letter Code', required: true, upper: true },
  { key: 'code2', label: '2 Letter Code', required: true, upper: true },
];
const ACCOUNT_FIELDS = [
  { key: 'accountNo', label: 'Account No', upper: true },
  { key: 'pan', label: 'PAN Number', upper: true },
];
const ADDRESS_FIELDS = [
  { key: 'address1', label: 'Address Line 1', required: true, upper: true, placeholder: 'BUILDING NO. / STREET' },
  { key: 'address2', label: 'Address Line 2', upper: true, placeholder: 'AREA / LANDMARK' },
  { key: 'city', label: 'City', listType: 'city', placeholder: 'NEW DELHI' },
  { key: 'state', label: 'State', listType: 'state', placeholder: 'DL' },
  { key: 'country', label: 'Country', listType: 'country', placeholder: 'IN' },
  { key: 'contact', label: 'Contact Person', upper: true, placeholder: 'MANAGER NAME' },
];

function AirlineTextField({ field, value, onValueChange }) {
  return (
    <Field label={field.label} required={field.required} layout="col" className={field.className}>
      {field.listType ? (
        <FieldAutocomplete listType={field.listType} placeholder={field.placeholder} value={value || ''}
          onChange={(event) => onValueChange(event.target.value)} onSelect={(option) => onValueChange(option.title)} />
      ) : (
        <Input required={field.required} placeholder={field.placeholder} data-allow-text="" className={field.upper ? 'tw:uppercase' : undefined}
          value={value || ''} onChange={(event) => onValueChange(event.target.value)} />
      )}
    </Field>
  );
}

export default function AirlineDetailsTab({ airline }) {
  const { form, setField, uploadLogo } = airline;
  const textField = (field) => <AirlineTextField key={field.key} field={field} value={form[field.key]} onValueChange={setField(field.key)} />;

  return (
    <div className="tw:flex tw:flex-col tw:gap-8">
      <Section title="Basic Information" actions={form.code2 && <AirlineLogo airline={form} alt="Airline Logo" className="tw:h-10 tw:max-w-[120px]" />}>
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:pt-2 tw:md:grid-cols-3 tw:lg:grid-cols-6">
          {NAME_FIELDS.map(textField)}
          <Field label="3-Digit Prefix" required layout="col">
            <Input required placeholder="098" maxLength={3} value={form.prefix || ''} onChange={(event) => setField('prefix')(event.target.value.replace(/[^0-9]/g, ''))} />
          </Field>
          <Field label="Status" layout="col">
            <SelectBox options={STATUSES} value={form.status || 'ACTIVE'} onValueChange={setField('status')} />
          </Field>
          <Field label="Custom Logo" layout="col" className="tw:md:col-span-2">
            <FileButton accept="image/*" onFiles={uploadLogo}><Upload /> Choose logo</FileButton>
          </Field>
        </div>
      </Section>

      <Section title="Financial & Commission">
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:pt-2 tw:md:grid-cols-2 tw:lg:grid-cols-4">
          <Field label="Commission Rate" layout="col">
            <Input placeholder="0.00" data-allow-text="" value={form.commRate || ''} onChange={(event) => setField('commRate')(event.target.value)} />
          </Field>
          <Field label="Commission Type" layout="col">
            <SelectBox options={COMMISSION_TYPES} value={form.commType || 'NET'} onValueChange={setField('commType')} />
          </Field>
          {ACCOUNT_FIELDS.map(textField)}
          <Field label="Tracking Website Link" layout="col" className="tw:md:col-span-2 tw:lg:col-span-4"
            note={<>Opens from Track Shipments. Use {'{awb}'} for 17612345675, {'{awbdash}'} for 176-12345675, {'{prefix}'} / {'{serial}'} for the two parts.</>}>
            <Input type="url" data-allow-text="" placeholder="https://airline-site/track?awb={awb}" className="tw:normal-case"
              value={form.trackingUrl || ''} onChange={(event) => setField('trackingUrl')(event.target.value.trim())} />
          </Field>
        </div>
      </Section>

      <Section title="Address & Contact Details">
        <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:pt-2 tw:md:grid-cols-3">
          {ADDRESS_FIELDS.map(textField)}
        </div>
      </Section>
    </div>
  );
}
