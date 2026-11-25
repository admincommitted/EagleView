import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { firstBranch } from './houseWaybillData';

const INITIAL_AGENT = { name: '', code: '', place: '', account: '', docs: 'SHIPMENT WITH DOCUMENTS', eori: '', accountingInfo: 'FREIGHT PREPAID' };

// the issuing agent: the default IATA agent of the master list until the user picks another
export default function useIataAgent() {
  const [iataAgents, setIataAgents] = useState([]);
  const [agentDetails, setAgentDetails] = useState(INITIAL_AGENT);
  const [agentLocationCode, setAgentLocationCode] = useState('');
  const [accountingInfo, setAccountingInfo] = useState('FREIGHT PREPAID');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await getMaster('/masters/iataagents');
        const agents = Array.isArray(data) ? data : [];
        setIataAgents(agents);
        const defaultAgent = agents.find((agent) => agent.isDefault);
        if (defaultAgent) {
          const place = firstBranch(defaultAgent)?.city || '';
          setAgentDetails((previous) => ({ ...previous, name: defaultAgent.name, code: defaultAgent.iataCode || '', place }));
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadAgents();
  }, []);

  // the print shows the full address of the agent's first branch
  const matchedAgent = iataAgents.find((agent) => agent.name === agentDetails.name);
  const printBranch = matchedAgent && firstBranch(matchedAgent);
  const agentPlaceForPrint = printBranch
    ? [printBranch.address1, printBranch.address2, printBranch.city, printBranch.state, printBranch.country, printBranch.pinCode].filter(Boolean).join(', ')
    : agentDetails.place || '';
  const printAgentDetails = { ...agentDetails, place: agentPlaceForPrint };

  return {
    iataAgents, setIataAgents, agentDetails, setAgentDetails, agentLocationCode, setAgentLocationCode,
    accountingInfo, setAccountingInfo, agentPlaceForPrint, printAgentDetails,
  };
}
