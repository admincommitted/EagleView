import { Fragment } from 'react';
import { Button, ComboInput, DateInput, Field, FlagInput, Input, Section, SelectBox } from '@/components/ui';
import { TextField } from '../helpers';
import { FIELD_ROW, FIVE_COLUMNS, includesText, UQC_LIST } from '../headerLists';

const LABEL_WIDTH = '120px';
const NO_YES = ['No', 'Yes'];
const YES_NO_SWITCH = ['N', 'Y'];
const SEAL_TYPES = ['A', 'S', 'W'];
const PACKAGED_CARGO = [{ value: 'P', label: 'P - Packaged' }];
// ICEGATE codes; an air SB takes only P
const SEA_CARGO = [
  ...PACKAGED_CARGO,
  { value: 'C', label: 'C - Containerised' },
  { value: 'CP', label: 'CP - Containerised & Packaged' },
  { value: 'LB', label: 'LB - Liquid Bulk' },
  { value: 'DB', label: 'DB - Dry Bulk' },
];

const MODE_TEXT = {
  SEA: { units: 'No Of Containers', unitPkgs: 'Total Pkgs in MBL', masterNo: 'MBL No', masterDate: 'MBL Date', houseNo: 'HBL No', houseDate: 'HBL Date', carrier: 'Vessel Name' },
  AIR: { units: 'No Of ULDs', unitPkgs: 'Total Pkgs in MAWB', masterNo: 'MAWB No', masterDate: 'MAWB Date', houseNo: 'HAWB No', houseDate: 'HAWB Date', carrier: 'Airline Name' },
  OTHER: { units: 'No Of ULDs', unitPkgs: 'Total Pkgs in MAWB', masterNo: 'LWB No', masterDate: 'LWB Date', houseNo: 'Truck No', houseDate: 'Truck Date', carrier: 'Transporter Name' },
};

