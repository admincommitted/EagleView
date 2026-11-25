import { RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, ComboInput, DateInput, Field, Input, Section, SelectBox } from '@/components/ui';
import { CustomsPortSelect, PartySelect, TextField, WarningText } from '../helpers';
import { FIELD_ROW, includesText } from '../headerLists';

const LEFT_LABEL = '150px';
const RIGHT_LABEL = '100px';
const HALF = 'tw:flex tw:flex-1 tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:gap-4';

const YES_NO = ['Y', 'N'];
const NO_YES = ['No', 'Yes'];
const GSTN_TYPES = [
  { value: 'GSTIN', label: 'GSTIN' },
  { value: 'GST GOVERNMENT', label: 'GST - Government' },
  { value: 'GST DIPLOMAT', label: 'GST - Diplomatic' },
  { value: 'PAN', label: 'PAN' },
  { value: 'TAN', label: 'TAN' },
  { value: 'PASSPORT', label: 'Passport' },
  { value: 'AADHAAR', label: 'AADHAAR' },
];
const MERC_MANUF = [
  { value: 'F', label: 'Manufacturer [F]' },
  { value: 'M', label: 'Merchant [M]' },
  { value: 'C', label: 'Merchant Exporter Courier [C]' },
  { value: 'D', label: 'Manufacturer Exporter Courier [D]' },
];
const EXPORTER_CLASSES = [{ value: 'P', label: 'Private [P]' }, { value: 'G', label: 'Government [G]' }, { value: 'W', label: 'Warehouse Shipping Bill [W]' }];
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const chaFields = (cha) => ({
  chaName: cha?.chaName || '', chaAddress: cha?.chaAddress || '', chaCity: cha?.chaCity || '', chaPin: cha?.chaPin || '',
  chaGstin: cha?.chaGstin || '', chaPhone: cha?.chaPhone || '', chaEmail: cha?.chaEmail || '',
});

function chaOptions(chas, exportData) {
  const options = [...new Map(chas.map((cha) => [cha.chaCode, { value: cha.chaCode, label: `${cha.chaCode} - ${cha.chaName}` }])).values()];
  // a CHA of the job that is not in the CHA master (e.g. read from a file) is still shown
  if (exportData.chaNo && !chas.some((cha) => cha.chaCode === exportData.chaNo)) {
    options.push({ value: exportData.chaNo, label: `${exportData.chaNo}${exportData.chaName ? ` - ${exportData.chaName}` : ''} (not in CHA master)` });
  }
  return options;
}

function branchOptions(branches, branchSrNo) {
  const options = branches.map((branch) => ({
    value: String(branch.branchSrNo),
    label: `${branch.branchSrNo} - ${branch.branchName || [branch.city, branch.state].filter(Boolean).join(', ') || branch.address1 || ''}${branch.gstin || branch.regNo ? ` (${branch.gstin || branch.regNo})` : ''}`,
  }));
  if (branchSrNo && !branches.some((branch) => String(branch.branchSrNo) === String(branchSrNo))) options.push({ value: String(branchSrNo), label: String(branchSrNo) });
  return options;
}

// the number must fit the chosen type (GSTIN 15, PAN 10); the PAN inside a GSTIN must be the IEC's PAN
function gstinCheck(exportData) {
  const number = String(exportData.shipperGstin || '').toUpperCase();
  const type = exportData.shipperGstinType || 'GSTIN';
  const isGst = /^GST/.test(type);
  const invalid = Boolean(number) && (isGst ? !GSTIN_PATTERN.test(number) : type === 'PAN' && !PAN_PATTERN.test(number));
  const iec = String(exportData.shipperIec || '').toUpperCase();
  const panMismatch = !invalid && type === 'GSTIN' && number.length === 15 && PAN_PATTERN.test(iec) && number.slice(2, 12) !== iec;
  return { number, iec, isGst, invalid, panMismatch };
}

function GstinField({ exportData, setField }) {
  const { number, iec, isGst, invalid, panMismatch } = gstinCheck(exportData);
  return (
    <Field label="GSTIN No" required labelWidth={RIGHT_LABEL} className="tw:flex-1">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
        <Input required maxLength={15} aria-invalid={invalid || panMismatch} value={exportData.shipperGstin || ''}
          onChange={(event) => setField('shipperGstin')(event.target.value.toUpperCase().replace(/\s/g, ''))} />
        {invalid && <WarningText>Not a valid {isGst ? 'GSTIN (15 characters)' : 'PAN (10 characters)'}</WarningText>}
        {panMismatch && <WarningText>PAN in GSTIN ({number.slice(2, 12)}) is not the IEC ({iec}) - ICEGATE rejects this</WarningText>}
      </div>
    </Field>
  );
}

