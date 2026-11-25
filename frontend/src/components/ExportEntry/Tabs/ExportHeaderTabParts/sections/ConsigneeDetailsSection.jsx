import { Field, Input, Section } from '@/components/ui';
import { NameCodeField, PartySelect, TextField } from '../helpers';
import { COUNTRY_LIST, FIELD_ROW } from '../headerLists';

const LABEL_WIDTH = '120px';

export default function ConsigneeDetailsSection({ ctx }) {
  const { exportData, setExportData, handleChange, setField, parties, countries } = ctx;
  const countryCode = exportData.consigneeCountryCode || '';
  const consigneeInIndia = String(countryCode).toUpperCase() === 'IN';

  return (
    <Section title="Consignee Details">
      <div className={FIELD_ROW}>
        <Field label="Consignee Name" required labelWidth={LABEL_WIDTH} className="tw:lg:flex-[1.5]">
          <PartySelect type="CONSIGNEE" parties={parties} exportData={exportData} setExportData={setExportData} />
        </Field>
        <TextField label="Address 1" name="consigneeAddress1" required labelWidth="80px" className="tw:flex-1" exportData={exportData} onChange={handleChange} />
        <TextField label="Address 2" name="consigneeAddress2" labelWidth="80px" className="tw:flex-1" exportData={exportData} onChange={handleChange} />
      </div>
      <div className={FIELD_ROW}>
        <TextField label="Address 3" name="consigneeAddress3" labelWidth={LABEL_WIDTH} className="tw:lg:flex-[1.5]" exportData={exportData} onChange={handleChange} />
        <TextField label="Address 4" name="consigneeAddress4" placeholder="ADDRESS LINE 4" labelWidth="80px" className="tw:flex-1" exportData={exportData} onChange={handleChange} />
        <NameCodeField label="Country" labelWidth="80px" placeholder="Country" options={countries} {...COUNTRY_LIST}
          value={exportData.consigneeCountry || ''} onValueChange={setField('consigneeCountry')}
          onSelect={(country) => setExportData((prev) => ({ ...prev, consigneeCountry: country.name, consigneeCountryCode: country.code }))}
          code={<Input name="consigneeCountryCode" readOnly aria-invalid={consigneeInIndia} className="tw:w-[40px] tw:flex-none" value={countryCode}
            title={consigneeInIndia ? 'Consignee of an export is abroad - check the country' : ''} />} />
      </div>
    </Section>
  );
}