const isoDay = (value) => {
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(String(value || ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
};

// in screen order, five to a row; `special` boxes are drawn by the section itself
const fieldsFor = (text) => [
  { name: 'autoField_17', label: 'Total Loose Pkgs' },
  { name: 'autoField_18', label: 'Gross Wt.' },
  { name: 'autoField_19', label: 'Net Wt.' },
  { name: 'grWtUnit', special: 'uqc' },
  { name: 'sealType', special: 'sealType' },
  { name: 'autoField_20', label: text.units },
  { name: 'autoField_21', label: text.unitPkgs },
  { name: 'transshipperCode', label: 'TransShipper Cd', placeholder: 'TRANSSHIPPER CODE' },
  { name: 'gatewayPort', special: 'gatewayPort' },
  { name: 'warehouseCode', label: 'Warehouse Code', placeholder: 'WAREHOUSE CODE' },
  { name: 'autoField_22', label: text.masterNo, placeholder: text.masterNo.toUpperCase() },
  { name: 'autoField_23', label: text.masterDate, special: 'date' },
  { name: 'autoField_24', label: text.houseNo, placeholder: text.houseNo.toUpperCase() },
  { name: 'autoField_25', label: text.houseDate, special: 'date' },
  { name: 'carrierName', special: 'carrier' },
  { name: 'sbNumber', special: 'sbNumber' },
  { name: 'autoField_26', special: 'sbDate' },
  { name: 'epCopyNo', label: 'EP Copy No', placeholder: 'EP COPY NO' },
  { name: 'autoField_27', label: 'EP Copy Date', special: 'date' },
  { name: 'grnNo', label: 'GRN No', placeholder: 'GRN NO' },
  { name: 'poNo', label: 'PO No.', placeholder: 'PO NO.' },
  { name: 'serviceType', label: 'Service Type', placeholder: 'SERVICE TYPE' },
  { name: 'headDesc', label: 'Head Desc', placeholder: 'HEAD DESC' },
  { name: 'referenceNo1', label: 'Refernce No1', placeholder: 'REFERENCE NO1' },
  { name: 'packingDetails', special: 'packing' },
  { name: 'containerDetails', special: 'containers' },
  { name: 'referenceNo2', label: 'Refernce No2', placeholder: 'REFERENCE NO2' },
  { name: 'etpDetails', special: 'etp' },
];

function WindowSwitch({ label, flag, onFlagChange, onOpen, buttonText, title }) {
  return (
    <Field label={label} labelWidth={LABEL_WIDTH}>
      <SelectBox className="tw:w-[58px] tw:flex-none" options={YES_NO_SWITCH} value={flag === 'Y' ? 'Y' : 'N'} onValueChange={onFlagChange} />
      <Button size="sm" variant="secondary" title={title} onClick={onOpen}>{buttonText}</Button>
    </Field>
  );
}

function UqcField({ label, name, ctx }) {
  const { exportData, setField, uqcs } = ctx;
  return (
    <Field label={label} labelWidth={LABEL_WIDTH}>
      <ComboInput placeholder="UQC" options={uqcs} {...UQC_LIST} value={exportData[name] || ''} onValueChange={setField(name)} onSelect={(uqc) => setField(name)(uqc.uqcCode)} />
    </Field>
  );
}

function specialFieldsFor(ctx, text) {
  const {
    exportData, setExportData, setField, handleChange, shipmentMode, indianPorts, vessels, airlines,
    packingFlag, containerFlag, etpFlag, packingList, containerList, changePackingFlag, changeContainerFlag, changeEtpFlag,
    setIsPackingModalOpen, setIsContainerModalOpen,
  } = ctx;
  const isSea = shipmentMode === 'SEA';
  const carrierName = (carrier) => (isSea ? carrier.vesselName : carrier.name);

  return {
    uqc: <UqcField label="Unit" name="grWtUnit" ctx={ctx} />,
    sealType: (
      <Field label="Seal Type [A/S/W]" labelWidth={LABEL_WIDTH}>
        <SelectBox clearable clearLabel="Select" placeholder="Select" className="tw:w-full" options={SEAL_TYPES} value={exportData.sealType || ''} onValueChange={setField('sealType')} />
      </Field>
    ),
    gatewayPort: (
      <Field label="Gateway Port" labelWidth={LABEL_WIDTH}>
        <ComboInput placeholder="GATEWAY PORT" options={indianPorts} getValue={(port) => port.portCode} getLabel={(port) => port.portName}
          filter={(port, query) => includesText(port.portName, query) || includesText(port.portCode, query)}
          value={exportData.gatewayPort || ''} onValueChange={setField('gatewayPort')} onSelect={(port) => setField('gatewayPort')(port.portCode)} />
      </Field>
    ),
    date: (name, label) => (
      <Field label={label} labelWidth={LABEL_WIDTH}>
        <DateInput name={name} value={exportData[name] || ''} onChange={handleChange} />
      </Field>
    ),
    carrier: (
      <Field label={text.carrier} labelWidth={LABEL_WIDTH}>
        <ComboInput placeholder={text.carrier.toUpperCase()} options={isSea ? vessels : airlines} getValue={carrierName} getLabel={() => ''}
          filter={(carrier, query) => includesText(carrierName(carrier), query)}
          value={exportData.carrierName || ''} onValueChange={setField('carrierName')} onSelect={(carrier) => setField('carrierName')(carrierName(carrier))} />
      </Field>
    ),
    // one SB No for the whole system: SB Track / ICEGATE fill sbNo, the job list and dashboard read it
    sbNumber: (
      <Field label="SB Number" labelWidth={LABEL_WIDTH}>
        <Input name="sbNumber" placeholder="SB NUMBER" maxLength={10} value={exportData.sbNo || exportData.sbNumber || ''}
          onChange={(event) => { const sbNo = event.target.value.replace(/\D/g, ''); setExportData((prev) => ({ ...prev, sbNo, sbNumber: sbNo })); }} />
      </Field>
    ),
    sbDate: (
      <Field label="SB Date" labelWidth={LABEL_WIDTH}>
        <DateInput name="autoField_26" value={isoDay(exportData.autoField_26 || exportData.sbDate)}
          onValueChange={(sbDate) => setExportData((prev) => ({ ...prev, autoField_26: sbDate, sbDate }))} />
      </Field>
    ),
    packing: (
      <WindowSwitch label="Packing Details" flag={packingFlag} onFlagChange={changePackingFlag} onOpen={() => setIsPackingModalOpen(true)}
        title="Open packing details" buttonText={packingList.length ? `${packingList.length} row(s)` : 'Open'} />
    ),
    containers: (
      <WindowSwitch label={isSea ? 'Container Details' : 'ULD Details'} flag={containerFlag} onFlagChange={changeContainerFlag} onOpen={() => setIsContainerModalOpen(true)}
        title="Open the list" buttonText={containerList.length ? `${containerList.length} ${isSea ? 'cont.' : 'ULD'}` : 'Open'} />
    ),
    etp: (
      <Field label="ETP Details" labelWidth={LABEL_WIDTH}>
        <FlagInput value={etpFlag} onValueChange={changeEtpFlag} />
      </Field>
    ),
  };
}

function MarksRow({ exportData, handleChange, setIsMarksNoModalOpen }) {
  return (
    <div className={FIELD_ROW}>
      <Field label="Marks No" labelWidth={LABEL_WIDTH} className="tw:lg:flex-[1.4]">
        <Input name="autoField_16" value={exportData.autoField_16 || ''} onChange={handleChange} />
        <Button variant="default" onClick={() => setIsMarksNoModalOpen(true)}>Show Marks No</Button>
      </Field>
      <Input name="thisDisplayOnlyInChecklistNotInCustomFlatFile" className="tw:flex-1 tw:text-muted-foreground" title="Shown only on the checklist, not sent to Customs"
        placeholder="THIS DISPLAY ONLY IN CHECKLIST NOT IN CUSTOM FLAT FILE." value={exportData.thisDisplayOnlyInChecklistNotInCustomFlatFile || ''} onChange={handleChange} />
    </div>
  );
}

export default function Sb2DetailsSection({ ctx }) {
  const { exportData, handleChange, setField, shipmentMode, factoryStuffed, changeFactoryStuffed, setIsMarksNoModalOpen } = ctx;
  const text = MODE_TEXT[shipmentMode] || MODE_TEXT.OTHER;
  const specialFields = specialFieldsFor(ctx, text);
  const drawField = ({ special, ...field }) => {
    if (special === 'date') return specialFields.date(field.name, field.label);
    if (special) return specialFields[special];
    return <TextField {...field} labelWidth={LABEL_WIDTH} exportData={exportData} onChange={handleChange} />;
  };

  return (
    <Section title="SB2 Details">
      <div className={FIVE_COLUMNS}>
        {/* goes to the SB JSON as stuffModel.sampleAccompanied */}
        <Field label="Sample Accomp." labelWidth={LABEL_WIDTH}>
          <SelectBox className="tw:w-full" options={NO_YES} value={/^Y/i.test(String(exportData.autoField_32 || '')) ? 'Yes' : 'No'} onValueChange={setField('autoField_32')} />
        </Field>
        <Field label="Factory Stuffed" labelWidth={LABEL_WIDTH}>
          <SelectBox className="tw:w-full" options={NO_YES} value={factoryStuffed} onValueChange={changeFactoryStuffed} />
        </Field>
        <Field label="Nature Of Cargo" required labelWidth={LABEL_WIDTH}>
          <SelectBox required clearable clearLabel="Select" placeholder="Select" className="tw:w-full" options={shipmentMode === 'AIR' ? PACKAGED_CARGO : SEA_CARGO}
            value={exportData.natureOfCargo || ''} onValueChange={setField('natureOfCargo')} />
        </Field>
        <TextField label="Total Packages" name="autoField_14" labelWidth={LABEL_WIDTH} exportData={exportData} onChange={handleChange} />
        <UqcField label="Unit" name="pkgsUnit" ctx={ctx} />
      </div>

      <MarksRow exportData={exportData} handleChange={handleChange} setIsMarksNoModalOpen={setIsMarksNoModalOpen} />

      <div className={FIVE_COLUMNS}>
        {fieldsFor(text).map((field) => <Fragment key={field.name}>{drawField(field)}</Fragment>)}
      </div>
    </Section>
  );
}
