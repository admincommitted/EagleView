import { useEffect, useState } from 'react';
import { freightApi } from '@/components/FreightForwarding/freightApi';

const EMPTY_MASTERS = { airports: [], currencies: [], sphList: [], airlines: [], awbStocks: [], iataAgents: [] };

const listOf = (body) => (Array.isArray(body) ? body : body?.data || []);

async function loadList(request) {
  try {
    return listOf(await request());
  } catch {
    return [];
  }
}

export default function useAwbMasters(setValue) {
  const [masters, setMasters] = useState(EMPTY_MASTERS);

  useEffect(() => {
    const loadMasters = async () => {
      const [airports, currencies, sphList, airlines, awbStocks, iataAgents] = await Promise.all([
        loadList(freightApi.airportList),
        loadList(freightApi.currencyMaster),
        loadList(freightApi.sphMaster),
        loadList(freightApi.airlineList),
        loadList(() => freightApi.awbStockSuggestions({ status: 'AVAILABLE' })),
        loadList(freightApi.iataAgentMaster),
      ]);
      setMasters({ airports, currencies, sphList, airlines, awbStocks, iataAgents });
      if (iataAgents.length > 0) {
        const defaultAgent = iataAgents.find((agent) => agent.isDefault) || iataAgents[0];
        setValue('iataAgent', defaultAgent.name);
      }
    };
    loadMasters();
  }, [setValue]);

  return masters;
}
