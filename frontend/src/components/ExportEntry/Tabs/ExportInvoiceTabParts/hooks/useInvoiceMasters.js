import { useEffect, useState } from 'react';
import { getMaster } from '@/utils/masterCache';
import { getParties } from '@/utils/partiesCache';

async function loadList(read, setList, what) {
  try {
    const data = await read();
    if (Array.isArray(data)) setList(data);
  } catch (error) {
    console.error(`Failed to fetch ${what}:`, error);
  }
}

export default function useInvoiceMasters() {
  const [currencies, setCurrencies] = useState([]);
  const [parties, setParties] = useState([]);
  const [countries, setCountries] = useState([]);

  useEffect(() => {
    loadList(() => getMaster('/masters/currencies'), setCurrencies, 'currencies');
    loadList(getParties, setParties, 'parties');
    loadList(() => getMaster('/masters/countries'), setCountries, 'countries');
  }, []);

  return { currencies, parties, countries };
}
