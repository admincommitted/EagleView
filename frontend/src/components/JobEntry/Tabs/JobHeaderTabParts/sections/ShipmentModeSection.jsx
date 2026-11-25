import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ActionMenu, Button, ComboInput, DateInput, Field, FlagInput, Input, NumberInput, Section, SelectBox } from '@/components/ui';
import { jobEntryApi } from '../../../jobEntryApi';
import { loadForeignPorts } from '../../../../../utils/foreignPorts';
import { RichPartySelect } from '../RichPartySelect';
import { RichPortSelect } from '../helpers';
import { CTX_OPTIONS, ctxCode } from '../ctxCodes';

const SHIPMENT_MODES = [{ value: 'S', label: 'SEA' }, { value: 'A', label: 'AIR' }, { value: 'L', label: 'LAND' }];
const BE_TYPES = [{ value: 'H', label: 'HOME (H)' }, { value: 'W', label: 'WAREHOUSE (W)' }, { value: 'X', label: 'EX-BOND (X)' }];
const EX_BOND_FIELDS = [
  { key: 'warehouseBENo', label: 'WH BE No', maxLength: 7, digitsOnly: true },
  { key: 'warehouseBEDate', label: 'WH BE Date', isDate: true },
  { key: 'warehouseCode', label: 'Warehouse Code', maxLength: 8 },
  { key: 'warehouseCustomSiteId', label: 'WH Custom Site', maxLength: 6 },
];
const FILLED_FROM_MASTER = 'This code is filled from the party / branch master when you pick the importer';
const INDIA_UTC_OFFSET_MS = 19800000;
const EARLIEST_JOB_DATE = '2015-01-01';
const NO_ROWS = [];
const FIELD_ROW = 'tw:flex tw:flex-col tw:gap-2 tw:lg:flex-row tw:lg:items-center tw:lg:gap-4';
const HALF_ROW = 'tw:flex tw:flex-1 tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-center tw:md:gap-4';

const upper = (value) => String(value || '').trim().toUpperCase();
const includesText = (text, query) => String(text || '').toLowerCase().includes(query.toLowerCase());
const matchCountry = (country, query) => includesText(country.name, query) || includesText(country.code, query);
const matchPort = (port, query) => includesText(port.portName, query) || includesText(port.portCode, query) || includesText(port.extra, query);
const portLabel = (port) => port.portName + (port.extra && port.extra !== port.portName ? ` - ${port.extra}` : '');
const todayInIndia = () => new Date(Date.now() + INDIA_UTC_OFFSET_MS).toISOString().slice(0, 10);
const firstFilled = (...values) => values.map((value) => (value == null ? '' : String(value))).find((value) => value !== '') || '';

// the date box wants YYYY-MM-DD; a WH BE date may come as YYYYMMDD or dd/mm/yyyy
const isoDate = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};

const countryNameIn = (countries, code) => (code ? countries.find((country) => upper(country.code) === upper(code))?.name || '' : '');

const portCountry = (port) => {
  if (!port) return '';
  if (port.countryCode) return upper(port.countryCode);
  const fromName = /\(([A-Z]{2})\)\s*$/.exec(upper(port.country));
  if (fromName) return fromName[1];
  const code = upper(port.portCode);
  return code.length === 5 || (code.length === 6 && code.startsWith('IN')) ? code.slice(0, 2) : '';
};

let airportCache = null;
const requestAirportCodes = async () => {
  try {
    const rows = await jobEntryApi.airports();
    const seen = new Set();
    return (Array.isArray(rows) ? rows : [])
      .map((airport) => ({ portCode: upper(airport.iataCode), portName: upper(airport.cityName || airport.airportName), extra: upper(airport.airportName), countryCode: airport.countryCode, category: 'AIRPORT' }))
      .filter((airport) => /^[A-Z]{3}$/.test(airport.portCode) && !seen.has(airport.portCode) && seen.add(airport.portCode));
  } catch {
    airportCache = null;
    return [];
  }
};
const loadAirportCodes = () => {
  airportCache ??= requestAirportCodes();
  return airportCache;
};

function NameCodeField({ label, labelWidth, required, code, ...combo }) {
  return (
    <Field label={label} labelWidth={labelWidth} required={required} className="tw:flex-1">
      <ComboInput required={required} {...combo} />
      <Input placeholder="CODE" required={required} className="tw:w-[70px] tw:flex-none tw:uppercase" {...code} />
    </Field>
  );
}

