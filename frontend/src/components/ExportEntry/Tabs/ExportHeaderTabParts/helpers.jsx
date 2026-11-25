import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ComboInput, Field, Input } from '@/components/ui';
import { partyClass, partyMerc, registrationTypeOf } from './hooks/partyCodes';
import { includesText, PORT_LIST } from './headerLists';

// one letter matches thousands of ports / party branches: only the best matches are drawn
const MAX_ROWS = 60;

export function WarningText({ children }) {
  return <span className="tw:text-[10px] tw:font-bold tw:text-destructive">⚠ {children}</span>;
}

export function TextField({ label, name, exportData, onChange, required, labelWidth, className, ...inputProps }) {
  return (
    <Field label={label} required={required} labelWidth={labelWidth} className={className}>
      <Input name={name} required={required} value={exportData[name] || ''} onChange={onChange} {...inputProps} />
    </Field>
  );
}

// a name box with a type-ahead list and the code box beside it
export function NameCodeField({ label, labelWidth, required, className, code, ...combo }) {
  return (
    <Field label={label} labelWidth={labelWidth} required={required} className={cn('tw:flex-1', className)}>
      <ComboInput {...combo} />
      {code}
    </Field>
  );
}

// port code boxes can be typed (5 / 6 letters, e.g. AEDXB) when the port is not in the list
export function PortCodeInput({ name, exportData, setExportData }) {
  const code = exportData[name] || '';
  return (
    <Input
      required
      maxLength={6}
      title="Port code (can be typed)"
      aria-invalid={Boolean(code) && code.length !== 5 && code.length !== 6}
      className="tw:w-[60px] tw:flex-none"
      value={code}
      onChange={(event) => { const typed = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); setExportData((prev) => ({ ...prev, [name]: typed })); }}
    />
  );
}

const portRank = (port, query) => {
  const code = port.portCode?.toLowerCase() || '';
  const name = port.portName?.toLowerCase() || '';
  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  return code.includes(query) ? 3 : 4;
};

const bestPortMatches = (ports, typed) => {
  const query = typed.toLowerCase();
  return ports
    .filter((port) => port.portCode?.toLowerCase().includes(query) || port.portName?.toLowerCase().includes(query))
    .sort((a, b) => portRank(a, query) - portRank(b, query))
    .slice(0, MAX_ROWS);
};

// Location (customs port): typed text only searches, the port is taken when picked
export function CustomsPortSelect({ ports, exportData, setExportData, id }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => (query ? bestPortMatches(ports, query) : []), [ports, query]);
  const selectPort = (port) => setExportData((prev) => ({ ...prev, customsPortCode: port.portCode, customsPortName: port.portName }));

  return (
    <>
      <ComboInput id={id} required placeholder="PORT CODE" className="tw:w-[70px] tw:flex-none" listClassName="tw:min-w-72"
        options={matches} filter={() => true} limit={MAX_ROWS} {...PORT_LIST}
        value={exportData.customsPortCode || ''} onValueChange={setQuery} onFocus={() => setQuery('')} onSelect={selectPort} />
      <Input readOnly placeholder="PORT NAME" value={exportData.customsPortName || ''} />
    </>
  );
}

const PARTY_ROLES = {
  SHIPPER: { isRole: (party) => party.isShipper, nameKey: 'shipperName', idKey: 'shipperId', required: true },
  SUBAGENT: { isRole: (party) => party.isSubAgent, nameKey: 'subAgentName', idKey: 'subAgentId', required: false },
  CONSIGNEE: { isRole: (party) => party.isConsignee, nameKey: 'consigneeName', idKey: 'consigneeId', required: true },
};

// one option per party branch (a party without branches is one option with its own address)
const partyOptions = (parties, type) => parties.filter(PARTY_ROLES[type].isRole).flatMap((party) => {
  const common = { partyId: party.id, partyName: party.name, taxId: party.taxId, panNumber: party.panNumber, mercManuf: party.mercManuf, country: party.countryCode };
  if (!party.branches?.length) {
    return [{ ...common, branchSrNo: '', address1: party.street, address2: '', city: party.city, state: party.stateProvince, pinCode: party.zipPostcode, gstin: party.panNumber }];
  }
  return party.branches.map((branch) => ({
    ...common, branchSrNo: branch.branchSrNo, address1: branch.address1, address2: branch.address2, city: branch.city, state: branch.state,
    pinCode: branch.pinCode, gstin: branch.gstin || branch.regNo || party.panNumber,
  }));
});

