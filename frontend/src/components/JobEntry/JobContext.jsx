import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getMaster } from '../../utils/masterCache';
import { getParties } from '../../utils/partiesCache';

export const JobContext = createContext();

const EMPTY_MASTERS = { countries: [], currencies: [], uqcs: [], schemeCodes: [], states: [], parties: [], ports: [] };

const listOf = (reply) => (Array.isArray(reply) ? reply : reply?.success ? reply.data : []);

// CTX State / State Code are GST states, so only the Indian states are offered (the world list repeats short codes)
function indianStates(states, countries) {
  const india = countries.find((country) => country.code === 'IN');
  const inIndia = india ? states.filter((state) => state.countryId === india.id) : [];
  return inIndia.length ? inIndia : states;
}

async function partiesOrNone() {
  try {
    return await getParties();
  } catch {
    return [];
  }
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

const newJobData = () => ({
  jobNo: '',
  jobDate: localToday(),
  shipmentMode: 'AIR',
  boeType: 'HOME_CONSUMPTION',
  branchCode: '',
  importerId: null,
  supplierId: null,
  invoices: [],
  items: [],
  containers: [],
});

function useJobMasters() {
  const [masters, setMasters] = useState(EMPTY_MASTERS);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [countries, currencies, uqcs, schemeCodes, states, parties, ports] = await Promise.all([
          getMaster('/masters/countries'),
          getMaster('/masters/currencies'),
          getMaster('/masters/uqcs'),
          getMaster('/masters/schemecodes'),
          getMaster('/masters/states'),
          partiesOrNone(),
          getMaster('/masters/ports'),
        ]);
        const countryList = listOf(countries);
        setMasters({
          countries: countryList,
          currencies: listOf(currencies),
          uqcs: listOf(uqcs),
          schemeCodes: listOf(schemeCodes),
          states: indianStates(listOf(states), countryList),
          parties: listOf(parties),
          ports: listOf(ports),
        });
      } catch (error) {
        console.error('Error loading masters:', error);
      }
    };
    loadMasters();
  }, []);

  return masters;
}

// The Items and Invoices forms only reach the job on MODIFY / ADD. Each tab registers a check that names what is typed
// but not put in yet; Validate / File BE ask it first instead of applying half-typed values.
function usePendingEdits() {
  const checksByKey = useRef({});

  const registerPendingEdits = useCallback((key, check) => {
    if (typeof check === 'function') checksByKey.current[key] = check;
    else delete checksByKey.current[key];
    return () => { delete checksByKey.current[key]; };
  }, []);

  const pendingEditsMessage = useCallback(() => {
    for (const check of Object.values(checksByKey.current)) {
      try {
        const message = check();
        if (message) return message;
      } catch {
        // a tab that is closing
      }
    }
    return '';
  }, []);

  return { registerPendingEdits, pendingEditsMessage };
}

export function JobProvider({ children }) {
  const masters = useJobMasters();
  const { registerPendingEdits, pendingEditsMessage } = usePendingEdits();
  const [items, setItems] = useState([]);
  const [esanchitDocs, setEsanchitDocs] = useState([]);
  const [jobData, setJobData] = useState(newJobData);

  const resetJobContext = () => {
    setJobData(newJobData());
    setItems([]);
    setEsanchitDocs([]);
  };

  return (
    <JobContext.Provider value={{ masters, items, setItems, esanchitDocs, setEsanchitDocs, jobData, setJobData, resetJobContext, registerPendingEdits, pendingEditsMessage }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJobContext() {
  return useContext(JobContext);
}