function Row({ children }) {
  return <div className={FIELD_ROW}>{children}</div>;
}

export default function ShipmentModeSection({ ctx }) {
  const { chaList = [], beType, handleChange, handleImporterBranchChange, importerBranches, jobData, masters, parties, ports, setBeType, setIsBondModalOpen, setIsCertModalOpen, setIsWarehouseModalOpen, setJobData, setSubAgent, setTransportMode, subAgent, subagentBranches = [], handleSubagentBranchChange, transportMode } = ctx;
  const countries = masters?.countries || NO_ROWS;
  const states = masters?.states || NO_ROWS;
  const setField = (name) => (value) => handleChange({ target: { name, value } });

  const [foreignPorts, setForeignPorts] = useState([]);
  useEffect(() => {
    const loadPorts = async () => setForeignPorts(await loadForeignPorts());
    loadPorts();
  }, []);

  // an Air BE files the 3-letter airport code as Origin / Shipment Port: airports come first, UN/LOCODEs below
  const [airports, setAirports] = useState([]);
  useEffect(() => {
    if (transportMode !== 'A') return;
    const loadAirports = async () => setAirports(await loadAirportCodes());
    loadAirports();
  }, [transportMode]);

  const portOptions = useMemo(() => {
    const air = transportMode === 'A' ? airports : [];
    const airCodes = new Set(air.map((port) => port.portCode));
    const masterPorts = (ports || []).filter((port) => !airCodes.has(upper(port.portCode)));
    const known = new Set([...airCodes, ...masterPorts.map((port) => upper(port.portCode))]);
    return [...air, ...masterPorts, ...foreignPorts.filter((port) => !known.has(port.portCode))];
  }, [ports, foreignPorts, airports, transportMode]);

  const originCountryCode = upper(jobData.countryOfOrigin || jobData.autoField_20);
  const consignmentCountryCode = upper(jobData.countryOfConsignment || jobData.autoField_21);
  const originPortCode = upper(jobData.portOfOrigin || jobData.autoField_22);
  const shipmentPortCode = upper(jobData.portOfShipment);

  // ports of the Country of Consignment first, then of the Country of Origin, then the rest; Indian ports last
  const portsByCountry = useMemo(() => {
    const consignment = [], origin = [], others = [], indian = [];
    for (const port of portOptions) {
      const country = portCountry(port);
      if (consignmentCountryCode && country === consignmentCountryCode) consignment.push(port);
      else if (originCountryCode && country === originCountryCode) origin.push(port);
      else if (country === 'IN') indian.push(port);
      else others.push(port);
    }
    return [...consignment, ...origin, ...others, ...indian];
  }, [portOptions, consignmentCountryCode, originCountryCode]);

  const portNotes = useMemo(() => {
    const notes = [];
    const countryOfPort = (code) => (code ? portCountry(portOptions.find((port) => upper(port.portCode) === code)) : '');
    const countryLabel = (code) => countryNameIn(countries, code) || code;
    const originPortCountry = countryOfPort(originPortCode);
    const shipmentPortCountry = countryOfPort(shipmentPortCode);
    if (originPortCountry === 'IN') notes.push(`Origin Port ${originPortCode} is an Indian port - an import comes from a port abroad.`);
    else if (originPortCountry && (originCountryCode || consignmentCountryCode) && originPortCountry !== originCountryCode && originPortCountry !== consignmentCountryCode) {
      notes.push(`Origin Port ${originPortCode} is in ${countryLabel(originPortCountry)} - not the Country of Origin${originCountryCode ? ` (${countryLabel(originCountryCode)})` : ''} or of Consignment${consignmentCountryCode ? ` (${countryLabel(consignmentCountryCode)})` : ''}.`);
    }
    if (shipmentPortCountry === 'IN') notes.push(`Shipment Port ${shipmentPortCode} is an Indian port.`);
    return notes;
  }, [portOptions, originPortCode, shipmentPortCode, originCountryCode, consignmentCountryCode, countries]);

  const portName = (code) => (code ? portOptions.find((port) => upper(port.portCode) === upper(code))?.portName || '' : '');
  // typed text (not picked) keeps the code only when it is an exact name or code - the code is what is filed
  const countryCodeFor = (text) => { const typed = upper(text); return typed ? countries.find((country) => upper(country.name) === typed || upper(country.code) === typed)?.code || '' : ''; };
  const portCodeFor = (text) => { const typed = upper(text); return typed ? portOptions.find((port) => upper(port.portName) === typed || upper(port.portCode) === typed)?.portCode || '' : ''; };

  const countryCombo = (nameKey, codeKey, aliasKey, placeholder) => ({
    placeholder,
    options: countries,
    getValue: (country) => country.code,
    getLabel: (country) => country.name,
    filter: matchCountry,
    value: jobData[nameKey] ?? countryNameIn(countries, jobData[codeKey] || jobData[aliasKey]),
    onValueChange: (text) => setJobData((prev) => ({ ...prev, [nameKey]: text, [codeKey]: countryCodeFor(text), [aliasKey]: countryCodeFor(text) })),
    onSelect: (country) => setJobData((prev) => ({ ...prev, [nameKey]: country.name, [codeKey]: country.code, [aliasKey]: country.code })),
    code: { name: codeKey, readOnly: true, value: jobData[codeKey] || jobData[aliasKey] || '' },
  });

  // a port picked while Country of Consignment is blank fills it (Country of Origin decides the duty: never guessed)
  const consignmentFromPort = (prev, port) => {
    const country = portCountry(port);
    const name = countryNameIn(countries, country);
    return country && country !== 'IN' && !(prev.countryOfConsignment || prev.autoField_21) && name
      ? { countryOfConsignmentName: name, countryOfConsignment: country, autoField_21: country }
      : {};
  };
  const portCombo = (nameKey, codeKey, aliasKey, placeholder) => ({
    placeholder,
    options: portsByCountry,
    getValue: (port) => port.portCode,
    getLabel: portLabel,
    filter: matchPort,
    value: jobData[nameKey] ?? portName(jobData[codeKey] || (aliasKey && jobData[aliasKey])),
    onValueChange: (text) => {
      const code = portCodeFor(text);
      setJobData((prev) => ({ ...prev, [nameKey]: text, [codeKey]: code, ...(aliasKey && { [aliasKey]: code }) }));
    },
    onSelect: (port) => setJobData((prev) => ({ ...prev, ...consignmentFromPort(prev, port), [nameKey]: port.portName, [codeKey]: port.portCode, ...(aliasKey && { [aliasKey]: port.portCode }) })),
  });

  const changeJobDate = (value) => {
    const today = todayInIndia();
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < EARLIEST_JOB_DATE)) return;
    if (value && value > today) { toast.error('Job Date cannot be after today'); return; }
    setJobData((prev) => ({ ...prev, jobDate: value || today }));
  };
  const setExBondField = (key) => (value) => setJobData((prev) => ({ ...prev, [key]: value }));
  const yesNoWithModal = (key, openModal) => (value) => {
    const flag = value || 'N';
    setJobData((prev) => ({ ...prev, [key]: flag }));
    if (flag === 'Y') openModal(true);
  };

  const importerBranchSrNo = firstFilled(jobData.branchSrNo, jobData.autoField_48);
  const importerBranchOptions = [
    ...importerBranches.map((branch) => ({ value: String(branch.branchSrNo), label: `${branch.branchSrNo} - ${branch.branchName || branch.city}` })),
    ...(importerBranchSrNo && !importerBranches.some((branch) => String(branch.branchSrNo) === importerBranchSrNo) ? [{ value: importerBranchSrNo, label: `${importerBranchSrNo} (on this job)` }] : []),
  ];
  const subagentBranchOptions = subagentBranches.map((branch) => ({ value: String(branch.branchSrNo), label: `${branch.branchSrNo} - ${branch.branchName || branch.city}` }));

  return (
    <>
      <div className="tw:flex tw:flex-col tw:gap-1.5 tw:rounded-sm tw:border tw:border-border tw:bg-page tw:px-2 tw:py-1.5">
        <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:flex-wrap tw:md:items-center tw:md:gap-8">
          <Field label="Shipment Mode" required>
            <SelectBox required className="tw:w-full tw:font-semibold tw:md:w-[120px]" options={SHIPMENT_MODES} value={transportMode} onValueChange={setTransportMode} />
          </Field>
          <Field label="BE Type [H/W/X]" required>
            <SelectBox required className="tw:w-full tw:font-semibold tw:md:w-[120px]" options={BE_TYPES} value={beType}
              onValueChange={(value) => { setBeType(value); if (value.toUpperCase() === 'W') setIsWarehouseModalOpen(true); }} />
          </Field>
          <Field label="Job Date" required>
            <DateInput name="jobDate" required wrapperClassName="tw:w-full tw:md:w-[130px]" value={isoDate(jobData.jobDate)} onValueChange={changeJobDate} />
          </Field>
        </div>
        {beType === 'X' && (
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-4 tw:gap-y-2 tw:md:gap-4">
            <span className="tw:text-entry tw:font-bold tw:text-head">Ex-Bond of WH BE{jobData.inBondJobNo ? ` (job ${jobData.inBondJobNo})` : ''}</span>
            {EX_BOND_FIELDS.map(({ key, label, maxLength, digitsOnly, isDate }) => (
              <Field key={key} label={label} required>
                {isDate ? (
                  <DateInput name={key} required wrapperClassName="tw:w-[130px]" value={isoDate(jobData[key])} onValueChange={setExBondField(key)} />
                ) : digitsOnly ? (
                  <NumberInput name={key} required decimals={0} maxLength={maxLength} className="tw:w-[110px]" value={jobData[key] || ''} onValueChange={setExBondField(key)} />
                ) : (
                  <Input name={key} required maxLength={maxLength} className="tw:w-[110px]" value={jobData[key] || ''} onChange={(e) => setExBondField(key)(e.target.value.toUpperCase())} />
                )}
              </Field>
            ))}
          </div>
        )}
      </div>

      <Section title="Importer Details">
        <Row>
          <Field label="Location" required labelWidth="120px" className="tw:flex-1">
            <RichPortSelect ports={ports} jobData={jobData} setJobData={setJobData} />
          </Field>
          <div className={HALF_ROW}>
            <Field label="Govt. IEC" labelWidth="80px">
              <FlagInput name="autoField_46" value={jobData.autoField_46 || 'N'} onValueChange={(value) => setField('autoField_46')(value || 'N')} />
            </Field>
            <Field label="CHA Details" required labelWidth="80px" className="tw:flex-1">
              <ComboInput name="chaCode" required placeholder="Select from CHA Master" title="CHA Master (Settings) - NAME - CODE"
                options={chaList.map((cha) => `${cha.chaName} - ${cha.chaCode}`)}
                value={jobData.chaCode || jobData.autoField_3 || ''} onValueChange={setField('chaCode')} />
            </Field>
          </div>
        </Row>

        <Row>
          <Field label="IEC Name" required labelWidth="120px" className="tw:flex-1">
            <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} masters={masters} />
          </Field>
          <div className={HALF_ROW}>
            <Field label="IEC Code" required labelWidth="80px" className="tw:flex-1">
              <Input name="iecCode" required value={jobData.iecCode || jobData.autoField_5 || ''} onChange={handleChange} />
            </Field>
            <Field label="Branch Sr. No." required labelWidth="120px" className="tw:flex-1">
              <SelectBox name="branchSrNo" required clearable clearLabel="Select Branch" placeholder="Select Branch" className="tw:w-full"
                options={importerBranchOptions} value={importerBranchSrNo}
                onValueChange={(value) => handleImporterBranchChange({ target: { name: 'branchSrNo', value } })} />
            </Field>
          </div>
        </Row>

        <Row>
          <Field label="Address 1" required labelWidth="120px" className="tw:flex-1">
            <Input name="address1" required value={jobData.address1 || jobData.autoField_6 || ''} onChange={handleChange} />
          </Field>
          <Field label="Address 2" labelWidth="80px" className="tw:flex-1">
            <Input name="address2" value={jobData.address2 || jobData.autoField_7 || ''} onChange={handleChange} />
          </Field>
        </Row>

        <Row>
          <div className={HALF_ROW}>
            <Field label="City" required labelWidth="120px" className="tw:flex-1">
              <Input name="city" required value={jobData.city || jobData.autoField_8 || ''} onChange={handleChange} />
            </Field>
            <Field label="State" required labelWidth="40px" className="tw:flex-1">
              <ComboInput name="state" required options={states} getValue={(state) => state.stateName} getLabel={(state) => `${state.stateCode} - GST ${state.taxCode}`}
                value={jobData.state || jobData.autoField_9 || ''} onValueChange={setField('state')} />
            </Field>
          </div>
          <div className={HALF_ROW}>
            <Field label="Pin" required labelWidth="80px" className="tw:flex-1">
              <Input name="pin" required value={jobData.pin || jobData.autoField_10 || ''} onChange={handleChange} />
              <PinSuggest jobData={jobData} handleChange={handleChange} />
            </Field>
            <Field label="AD Code" labelWidth="80px" hint={FILLED_FROM_MASTER} className="tw:flex-1">
              <Input name="aeoCode" value={jobData.aeoCode || jobData.autoField_49 || ''} onChange={handleChange} />
            </Field>
          </div>
        </Row>

        <Row>
          <div className={HALF_ROW}>
            <Field label="CTX Type" required labelWidth="120px" className="tw:flex-1">
              <SelectBox name="autoField_50" required clearable clearLabel="Select" placeholder="Select" className="tw:w-full"
                options={CTX_OPTIONS} value={ctxCode(jobData.autoField_50)} onValueChange={setField('autoField_50')} />
            </Field>
            <Field label="CTX State" required labelWidth="70px" className="tw:flex-1">
              <ComboInput name="autoField_11" required options={states} getValue={(state) => state.stateName} getLabel={(state) => `${state.stateCode} - GST ${state.taxCode}`}
                value={jobData.autoField_11 || ''} onValueChange={setField('autoField_11')} />
            </Field>
          </div>
          <div className={HALF_ROW}>
            <Field label="State Code" required labelWidth="80px" className="tw:flex-1">
              <ComboInput name="autoField_12" required options={states} getValue={(state) => state.taxCode} getLabel={(state) => state.stateName}
                value={jobData.autoField_12 || ''} onValueChange={setField('autoField_12')} />
            </Field>
            <Field label="Registration No" required labelWidth="80px" className="tw:flex-1">
              <Input name="autoField_13" required value={jobData.autoField_13 || ''} onChange={handleChange} />
            </Field>
          </div>
        </Row>
      </Section>

      <Section title="SubAgent Details">
        <Field label="SubAgent Details [Y/N]" labelWidth="150px">
          <FlagInput value={subAgent} onValueChange={(value) => setSubAgent(value || 'N')} />
        </Field>
        {subAgent === 'Y' && (
          <div className={`${FIELD_ROW} tw:border-t tw:border-border tw:pt-2`}>
            <Field label="SubAgent Name" required labelWidth="150px" className="tw:flex-1">
              <RichPartySelect parties={parties} jobData={jobData} setJobData={setJobData} type="SUBAGENT" masters={masters} />
            </Field>
            <Field label="SubAgent Branch" labelWidth="110px" className="tw:flex-1"
              hint={subagentBranches.length ? 'Branch of the sub-agent as in its party master' : 'Pick the sub-agent first - its branches come from the party master'}>
              <SelectBox name="subagentBranchSrNo" clearable clearLabel="Select Branch" placeholder="Select Branch" className="tw:w-full"
                options={subagentBranchOptions} value={jobData.subagentBranchSrNo || ''}
                onValueChange={(value) => handleSubagentBranchChange({ target: { name: 'subagentBranchSrNo', value } })} />
            </Field>
            <Field label="SubAgent Address" labelWidth="120px" hint={FILLED_FROM_MASTER} className="tw:lg:flex-[2]">
              <Input name="subagentAddress" placeholder="SUBAGENT ADDRESS" value={jobData.subagentAddress || ''} onChange={handleChange} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Shipment Details">
        <Row>
          <Field label="User Job No" labelWidth="165px" className="tw:flex-1">
            <Input name="userJobNo" placeholder="USER JOB NO" value={jobData.userJobNo || ''} onChange={handleChange} />
          </Field>
          <div className={HALF_ROW}>
            <Field label="Port Code" required labelWidth="80px" className="tw:flex-1">
              <ComboInput name="portCode" required placeholder="PORT CODE" options={ports || []} getValue={(port) => port.portCode} getLabel={(port) => port.portName}
                value={jobData.portCode || ''} onValueChange={setField('portCode')} />
            </Field>
            <Field label="Trans. Mode" labelWidth="80px" className="tw:flex-1">
              <Input name="trans" placeholder="TRANS" value={jobData.trans || ''} onChange={handleChange} />
            </Field>
          </div>
        </Row>

        <Row>
          <NameCodeField label="Country Of Origin" labelWidth="165px" required {...countryCombo('countryOfOriginName', 'countryOfOrigin', 'autoField_20', 'COUNTRY OF ORIGIN')} />
          <NameCodeField label="Origin Port" labelWidth="80px" required {...portCombo('portOfOriginName', 'portOfOrigin', 'autoField_22', 'PORT OF ORIGIN')}
            code={{ name: 'portOfOrigin', readOnly: true, value: jobData.portOfOrigin || jobData.autoField_22 || '' }} />
          {/* ICES: the origin port is where the goods come from, the shipment port is where they were loaded */}
          <NameCodeField label="Shipment Port" labelWidth="110px" {...portCombo('portOfShipmentName', 'portOfShipment', undefined, 'PORT OF SHIPMENT')}
            code={{
              name: 'portOfShipment', maxLength: 6, title: 'Blank = the Origin Port is filed as the port of shipment', value: jobData.portOfShipment || '',
              onChange: (e) => { const code = e.target.value.toUpperCase(); setJobData((prev) => ({ ...prev, portOfShipment: code, portOfShipmentName: portName(code) })); },
            }} />
        </Row>
        {portNotes.length > 0 && <p className="tw:m-0 tw:text-[11px] tw:text-warning">{portNotes.join('  ')}</p>}

        <Row>
          <NameCodeField label="Country Of Consignment" labelWidth="165px" required {...countryCombo('countryOfConsignmentName', 'countryOfConsignment', 'autoField_21', 'COUNTRY OF CONSIGNMENT')} />
          <div className={`${HALF_ROW} tw:lg:flex-[2]`}>
            <Field label="Bond" labelWidth="80px" className="tw:flex-1">
              <FlagInput value={jobData.bond || 'N'} onValueChange={yesNoWithModal('bond', setIsBondModalOpen)} />
            </Field>
            <Field label="Certificate" labelWidth="80px" className="tw:flex-1">
              <FlagInput value={jobData.certificate || 'N'} onValueChange={yesNoWithModal('certificate', setIsCertModalOpen)} />
            </Field>
          </div>
        </Row>
      </Section>
    </>
  );
}

