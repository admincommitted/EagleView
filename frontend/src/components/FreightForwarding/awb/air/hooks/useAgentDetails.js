import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { DEFAULT_AGENT, firstBranchOf, listOrEmpty } from './airWaybillData';

// the agent's full branch address is printed in the agent box of the AWB
function printPlaceOf(agentDetails, iataAgents) {
  const agent = iataAgents.find((candidate) => candidate.name === agentDetails?.name);
  const branch = agent ? firstBranchOf(agent) : null;
  if (!branch) return agentDetails?.place || '';
  return [branch.address1, branch.address2, branch.city, branch.state, branch.country, branch.pinCode].filter(Boolean).join(', ');
}

export default function useAgentDetails() {
  const [iataAgents, setIataAgents] = useState([]);
  const [agentDetails, setAgentDetails] = useState(DEFAULT_AGENT);
  const [agentCity, setAgentCity] = useState('');
  const [agentCountry, setAgentCountry] = useState('');
  const [agentLocationCode, setAgentLocationCode] = useState('');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const agents = listOrEmpty(await getMaster('/masters/iataagents'));
        setIataAgents(agents);
        const defaultAgent = agents.find((agent) => agent.isDefault);
        if (!defaultAgent) return;
        const place = firstBranchOf(defaultAgent)?.city || '';
        setAgentDetails((previous) => ({ ...previous, name: defaultAgent.name, code: defaultAgent.iataCode || '', place }));
      } catch (error) {
        console.error(error);
      }
    };
    loadAgents();
  }, []);

  const agentPlaceForPrint = printPlaceOf(agentDetails, iataAgents);
  const printAgentDetails = { ...agentDetails, place: agentPlaceForPrint };

  return {
    iataAgents, setIataAgents, agentDetails, setAgentDetails, agentCity, setAgentCity, agentCountry, setAgentCountry,
    agentLocationCode, setAgentLocationCode, agentPlaceForPrint, printAgentDetails,
  };
}
