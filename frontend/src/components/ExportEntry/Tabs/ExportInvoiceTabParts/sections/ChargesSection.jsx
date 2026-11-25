import { ComboInput, Field, Input, NumberInput } from '@/components/ui';
import FormPanel from './FormPanel';
import SegmentedChoice from './SegmentedChoice';
import { FREIGHT_CONTRACTS, INSURANCE_CONTRACTS } from '../invoiceRules';

const THIRD_PARTY_LABEL_WIDTH = '62px';
const CHARGE_GRID = 'tw:grid tw:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,1fr)] tw:items-center tw:gap-x-1.5 tw:gap-y-1';

const nameMatches = (field) => (row, query) => String(row[field] || '').toLowerCase().includes(query.toLowerCase());
const countryMatches = (country, query) => nameMatches('name')(country, query) || nameMatches('code')(country, query);

const partyOption = (party) => (
  <span className="tw:flex tw:flex-col">
    <b className="tw:text-[11px] tw:text-primary">{party.name}</b>
    <span className="tw:text-[10px] tw:text-muted-foreground">{party.street}, {party.city}</span>
  </span>
);
const countryOption = (country) => (
  <span className="tw:flex tw:flex-col">
    <b className="tw:text-[11px] tw:text-primary">{country.name}</b>
    <span className="tw:text-[10px] tw:text-muted-foreground">Code: {country.code}</span>
  </span>
);

function ChargeRow({ label, charge, formData, setField, currencies }) {
  return (
    <>
      <span className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2 tw:text-[11px] tw:font-semibold tw:text-foreground">{label}</span>
      <NumberInput name={`${charge}Rate`} align="right" value={formData[`${charge}Rate`] || ''} onValueChange={(rate) => setField(`${charge}Rate`, rate)} />
      <ComboInput name={`${charge}Curr`} upper maxLength={3} placeholder={formData.currency || ''} listClassName="tw:min-w-56"
        options={currencies} getValue={(currency) => currency.currencyCode} getLabel={(currency) => currency.currencyName}
        value={formData[`${charge}Curr`] || ''} onValueChange={(code) => setField(`${charge}Curr`, code)} />
      <NumberInput name={`${charge}Amount`} align="right" value={formData[`${charge}Amount`] || ''} onValueChange={(amount) => setField(`${charge}Amount`, amount)} />
    </>
  );
}

function ChargesPanel({ ctx }) {
  const { formData, setField, natureOfContract, currencies } = ctx;
  const charges = [
    ...(FREIGHT_CONTRACTS.includes(natureOfContract) ? [['Freight', 'freight']] : []),
    ...(INSURANCE_CONTRACTS.includes(natureOfContract) ? [['Insurance', 'insurance']] : []),
    ['Packing & Misc', 'packing'], ['Discount on FOB', 'discount'], ['Other Deductions', 'other'],
  ];
  return (
    <FormPanel title="Charges" note="rate (%) or amount; freight / insurance show for CF / CI / CIF">
      <div className={CHARGE_GRID}>
        {['Charge', 'Rate %', 'Currency', 'Amount'].map((heading) => (
          <span key={heading} className="tw:border-b tw:border-border tw:pb-0.5 tw:text-[10.5px] tw:font-bold tw:text-muted-foreground">{heading}</span>
        ))}
        {charges.map(([label, charge]) => (
          <ChargeRow key={charge} label={label} charge={charge} formData={formData} setField={setField} currencies={currencies} />
        ))}
        <ChargeRow
          charge="commission" formData={formData} setField={setField} currencies={currencies}
          label={(
            <>
              Commission
              <SegmentedChoice title="Commission on FOB or CIF value" value={formData.commType} options={['FOB', 'CIF']} onChange={(basis) => setField('commType', basis)} />
            </>
          )}
        />
      </div>
    </FormPanel>
  );
}