function shipperFields(option, party, previous) {
  const adCodes = party?.adCodes || [];
  const registrationNo = String(option.gstin || '').trim().toUpperCase();
  const registrationType = registrationTypeOf(registrationNo, previous.shipperGstinType);
  const gstStateCode = /^[0-9]{2}/.exec(registrationNo);
  const drawbackAccount = party?.drawbackAccounts?.[0];
  return {
    shipperId: option.partyId,
    shipperName: option.partyName,
    shipperIec: option.taxId || '',
    shipperGstin: registrationNo,
    shipperGstinType: registrationType,
    mercManuf: partyMerc(option.mercManuf) || 'M',
    shipperClass: partyClass(party?.classType) || previous.shipperClass || 'P',
    shipperBranchSrNo: option.branchSrNo,
    shipperAddress1: option.address1 || '',
    shipperAddress2: option.address2 || '',
    shipperCity: option.city || '',
    shipperState: option.state || '',
    shipperPin: option.pinCode || '',
    adCode: adCodes.length === 1 ? adCodes[0].adCode : previous.adCode || '',
    panNo: option.panNumber || '',
    autoField_12: option.panNumber || previous.autoField_12 || '',
    // the state of origin of the goods is the exporter's state when not chosen yet
    ...(!previous.stateOriginCode && gstStateCode && registrationType === 'GSTIN' ? { stateOriginCode: gstStateCode[0] } : {}),
    drawbackAcNo: drawbackAccount?.accountNo || '',
    ifscCd: drawbackAccount?.ifscCode || '',
    forexCode: drawbackAccount?.bankName || '',
  };
}

function pickedPartyFields(option, type, parties, previous) {
  if (type === 'SHIPPER') return shipperFields(option, parties.find((party) => party.id === option.partyId), previous);
  if (type === 'SUBAGENT') {
    return {
      subAgentId: option.partyId,
      subAgentName: option.partyName,
      subAgentAddress1: [option.address1, option.address2, option.city, option.state, option.pinCode, option.country].filter(Boolean).join(', '),
    };
  }
  return {
    consigneeId: option.partyId,
    consigneeName: option.partyName,
    consigneeAddress1: option.address1 || '',
    consigneeAddress2: option.address2 || '',
    consigneeAddress3: '',
    consigneeCity: option.city || '',
    consigneeCountry: option.country || '',
    consigneeCountryCode: option.country || '',
  };
}

function PartyOption({ option }) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      <span className="tw:truncate tw:font-semibold tw:text-primary">{option.partyName}</span>
      <span className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{option.address1}{option.city ? `, ${option.city}` : ''}</span>
    </div>
  );
}

// type: SHIPPER | SUBAGENT | CONSIGNEE. A typed name is kept as typed (and unlinks the party) until one is picked.
export function PartySelect({ parties, type, exportData, setExportData, id }) {
  const role = PARTY_ROLES[type];
  const [query, setQuery] = useState('');
  const options = useMemo(() => partyOptions(parties, type), [parties, type]);
  const matches = useMemo(() => (query
    ? options.filter((option) => includesText(option.partyName, query) || includesText(option.address1, query)).slice(0, MAX_ROWS)
    : []), [options, query]);

  const typeName = (name) => {
    setQuery(name);
    setExportData((prev) => ({ ...prev, [role.nameKey]: name, [role.idKey]: null }));
  };

  return (
    <ComboInput
      id={id}
      required={role.required}
      placeholder={`Search ${type}...`}
      listClassName="tw:min-w-80"
      options={matches}
      filter={() => true}
      limit={MAX_ROWS}
      getValue={(option) => option.partyName}
      renderOption={(option) => <PartyOption option={option} />}
      value={exportData[role.nameKey] || ''}
      onValueChange={typeName}
      onFocus={() => setQuery('')}
      onSelect={(option) => setExportData((prev) => ({ ...prev, ...pickedPartyFields(option, type, parties, prev) }))}
    />
  );
}
