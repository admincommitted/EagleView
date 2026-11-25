import { useEffect, useState } from 'react';
import { freightApi } from '../freightApi';

const agentLabel = (agent) => `${agent.name || '(no name)'}${agent.iataCode ? ` (${agent.iataCode})` : ''}${agent.inMaster ? '' : ' - on AWB only'}`;

// Airline and IATA agent choices for the CSR and tonnage reports; a failed list just leaves the choice empty.
export function useReportPickLists() {
  const [airlines, setAirlines] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    const loadAirlines = async () => {
      try {
        const list = await freightApi.airlineMaster();
        setAirlines(Array.isArray(list) ? list.filter((airline) => airline.prefix) : []);
      } catch {
        setAirlines([]);
      }
    };
    const loadAgents = async () => {
      try {
        const data = await freightApi.awbAgents();
        setAgents(Array.isArray(data?.agents) ? data.agents : []);
      } catch {
        setAgents([]);
      }
    };
    loadAirlines();
    loadAgents();
  }, []);

  return {
    airlineOptions: airlines.map((airline) => ({ value: airline.prefix, label: `${airline.prefix} ${airline.code2} ${airline.name}` })),
    agentOptions: agents.map((agent) => ({ value: agent.iataCode || agent.name, label: agentLabel(agent) })),
  };
}
