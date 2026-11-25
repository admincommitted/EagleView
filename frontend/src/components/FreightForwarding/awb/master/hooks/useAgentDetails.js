import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { agentPrintPlace, firstBranchCity } from './masterWaybillData';

const INITIAL_AGENT = { name: '', code: '', place: '', account: '', docs: 'SHIPMENT WITH DOCUMENTS', eori: '', accountingInfo: 'FREIGHT PREPAID' };

// the issuing carrier's agent: the default IATA agent of the master list until the user picks another
export default function useAgentDetails() {
  const [iataAgents, setIataAgents] = useState([]);
  const [agentDetails, setAgentDetails] = useState(INITIAL_AGENT);
  const [agentLocationCode, setAgentLocationCode] = useState('');

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const data = await getMaster('/masters/iataagents');
        const agents = Array.isArray(data) ? data : [];
        setIataAgents(agents);
        const defaultAgent = agents.find((agent) => agent.isDefault);
        if (defaultAgent) {
          setAgentDetails((previous) => ({ ...previous, name: defaultAgent.name, code: defaultAgent.iataCode || '', place: firstBranchCity(defaultAgent) }));
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadAgents();
  }, []);

  const agentPlaceForPrint = agentPrintPlace(iataAgents, agentDetails);
  const printAgentDetails = { ...agentDetails, place: agentPlaceForPrint };

  return {
    iataAgents, setIataAgents, agentDetails, setAgentDetails, agentLocationCode, setAgentLocationCode,
    agentPlaceForPrint, printAgentDetails,
  };
}