function IecField({ exportData, setField }) {
  const iec = exportData.shipperIec || '';
  return (
    <Field label="IEC Code" labelWidth={RIGHT_LABEL} className="tw:flex-[1.5]">
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
        <Input maxLength={10} placeholder="e.g. AABCP1234Q" className={cn('tw:uppercase', iec.length === 10 && 'tw:border-success')} value={iec}
          onChange={(event) => setField('shipperIec')(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        {iec.length > 0 && iec.length !== 10 && <WarningText>IEC must be exactly 10 characters ({iec.length}/10)</WarningText>}
      </div>
    </Field>
  );
}

function NfeiRow({ exportData, setField, setIsCategoryModalOpen }) {
  return (
    <div className={FIELD_ROW}>
      <Field label="Category" required labelWidth={LEFT_LABEL} className="tw:flex-1">
        <Input name="category" required readOnly placeholder="CATEGORY" className="tw:cursor-pointer" value={exportData.nfeiCategory || ''} onClick={() => setIsCategoryModalOpen(true)} />
        <Button variant="ghost" size="icon-sm" title="Select NFEI Category" aria-label="Select NFEI Category" onClick={() => setIsCategoryModalOpen(true)}><Search /></Button>
      </Field>
      <Field label="RBI No" labelWidth="60px" className="tw:flex-1">
        <Input value={exportData.rbiNo || ''} onChange={(event) => setField('rbiNo')(event.target.value)} />
      </Field>
      <Field label="RBI Date" labelWidth="70px">
        <DateInput wrapperClassName="tw:w-full tw:md:w-[140px]" value={exportData.rbiWaiverDate || ''} onValueChange={setField('rbiWaiverDate')} />
      </Field>
    </div>
  );
}

export default function ExporterDetailsSection({ ctx }) {
  const {
    exportData, setExportData, setField, handleChange, chas, cities, searchCities, states, indianPorts, parties,
    selectedShipper, shipperBranches, shipperAdCodes, selectShipperBranch, fromParty, setIsCategoryModalOpen,
  } = ctx;
  const selectCha = (chaNo) => setExportData((prev) => ({ ...prev, chaNo, ...chaFields(chas.find((cha) => cha.chaCode === chaNo)) }));
  const changeMoowr = (value) => setExportData((prev) => ({ ...prev, autoField_31: value, ...(value === 'Yes' ? { exBondJob: 'Y' } : {}) }));
  const branchPlaceholder = !selectedShipper ? '-- select exporter --' : shipperBranches.length ? '-- SELECT --' : '-- no branch in Party Master --';

  return (
    <Section title="Exporter Details">
      <div className={FIELD_ROW}>
        <Field label="Location (Port)" required labelWidth={LEFT_LABEL} className="tw:flex-1">
          <CustomsPortSelect ports={indianPorts} exportData={exportData} setExportData={setExportData} />
        </Field>
        <div className={HALF}>
          <Field label="Govt. IEC [Y/N]" labelWidth={RIGHT_LABEL}>
            <SelectBox className="tw:w-full tw:md:w-[56px]" options={YES_NO} value={exportData.govtIec || 'N'} onValueChange={setField('govtIec')} />
          </Field>
          <Field label="CHA No." required labelWidth="60px" className="tw:flex-1">
            <SelectBox required clearable clearLabel="-- SELECT CHA --" placeholder="-- SELECT CHA --" className="tw:w-full"
              options={chaOptions(chas, exportData)} value={exportData.chaNo || ''} onValueChange={selectCha} />
          </Field>
          <Field label="MOOWR [Y/N]" labelWidth="85px">
            <SelectBox className="tw:w-full tw:md:w-[70px]" options={NO_YES} value={exportData.autoField_31 || 'No'} onValueChange={changeMoowr} />
          </Field>
        </div>
      </div>

      <div className={FIELD_ROW}>
        <Field label="Exporter (Master)" required labelWidth={LEFT_LABEL} className="tw:flex-1">
          <PartySelect parties={parties} type="SHIPPER" exportData={exportData} setExportData={setExportData} />
          <Button size="sm" disabled={!selectedShipper} onClick={() => fromParty(true)}
            title={selectedShipper ? 'Take branch, address, GSTIN, Merchant / Manufacturer, Class, AD Code again from the Party Master' : 'Exporter not found in the Party Master'}>
            <RefreshCw /> Party Master
          </Button>
        </Field>
        <div className={HALF}>
          <IecField exportData={exportData} setField={setField} />
          <Field label="Branch Sr. No" labelWidth={RIGHT_LABEL} className="tw:flex-1">
            <SelectBox clearable clearLabel={branchPlaceholder} placeholder={branchPlaceholder} className="tw:w-full"
              options={branchOptions(shipperBranches, exportData.shipperBranchSrNo)} value={exportData.shipperBranchSrNo || ''} onValueChange={selectShipperBranch} />
          </Field>
        </div>
      </div>

      <div className={FIELD_ROW}>
        <TextField label="Address 1" name="shipperAddress1" required maxLength={50} labelWidth={LEFT_LABEL} className="tw:flex-1" exportData={exportData} onChange={handleChange} />
        <TextField label="Address 2" name="shipperAddress2" maxLength={35} labelWidth={RIGHT_LABEL} className="tw:flex-1" exportData={exportData} onChange={handleChange} />
      </div>

      <div className={FIELD_ROW}>
        <div className={HALF}>
          <Field label="City" labelWidth={LEFT_LABEL} className="tw:flex-1">
            <ComboInput placeholder="CITY" options={cities} getValue={(city) => city.cityName} getLabel={() => ''} filter={(city, query) => includesText(city.cityName, query)}
              value={exportData.shipperCity || ''} onValueChange={(text) => { setField('shipperCity')(text); searchCities(text); }} onSelect={(city) => setField('shipperCity')(city.cityName)} />
          </Field>
          <Field label="State" labelWidth="50px" className="tw:flex-1">
            <ComboInput placeholder="STATE" options={states} getValue={(state) => state.stateCode} getLabel={(state) => state.stateName}
              filter={(state, query) => includesText(state.stateName, query) || includesText(state.stateCode, query)}
              value={exportData.shipperState || ''} onValueChange={setField('shipperState')} onSelect={(state) => setField('shipperState')(state.stateCode)} />
          </Field>
        </div>
        <div className={HALF}>
          <TextField label="PinCode" name="shipperPin" required labelWidth={RIGHT_LABEL} className="tw:flex-1" exportData={exportData} onChange={handleChange} />
          <Field label="NFEI" labelWidth="50px" className="tw:flex-1">
            <SelectBox className="tw:w-full" options={NO_YES} value={exportData.nfeiFlag || 'No'} onValueChange={setField('nfeiFlag')} />
          </Field>
        </div>
      </div>

      <div className={FIELD_ROW}>
        <Field label="GSTN Type" labelWidth={LEFT_LABEL} className="tw:flex-1">
          <SelectBox className="tw:w-full" options={GSTN_TYPES} value={exportData.shipperGstinType || 'GSTIN'} onValueChange={setField('shipperGstinType')} />
        </Field>
        <GstinField exportData={exportData} setField={setField} />
      </div>

      <div className={FIELD_ROW}>
        <Field label="Merchant / Manufacturer" labelWidth={LEFT_LABEL} className="tw:flex-1">
          <SelectBox className="tw:w-full" options={MERC_MANUF} value={exportData.mercManuf || 'M'} onValueChange={setField('mercManuf')} />
        </Field>
        <div className={HALF}>
          <Field label="Class" labelWidth={RIGHT_LABEL} className="tw:flex-1">
            <SelectBox className="tw:w-full" options={EXPORTER_CLASSES} value={exportData.shipperClass || 'P'} onValueChange={setField('shipperClass')} />
          </Field>
          <Field label="AD Code" labelWidth="60px" className="tw:flex-1">
            <ComboInput placeholder="AD CODE" options={shipperAdCodes} getValue={(adCode) => adCode.adCode} getLabel={(adCode) => adCode.bankName}
              filter={(adCode, query) => includesText(adCode.adCode, query) || includesText(adCode.bankName, query)}
              value={exportData.adCode || ''} onValueChange={setField('adCode')} onSelect={(adCode) => setField('adCode')(adCode.adCode)} />
          </Field>
        </div>
      </div>

      {exportData.nfeiFlag === 'Yes' && <NfeiRow exportData={exportData} setField={setField} setIsCategoryModalOpen={setIsCategoryModalOpen} />}
    </Section>
  );
}
