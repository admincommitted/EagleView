import { useEffect, useMemo } from 'react';
import { useJobContext } from '../../../JobContext';

const branchAddress = (branch) => [branch.address1, branch.address2, branch.city, branch.state, branch.pinCode].filter(Boolean).join(', ');

export default function useSubAgent({ parties, handleChange }) {
  const { jobData, setJobData } = useJobContext();
  const { subAgentFlag, subagentName, subagentPartyId } = jobData;
  // a job saved before the flag existed shows its sub-agent when it has one
  const subAgent = subAgentFlag || (subagentName ? 'Y' : 'N');

  useEffect(() => {
    if (subAgentFlag !== subAgent) setJobData((previous) => ({ ...previous, subAgentFlag: subAgent }));
  }, [subAgentFlag, subAgent, setJobData]);

  const setSubAgent = (value) => setJobData((previous) => ({ ...previous, subAgentFlag: value }));

  const subagentParty = useMemo(
    () => parties.find((party) => party.id === subagentPartyId || party.name === subagentName),
    [parties, subagentPartyId, subagentName],
  );
  const subagentBranches = subagentParty?.branches || [];

  const handleSubagentBranchChange = (event) => {
    const branchSrNo = event.target.value;
    const branch = subagentBranches.find((candidate) => String(candidate.branchSrNo) === String(branchSrNo));
    if (!branch) { handleChange(event); return; }
    setJobData((previous) => ({ ...previous, subagentBranchSrNo: branchSrNo, subagentAddress: branchAddress(branch) }));
  };

  return { subAgent, setSubAgent, subagentBranches, handleSubagentBranchChange };
}
