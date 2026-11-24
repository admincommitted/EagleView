import React, { createContext, useState, useContext } from 'react';
import { getMaster } from '../../utils/masterCache'; // shared copy of small master lists, 09-Nov-2026
import { getParties } from '../../utils/partiesCache';

export const JobContext = createContext();

export function JobProvider({ children }) {
  const [items, setItems] = useState([]);
  const [esanchitDocs, setEsanchitDocs] = useState([]);
  const [masters, setMasters] = useState({ countries: [], currencies: [], uqcs: [], schemeCodes: [], states: [], parties: [], ports: [] });

  React.useEffect(() => {
    const loadMasters = async () => {
      try {
        const [c, cur, u, s, st, prt, po] = await Promise.all([
          getMaster('/api/masters/countries'),
          getMaster('/api/masters/currencies'),
          getMaster('/api/masters/uqcs'),
          getMaster('/api/masters/schemecodes'),
          getMaster('/api/masters/states'),
          getParties().catch(() => []), // shared with the Job Header (one copy of the big list), 09-Nov-2026
          getMaster('/api/masters/ports')
        ]);
        setMasters({ 
          countries: Array.isArray(c)?c:(c.success?c.data:[]), 
          currencies: Array.isArray(cur)?cur:(cur.success?cur.data:[]), 
          uqcs: Array.isArray(u)?u:(u.success?u.data:[]), 
          schemeCodes: Array.isArray(s)?s:(s.success?s.data:[]), 
          // only Indian states: CTX State / State Code are GST states. 5,000+ world states also gave
          // wrong matches (same short code in another country). 28-Oct-2026
          states: (() => { const all = Array.isArray(st)?st:(st.success?st.data:[]); const ctry = Array.isArray(c)?c:(c.success?c.data:[]); const IN = ctry.find(x => x.code === 'IN'); const ins = IN ? all.filter(x => x.countryId === IN.id) : []; return ins.length ? ins : all; })(),
          parties: Array.isArray(prt)?prt:(prt?.success?prt.data:[]),
          ports: Array.isArray(po)?po:(po?.success?po.data:[])
        });
      } catch(e) { console.error("Error loading masters:", e); }
    };
    loadMasters();
  }, []);
  
  // 30-Oct-2026: the Items and Invoices forms are uncontrolled (defaultValue), so what is typed in them only
  // reaches the job on MODIFY / ADD. Validate and File BE read the job, so a row typed but not put in was checked
  // and filed with its OLD values, silently. Each of those tabs registers a check here, and Validate / File ask it
  // first instead of guessing: half-typed values are never applied on their own.
  const pendingEdits = React.useRef({});
  // registerPendingEdits('items', () => 'Item 2 has changes...' | '') - the message when something is unsaved
  const registerPendingEdits = React.useCallback((key, check) => {
    if (typeof check === 'function') pendingEdits.current[key] = check;
    else delete pendingEdits.current[key];
    return () => { delete pendingEdits.current[key]; };
  }, []);
  const pendingEditsMessage = React.useCallback(() => {
    for (const key of Object.keys(pendingEdits.current)) {
      try { const m = pendingEdits.current[key](); if (m) return m; } catch (e) { /* a tab that is closing */ }
    }
    return '';
  }, []);

  const initialData = {
    jobNo: '',
    // 30-Oct-2026: local (IST) date - toISOString() gave yesterday's date before 05:30; no hard "DEL" branch - the
    // branch comes from the active branch (Job No sequence) and the importer
    jobDate: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
    shipmentMode: 'AIR', // 30-Oct-2026: same as the Mode box of a new job (transportMode 'A'); the two said SEA / AIR before
    boeType: 'HOME_CONSUMPTION',
    branchCode: '',
    importerId: null,
    supplierId: null,
    invoices: [],
    items: [],
    containers: []
  };

  const [jobData, setJobData] = useState(initialData);

  const resetJobContext = () => {
    setJobData(initialData);
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

