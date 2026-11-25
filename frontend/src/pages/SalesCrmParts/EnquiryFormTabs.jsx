import { Anchor, Clock, MapPin, Plane } from 'lucide-react';
import { DateInput, Field, Input, NumberInput, SearchSelect, SelectBox, Textarea } from '@/components/ui';

const INCOTERMS = ['FOB', 'EXW', 'FCA', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const CONTAINER_TYPES = [
  { value: '20GP', label: "20' GP" },
  { value: '40GP', label: "40' GP" },
  { value: '40HQ', label: "40' HQ" },
  { value: '20RF', label: "20' Reefer" },
  { value: '40RF', label: "40' Reefer" },
  { value: 'LCL', label: 'LCL' },
  { value: 'AIR', label: 'Air cargo' },
];
const MODE_ICONS = { Sea: Anchor, Air: Plane, Land: MapPin };

function Heading({ icon: Icon, children }) {
  return (
    <h4 className="tw:m-0 tw:mb-4 tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-border tw:pb-2 tw:text-[13px] tw:font-bold tw:text-head">
      {Icon && <Icon className="tw:size-4" />}
      {children}
    </h4>
  );
}

function TextField({ label, name, form, setField, className, labelClassName, ...inputProps }) {
  return (
    <Field label={label} layout="col" className={className} labelClassName={labelClassName}>
      <Input value={form[name]} onChange={(event) => setField(name, event.target.value)} {...inputProps} />
    </Field>
  );
}

export function ClientTab({ form, setField, parties, onPickParty }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
        <TextField label="Enquiry Ref (Auto)" name="enquiryNo" form={form} setField={setField} readOnly />
        <Field label="Date of Enquiry" layout="col">
          <DateInput value={form.date} onValueChange={(date) => setField('date', date)} />
        </Field>
      </div>
      <div>
        <Heading>Prospect / Client Info</Heading>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <Field label="Existing customer (optional - links the enquiry to their ledger)" layout="col" className="tw:md:col-span-2">
            <SearchSelect
              options={parties.map((party) => ({ value: String(party.id), label: party.name }))}
              value={form.partyLedgerId}
              onValueChange={onPickParty}
              placeholder="-- new prospect, not in the ledger --"
            />
          </Field>
          <TextField label="Company Name" name="clientName" form={form} setField={setField} placeholder="e.g. Apex Global Exports" className="tw:md:col-span-2" />
          <TextField label="Contact Person" name="contactPerson" form={form} setField={setField} placeholder="Full Name" />
          <TextField label="Designation" name="designation" form={form} setField={setField} placeholder="e.g. Logistics Manager" />
          <TextField label="Email ID" name="email" form={form} setField={setField} type="email" placeholder="email@domain.com" />
          <TextField label="Phone / Mobile" name="phone" form={form} setField={setField} placeholder="+91..." />
        </div>
      </div>
    </div>
  );
}

export function RoutingTab({ form, setField, mode }) {
  const isAir = mode === 'Air';
  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <div>
        <Heading icon={MODE_ICONS[mode]}>Route & Terms ({mode} Freight)</Heading>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <TextField label={isAir ? 'Origin Airport' : 'Port of Loading (POL)'} name="origin" form={form} setField={setField} placeholder="e.g. Nhava Sheva (INNSA)" />
          <TextField label={isAir ? 'Dest Airport' : 'Port of Discharge (POD)'} name="destination" form={form} setField={setField} placeholder="e.g. Jebel Ali (AEJEA)" />
          <Field label="Incoterms" layout="col">
            <SelectBox options={INCOTERMS} value={form.incoterms} onValueChange={(value) => setField('incoterms', value)} />
          </Field>
          <Field label="Readiness Date" layout="col">
            <DateInput value={form.readinessDate} onValueChange={(date) => setField('readinessDate', date)} />
          </Field>
        </div>
      </div>
      <div>
        <Heading>Cargo Details</Heading>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3">
          <TextField label="Commodity / Cargo Type" name="commodity" form={form} setField={setField} placeholder="e.g. Pharmaceuticals, General Cargo, Haz..." className="tw:md:col-span-3" />
          {mode === 'Sea' && (
            <Field label="Container Size/Type" layout="col">
              <SelectBox options={CONTAINER_TYPES} value={form.containerType} onValueChange={(value) => setField('containerType', value)} />
            </Field>
          )}
          <Field label="Gross Wt. (Kgs)" layout="col">
            <NumberInput value={form.weight} onValueChange={(value) => setField('weight', value)} placeholder="Total Weight" />
          </Field>
          <Field label={`Volume (${isAir ? 'Vol. Wt.' : 'CBM'})`} layout="col">
            <NumberInput value={form.volume} onValueChange={(value) => setField('volume', value)} placeholder="Total Volume" />
          </Field>
        </div>
      </div>
    </div>
  );
}

export function CommercialsTab({ form, setField }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <div className="tw:rounded-md tw:border tw:border-warning/40 tw:bg-warning/10 tw:p-4">
        <h4 className="tw:m-0 tw:mb-2 tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:font-bold tw:text-warning">
          <Clock className="tw:size-4" /> Target Pricing & Competitor Intel
        </h4>
        <p className="tw:m-0 tw:mb-4 tw:text-entry tw:text-warning">
          Provide target rates to help the Pricing Desk negotiate better Buy Rates with shipping lines/airlines.
        </p>
        <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-2">
          <TextField label="Client's Target Rate (FCY)" name="targetRate" form={form} setField={setField} placeholder="e.g. USD 1200 / TEU" data-allow-text="" labelClassName="tw:text-warning" />
          <TextField label="Current Competitor" name="competitor" form={form} setField={setField} placeholder="e.g. DSV or Kuehne+Nagel" labelClassName="tw:text-warning" />
        </div>
      </div>
      <Field label="Sales Remarks / Special Instructions" layout="col">
        <Textarea rows={4} value={form.remarks} onChange={(event) => setField('remarks', event.target.value)} placeholder="Client requires 14 days free time at destination..." />
      </Field>
    </div>
  );
}