// ICEGATE: "PIN is mandatory". The PINs known for the same IEC + branch are offered, never filled on their own
// (iCAFFE's own data sometimes has two PINs for one address).
function PinSuggest({ jobData, handleChange }) {
  const pin = String(jobData.pin || jobData.autoField_10 || '').trim();
  const iec = String(jobData.iecCode || jobData.autoField_5 || '').trim();
  const branchSrNo = String(jobData.branchSrNo ?? jobData.autoField_48 ?? '').trim();
  const address1 = String(jobData.address1 || jobData.autoField_6 || '').trim();
  const state = String(jobData.state || jobData.autoField_9 || '').trim();
  const needsPin = !/^[1-9]\d{5}$/.test(pin) && !!iec;
  const [knownPins, setKnownPins] = useState([]);

  useEffect(() => {
    if (!needsPin) { setKnownPins([]); return undefined; }
    let current = true;
    const loadKnownPins = async () => {
      try {
        const response = await jobEntryApi.pinSuggestions({ iec, branchSrNo: branchSrNo || '0', address1, state, jobId: String(jobData.id || '') });
        if (current) setKnownPins(response?.success && Array.isArray(response.data) ? response.data : []);
      } catch {
        if (current) setKnownPins([]);
      }
    };
    loadKnownPins();
    return () => { current = false; };
  }, [needsPin, iec, branchSrNo, address1, state, jobData.id]);

  if (!needsPin || !knownPins.length) return null;

  const pinDetails = (known) => [
    known.stateOk === false ? `not a ${state || 'state'} PIN` : '',
    known.master ? 'Party master' : '',
    known.jobs ? `${known.jobs} job${known.jobs > 1 ? 's' : ''}` : '',
    known.sameAddress ? `${known.sameAddress} same address` : '',
  ].filter(Boolean).join(' · ');

  const items = [
    ...knownPins.map((known) => ({
      label: known.pin,
      note: pinDetails(known),
      tone: known.stateOk === false ? 'danger' : undefined,
      onSelect: () => handleChange({ target: { name: 'pin', value: known.pin } }),
    })),
    { separator: true },
    { heading: 'Check the PIN against the importer branch address before filing' },
  ];

  return (
    <ActionMenu align="end" items={items}
      trigger={<Button size="sm" variant="warning" title="PINs used before for this importer and branch">Known PINs ({knownPins.length})</Button>} />
  );
}
