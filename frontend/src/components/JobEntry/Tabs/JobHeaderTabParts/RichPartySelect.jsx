import { useEffect, useMemo, useRef, useState } from 'react';
import { ComboInput } from '@/components/ui';
import { ctxCode, stateInfoFor } from './ctxCodes';

// one letter matches every party branch (tens of thousands): only the first rows are drawn
const MAX_PARTY_ROWS = 60;
const NAME_WRITE_DELAY_MS = 300;

const firstAdCode = (party) => party.adCodes?.[0]?.adCode || '';

const partyOptions = (parties, type) => (parties || [])
  .filter((party) => (type === 'SUBAGENT' ? party.isSubAgent : true))
  .flatMap((party) => {
    const common = { partyId: party.id, partyName: party.name, taxId: party.taxId, panNumber: party.panNumber, classType: party.classType || '', adCode: firstAdCode(party) };
    if (!party.branches?.length) {
      // no branch = no branch sr no (the validator asks for it), never a silent 1
      return [{ ...common, branchSrNo: '', address1: party.street, address2: '', city: party.city, state: party.stateProvince, pinCode: party.zipPostcode, gstin: '', stateCode: '' }];
    }
    return party.branches.map((branch) => ({
      ...common,
      branchSrNo: branch.branchSrNo, address1: branch.address1, address2: branch.address2, city: branch.city, state: branch.state, pinCode: branch.pinCode,
      gstin: branch.gstin || branch.regNo || '', stateCode: branch.ctxState || '', ctxType: branch.ctxType || '',
    }));
  })
  .map((option) => ({ ...option, searchName: String(option.partyName || '').toLowerCase(), searchAddress: String(option.address1 || '').toLowerCase() }));

const ctxOfOption = (option) => ctxCode(option.ctxType) || (option.gstin?.length === 15 ? 'G' : option.panNumber ? 'P' : '');

const nameOnJob = (jobData, type) => {
  if (type === 'SUBAGENT') return jobData.subagentName || '';
  if (type === 'HIGH_SEA') return jobData.autoField_40 || '';
  return jobData.nameOfImporter || jobData.autoField_4 || '';
};

const nameFields = (type, name) => {
  if (type === 'HIGH_SEA') return { autoField_40: name };
  if (type === 'SUBAGENT') return { subagentName: name };
  return { nameOfImporter: name, autoField_4: name };
};

const pickedPartyFields = (option, type, states) => {
  if (type === 'HIGH_SEA') {
    return {
      autoField_40: option.partyName, autoField_41: option.taxId || option.panNumber || '',
      autoField_42: option.address1 || '', autoField_43: option.address2 || '', autoField_44: option.city || '', autoField_45: option.pinCode || '',
      autoField_60: option.branchSrNo || '',
    };
  }
  if (type === 'SUBAGENT') {
    return {
      subagentName: option.partyName, subagentPartyId: option.partyId, subagentBranchSrNo: option.branchSrNo,
      subagentAddress: [option.address1, option.address2, option.city, option.state, option.pinCode].filter(Boolean).join(', '),
    };
  }
  const stateInfo = stateInfoFor(states, option.stateCode || option.state || '');
  const iec = option.taxId || option.panNumber || '';
  const registrationNo = option.gstin || option.panNumber || '';
  const ctxType = ctxOfOption(option);
  // the High Sea Sale seller boxes (autoField_40-45 / 60) and the importer type are left as they are
  return {
    nameOfImporter: option.partyName, autoField_4: option.partyName, importerPartyId: option.partyId,
    autoField_48: option.branchSrNo, branchSrNo: option.branchSrNo,
    iecCode: iec, autoField_5: iec,
    address1: option.address1 || '', autoField_6: option.address1 || '',
    address2: option.address2 || '', autoField_7: option.address2 || '',
    city: option.city || '', autoField_8: option.city || '',
    state: option.state || '', autoField_9: option.state || '',
    pin: option.pinCode || '', autoField_10: option.pinCode || '',
    autoField_13: registrationNo,
    commercialTaxType: ctxType, autoField_50: ctxType,
    ctxStateName: stateInfo.name, autoField_11: stateInfo.name,
    stateCode: stateInfo.taxCode, autoField_12: stateInfo.taxCode,
    commercialTaxRegistrationNo: registrationNo,
    aeoCode: option.adCode, autoField_49: option.adCode || '',
  };
};

function PartyOption({ option }) {
  if (option.moreNote) return <span className="tw:text-[10px] tw:text-muted-foreground tw:normal-case">{option.moreNote}</span>;
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      <span className="tw:truncate tw:font-semibold tw:text-primary">{option.partyName}</span>
      <span className="tw:truncate tw:text-[11px] tw:text-muted-foreground">{option.address1}{option.city ? `, ${option.city}` : ''}</span>
    </div>
  );
}

export function RichPartySelect({ parties, jobData, setJobData, type = 'IMPORTER', masters, id }) {
  const [query, setQuery] = useState('');
  const options = useMemo(() => partyOptions(parties, type), [parties, type]);

  const listed = useMemo(() => {
    const typed = query.toLowerCase();
    if (!typed) return [];
    const matches = options.filter((option) => option.searchName.includes(typed) || option.searchAddress.includes(typed));
    const shown = matches.slice(0, MAX_PARTY_ROWS);
    if (matches.length === shown.length) return shown;
    return [...shown, { moreNote: `First ${shown.length} of ${matches.length} shown - type more letters to narrow the list` }];
  }, [options, query]);

  // the typed name goes into the job a moment after typing stops (and at once on leaving the box):
  // writing it on every key redraws the whole job screen
  const pendingName = useRef(null);
  const nameTimer = useRef(null);
  const cancelNameTimer = () => { clearTimeout(nameTimer.current); nameTimer.current = null; };
  const flushName = () => {
    cancelNameTimer();
    if (pendingName.current === null) return;
    const name = pendingName.current;
    pendingName.current = null;
    setJobData((prev) => ({ ...prev, ...nameFields(type, name) }));
  };
  const dropPendingName = () => { cancelNameTimer(); pendingName.current = null; };
  useEffect(() => () => clearTimeout(nameTimer.current), []);

  const typeName = (name) => {
    setQuery(name);
    pendingName.current = name;
    clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(flushName, NAME_WRITE_DELAY_MS);
  };

  const selectParty = (option) => {
    if (option.moreNote) return;
    dropPendingName();
    setJobData((prev) => ({ ...prev, ...pickedPartyFields(option, type, masters?.states) }));
  };

  return (
    <ComboInput
      id={id}
      required
      listClassName="tw:min-w-80"
      options={listed}
      filter={() => true}
      limit={MAX_PARTY_ROWS + 1}
      getValue={(option) => option.partyName}
      renderOption={(option) => <PartyOption option={option} />}
      value={nameOnJob(jobData, type)}
      onValueChange={typeName}
      onFocus={() => setQuery('')}
      onBlur={flushName}
      onSelect={selectParty}
    />
  );
}
