import { Input, Section } from '@/components/ui';
import { NameCodeField, PortCodeInput } from '../helpers';
import { COUNTRY_LIST, FIELD_ROW, includesText, PORT_LIST } from '../headerLists';

const STATE_LIST = {
  getValue: (state) => state.stateName,
  getLabel: (state) => `Code: ${state.taxCode}`,
  filter: (state, query) => includesText(state.stateName, query) || String(state.taxCode || '').includes(query),
};

function ReadOnlyCode({ value, width = 'tw:w-[40px]' }) {
  return <Input readOnly required className={`${width} tw:flex-none`} value={value || ''} />;
}

export default function PortDetailsSection({ ctx }) {
  const { exportData, setExportData, setField, countries, states, indianPorts, foreignPorts } = ctx;
  const countryName = (code) => countries.find((country) => country.code === code)?.name || code;

  const countryCombo = (nameKey, codeKey) => ({
    ...COUNTRY_LIST,
    placeholder: 'Country Name',
    options: countries,
    value: exportData[nameKey] || '',
    onValueChange: setField(nameKey),
    onSelect: (country) => setExportData((prev) => ({ ...prev, [nameKey]: country.name, [codeKey]: country.code })),
    code: <ReadOnlyCode value={exportData[codeKey]} />,
  });

  // a foreign port picked while its country box is empty fills the country too
  const foreignPortCombo = (nameKey, codeKey, countryNameKey, countryCodeKey) => ({
    ...PORT_LIST,
    placeholder: 'Port Name',
    options: foreignPorts,
    value: exportData[nameKey] || '',
    onValueChange: setField(nameKey),
    onSelect: (port) => setExportData((prev) => ({
      ...prev, [nameKey]: port.portName, [codeKey]: port.portCode,
      ...(!prev[countryCodeKey] && port.countryCode ? { [countryCodeKey]: port.countryCode, [countryNameKey]: countryName(port.countryCode) } : {}),
    })),
    code: <PortCodeInput name={codeKey} exportData={exportData} setExportData={setExportData} />,
  });

  return (
    <Section title="Port Details">
      <div className={FIELD_ROW}>
        <NameCodeField label="Loading Port" required labelWidth="100px" {...PORT_LIST} placeholder="Port Name" options={indianPorts}
          value={exportData.loadingPortName || ''} onValueChange={setField('loadingPortName')}
          onSelect={(port) => setExportData((prev) => ({ ...prev, loadingPortName: port.portName, loadingPortCode: port.portCode }))}
          code={<PortCodeInput name="loadingPortCode" exportData={exportData} setExportData={setExportData} />} />
        <NameCodeField label="Country Of Destination" required labelWidth="150px" {...countryCombo('destCountryName', 'destCountryCode')} />
        <NameCodeField label="Destination Port" required labelWidth="110px" {...foreignPortCombo('destPortName', 'destPortCode', 'destCountryName', 'destCountryCode')} />
      </div>
      <div className={FIELD_ROW}>
        <NameCodeField label="State Origin" required labelWidth="100px" {...STATE_LIST} placeholder="State Name" options={states}
          value={exportData.stateOriginName || ''} onValueChange={setField('stateOriginName')}
          onSelect={(state) => setExportData((prev) => ({ ...prev, stateOriginName: state.stateName, stateOriginCode: state.taxCode }))}
          code={<ReadOnlyCode value={exportData.stateOriginCode} width="tw:w-[60px]" />} />
        <NameCodeField label="Country Of Discharge" required labelWidth="150px" {...countryCombo('discCountryName', 'discCountryCode')} />
        <NameCodeField label="Discharge Port" required labelWidth="110px" {...foreignPortCombo('discPortName', 'discPortCode', 'discCountryName', 'discCountryCode')} />
      </div>
    </Section>
  );
}
