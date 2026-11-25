import { useEffect, useMemo } from 'react';
import { useJobContext } from '../../../JobContext';
import { ctxCode, stateInfoFor } from '../ctxCodes';

const upperTrim = (value) => String(value || '').trim().toUpperCase();

// the job's party id first, then the exact name, then the IEC (only when one party has it)
const findImporterParty = (parties, partyId, name, iec) => {
  const wantedId = String(partyId ?? '');
  if (wantedId) {
    const byId = parties.find((party) => String(party.id) === wantedId);
    if (byId) return byId;
  }
  const wantedName = upperTrim(name);
  if (wantedName) {
    const byName = parties.find((party) => upperTrim(party.name) === wantedName);
    if (byName) return byName;
  }
  const wantedIec = upperTrim(iec);
  if (!wantedIec) return undefined;
  const byIec = parties.filter((party) => upperTrim(party.taxId) === wantedIec);
  return byIec.length === 1 ? byIec[0] : undefined;
};

// AD code = the importer's Authorised Dealer (bank) code, filed as the BE's authorizedEconomicDealerCode.
// One code at the job's port, or the party's only code; more than one at the port is left for the operator to pick.
const adCodeForPort = (party, port) => {
  const adCodes = (Array.isArray(party?.adCodes) ? party.adCodes : []).filter((entry) => entry && String(entry.adCode || '').trim());
  if (!adCodes.length) return '';
  const portCode = upperTrim(port);
  const atPort = portCode ? adCodes.filter((entry) => upperTrim(entry.loadingPort) === portCode) : [];
  if (atPort.length === 1) return String(atPort[0].adCode).trim();
  if (atPort.length > 1) return '';
  return adCodes.length === 1 ? String(adCodes[0].adCode).trim() : '';
};

export default function useImporterParty({ parties, handleChange }) {
  const { jobData, setJobData, masters } = useJobContext();
  const importerPartyId = jobData.importerPartyId;
  const importerName = jobData.nameOfImporter || jobData.autoField_4;
  const importerIec = jobData.iecCode || jobData.autoField_5;
  const adCode = jobData.aeoCode || jobData.autoField_49;
  const importerPort = jobData.portCode || jobData.autoField_2 || jobData.customHouseCode;

  const importerParty = useMemo(
    () => findImporterParty(parties, importerPartyId, importerName, importerIec),
    [parties, importerPartyId, importerName, importerIec],
  );
  const importerBranches = importerParty?.branches || [];

  useEffect(() => {
    if (!importerIec || String(adCode || '').trim()) return;
    const portAdCode = adCodeForPort(importerParty, importerPort);
    if (portAdCode) setJobData((previous) => ({ ...previous, aeoCode: portAdCode, autoField_49: portAdCode }));
  }, [importerIec, adCode, importerPort, importerParty, setJobData]);

  const handleImporterBranchChange = (event) => {
    const branchSrNo = event.target.value;
    const branch = importerBranches.find((candidate) => String(candidate.branchSrNo) === String(branchSrNo));
    if (!branch) { handleChange(event); return; }
    const ctxState = stateInfoFor(masters?.states, branch.ctxState || branch.state);
    setJobData((previous) => ({
      ...previous,
      branchSrNo, autoField_48: branchSrNo,
      autoField_6: branch.address1 || '',
      autoField_7: branch.address2 || '',
      autoField_8: branch.city || '',
      autoField_9: branch.state || '',
      autoField_10: branch.pinCode || '',
      autoField_13: branch.gstin || branch.regNo || previous.autoField_13,
      autoField_50: ctxCode(branch.ctxType) || ((branch.gstin || '').length === 15 ? 'G' : previous.autoField_50),
      autoField_11: ctxState.name,
      autoField_12: ctxState.taxCode,
      state: branch.state || '', city: branch.city || '', address1: branch.address1 || '', address2: branch.address2 || '', pin: branch.pinCode || '',
    }));
  };

  return { importerBranches, handleImporterBranchChange };
}