function ThirdPartyPanel({ ctx }) {
  const { formData, setFormData, setField, parties, countries, thirdPartyDetails, setThirdPartyDetails } = ctx;
  const hasThirdParty = thirdPartyDetails === 'Y';

  const pickParty = (party) => {
    const branch = party.branches?.[0];
    const country = countries.find((row) => row.code === party.countryCode);
    setFormData((previous) => ({
      ...previous,
      tpName: party.name,
      tpAddress1: (branch ? branch.address1 : party.street) || '',
      tpAddress2: (branch ? branch.address2 : '') || '',
      tpCity: (branch ? branch.city : party.city) || '',
      tpPin: (branch ? branch.pinCode : party.zipPostcode) || '',
      tpCntry: country ? country.name : (party.countryCode || ''),
      tpCntr2: party.countryCode || '',
    }));
  };
  const textBox = (name, extra) => (
    <Input name={name} data-allow-text="" value={formData[name] || ''} onChange={(event) => setField(name, event.target.value)} {...extra} />
  );

  return (
    <FormPanel
      title="Third Party"
      actions={(
        <SegmentedChoice title="Y = payment from a third party (its country must be FATF compliant)" value={hasThirdParty ? 'Y' : 'N'}
          options={[['N', 'No'], ['Y', 'Yes']]} onChange={setThirdPartyDetails} />
      )}
    >
      {!hasThirdParty && <p className="tw:m-0 tw:py-0.5 tw:text-[11px] tw:text-muted-foreground tw:normal-case">No third party - payment comes from the buyer.</p>}
      {hasThirdParty && (
        <div className="tw:grid tw:grid-cols-1 tw:gap-x-3 tw:gap-y-1.5 tw:md:grid-cols-2">
          <Field label="Name" labelWidth={THIRD_PARTY_LABEL_WIDTH} className="tw:md:col-span-2">
            <ComboInput placeholder="THIRD PARTY NAME" options={parties} getValue={(party) => party.name} filter={nameMatches('name')} renderOption={partyOption}
              value={formData.tpName} onValueChange={(name) => setField('tpName', name)} onSelect={pickParty} />
          </Field>
          <Field label="Address 1" labelWidth={THIRD_PARTY_LABEL_WIDTH}>{textBox('tpAddress1')}</Field>
          <Field label="Address 2" labelWidth={THIRD_PARTY_LABEL_WIDTH}>{textBox('tpAddress2')}</Field>
          <Field label="City" labelWidth={THIRD_PARTY_LABEL_WIDTH}>{textBox('tpCity')}</Field>
          <Field label="Pin" labelWidth={THIRD_PARTY_LABEL_WIDTH}>{textBox('tpPin')}</Field>
          <Field label="Country" labelWidth={THIRD_PARTY_LABEL_WIDTH}>
            <ComboInput placeholder="COUNTRY" options={countries} getValue={(country) => country.name} filter={countryMatches} renderOption={countryOption}
              value={formData.tpCntry} onValueChange={(name) => setField('tpCntry', name)}
              onSelect={(country) => setFormData((previous) => ({ ...previous, tpCntry: country.name, tpCntr2: country.code }))} />
            {textBox('tpCntr2', { placeholder: 'CC', title: 'Country code sent to ICEGATE', className: 'tw:w-10 tw:flex-none tw:text-center' })}
          </Field>
          <Field label={<span title="Country subdivision (state / province)">Subdivision</span>} labelWidth={THIRD_PARTY_LABEL_WIDTH}>
            {textBox('tpCntryDiv')}
            {textBox('tpCntr1', { placeholder: 'CC', className: 'tw:w-10 tw:flex-none tw:text-center' })}
          </Field>
        </div>
      )}
    </FormPanel>
  );
}

export default function ChargesSection({ ctx }) {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-1.5 tw:lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <ChargesPanel ctx={ctx} />
      <ThirdPartyPanel ctx={ctx} />
    </div>
  );
}
