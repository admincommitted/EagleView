import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useExportContext } from '../../../ExportContext';
import { normalized, partyClass, partyMerc } from './partyCodes';

const branchAddress = (branch) => ({
  shipperAddress1: branch.address1 || '',
  shipperAddress2: branch.address2 || '',
  shipperCity: branch.city || '',
  shipperState: branch.state || '',
  shipperPin: branch.pinCode || '',
});

// the exporter of the job in the party master: by id, else by IEC, else by name (jobs read from a file / Excel or
// typed by hand have no shipperId)
function findShipper(parties, exportData) {
  return parties.find((party) => party.id === parseInt(exportData.shipperId, 10))
    || (exportData.shipperIec ? parties.find((party) => party.isShipper !== false && normalized(party.taxId) === normalized(exportData.shipperIec)) : null)
    || (exportData.shipperName ? parties.find((party) => party.isShipper && normalized(party.name) === normalized(exportData.shipperName)) : null);
}

function branchOfJob(branches, exportData, force) {
  const gstin = normalized(exportData.shipperGstin);
  return branches.find((branch) => String(branch.branchSrNo) === String(exportData.shipperBranchSrNo))
    || (gstin ? branches.find((branch) => normalized(branch.gstin || branch.regNo) === gstin) : null)
    || (branches.length === 1 ? branches[0] : null)
    || (force ? branches[0] : null);
}

function partyValues(previous, party, branch, force) {
  const next = { ...previous, shipperId: party.id };
  const put = (key, value) => { if (value !== undefined && value !== null && value !== '' && (force || !previous[key])) next[key] = value; };
  put('mercManuf', partyMerc(party.mercManuf));
  put('shipperClass', partyClass(party.classType));
  put('shipperIec', party.taxId);
  if (branch) {
    put('shipperBranchSrNo', branch.branchSrNo);
    if (force || !previous.shipperAddress1) Object.assign(next, branchAddress(branch));
    put('shipperGstin', normalized(branch.gstin || branch.regNo));
  }
  const adCodes = party.adCodes || [];
  if (adCodes.length === 1) put('adCode', adCodes[0].adCode);
  put('autoField_12', party.panNumber);
  put('panNo', party.panNumber);
  return next;
}

export default function useExporterParty(parties) {
  const { exportData, setExportData } = useExportContext();
  const selectedShipper = findShipper(parties, exportData);
  const shipperBranches = selectedShipper?.branches || [];
  const shipperAdCodes = selectedShipper?.adCodes || [];

  const selectShipperBranch = (branchSrNo) => {
    const branch = shipperBranches.find((row) => String(row.branchSrNo) === String(branchSrNo));
    setExportData((prev) => (branch
      ? { ...prev, shipperBranchSrNo: branchSrNo, ...branchAddress(branch), shipperGstin: branch.gstin || branch.regNo || '' }
      : { ...prev, shipperBranchSrNo: branchSrNo }));
  };

  // On opening a job only empty boxes are filled; "Party Master" (force) takes everything again from the master.
  const fromParty = (force) => {
    const party = selectedShipper;
    if (!party) { if (force) toast.error('Exporter not found in the Party Master (check the name / IEC)'); return; }
    const branch = branchOfJob(party.branches || [], exportData, force);
    setExportData((prev) => partyValues(prev, party, branch, force));
    if (!force) return;
    toast.success(`Exporter details taken from the Party Master${branch ? ` (branch ${branch.branchSrNo})` : ''}`);
    if (party.classType && !partyClass(party.classType)) toast(`Class "${party.classType}" in the Party Master has no ICEGATE code - choose the class on screen`, { icon: 'ℹ️' });
  };

  const selectedShipperId = selectedShipper?.id;
  useEffect(() => {
    if (selectedShipperId) fromParty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fills the empty boxes once per exporter / opened job
  }, [selectedShipperId, exportData.id]);

  return { selectedShipper, shipperBranches, shipperAdCodes, selectShipperBranch, fromParty };
}
