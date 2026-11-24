import React, { createContext, useState, useContext } from 'react';
import { asList } from '../../utils/asList';

export const ExportContext = createContext();

export function ExportProvider({ children }) {
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [dbkItems, setDbkItems] = useState([]);
  const [licenseItems, setLicenseItems] = useState([]);
  
  const initialData = {
    jobNo: '',
    jobDate: '',  // blank by default — only set when a real job is loaded/created
    shipmentMode: 'AIR',
    branchCode: 'DEL',
    shipperId: null,
    consigneeId: null,
    invoices: [],
    items: [],
    containers: [],
    docs: [],
    dbkItems: [],
    licenseItems: []
  };

  const [exportData, setExportData] = useState(initialData);

  // 17-Nov-2026: the Items / Invoices forms reach the job only on Save / Modify. Both tabs register a check here
  // (registerPendingEdits('items', () => 'message' | '')); Save Draft, Send to ICEGATE, Validate, Preview and a tab
  // change ask first when something is still only in the form (as on the Import screen).
  const pendingEdits = React.useRef({});
  const registerPendingEdits = React.useCallback((key, check) => {
    if (typeof check === 'function') pendingEdits.current[key] = check; else delete pendingEdits.current[key];
    return () => { if (pendingEdits.current[key] === check) delete pendingEdits.current[key]; };
  }, []);
  const pendingEditsMessage = React.useCallback((only) => {
    for (const key of Object.keys(pendingEdits.current)) {
      if (only && key !== only) continue;
      try { const m = pendingEdits.current[key](); if (m) return m; } catch (e) { /* a check that fails says nothing */ }
    }
    return '';
  }, []);

  // 17-Nov-2026: SW info / RoDTEP rows (_infoTypes) and statements (_statements) read from a file sit on the job,
  // keyed by invoice / item serial. When items are deleted, moved or renumbered the rows follow their item (by id);
  // rows of a deleted item go with it. Before, item 3 that became item 2 took the rows of the old item 2.
  // goneInvoices: serials of deleted invoices - their invoice level rows go, later invoices move up.
  const remapItemRows = React.useCallback((prevItems, nextItems, goneInvoices) => {
    const num = (v, d) => { const n = parseInt(v, 10); return isNaN(n) ? d : n; };
    const pair = (inv, itm) => num(inv, 1) + '/' + num(itm, 0);
    const before = new Map();
    (prevItems || []).forEach(it => { if (it && it.id != null) before.set(pair(it.invSr, it.itemSr), it.id); });
    const after = new Map();
    (nextItems || []).forEach(it => { if (it && it.id != null) after.set(it.id, it); });
    const gone = (goneInvoices || []).map(g => num(g, 0)).filter(Boolean);
    let moves = gone.length > 0;
    before.forEach((id, k) => { const it = after.get(id); if (!it || pair(it.invSr, it.itemSr) !== k) moves = true; });
    if (!moves) return;
    const put = (r, key, alt, v) => { const o = { ...r }; const k = o[key] !== undefined ? key : (o[alt] !== undefined ? alt : key); o[k] = typeof r[k] === 'string' ? String(v) : v; return o; };
    const fix = (list) => {
      const rows = asList(list);
      if (!rows.length) return list;
      return rows.flatMap(r => {
        const inv = num(r.invoiceSerialNumber ?? r.invoiceSrNo, 1), itm = num(r.itemSerialNumber ?? r.itemSrNo, 0);
        if (!itm) { // invoice level (job level when the invoice is 0)
          if (!inv || !gone.length) return [r];
          if (gone.includes(inv)) return [];
          return [put(r, 'invoiceSerialNumber', 'invoiceSrNo', inv - gone.filter(g => g < inv).length)];
        }
        const id = before.get(inv + '/' + itm);
        if (id === undefined) return [r]; // not the row of an item on the screen: left as it was
        const it = after.get(id);
        if (!it) return []; // its item was deleted
        return [put(put(r, 'invoiceSerialNumber', 'invoiceSrNo', num(it.invSr, 1)), 'itemSerialNumber', 'itemSrNo', num(it.itemSr, 1))];
      });
    };
    setExportData(prev => {
      const out = { ...prev };
      if (asList(prev._infoTypes).length) out._infoTypes = fix(prev._infoTypes);
      if (asList(prev._statements).length) out._statements = fix(prev._statements);
      return out;
    });
  }, []);

  const resetExportContext = () => {
    setExportData(initialData);
    setItems([]);
    setContainers([]);
    setDocs([]);
    setDbkItems([]);
    setLicenseItems([]);
  };

  return (
    <ExportContext.Provider value={{ 
      items, setItems, 
      containers, setContainers,
      docs, setDocs,
      dbkItems, setDbkItems,
      licenseItems, setLicenseItems,
      exportData, setExportData, 
      resetExportContext,
      registerPendingEdits, pendingEditsMessage, remapItemRows
    }}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExportContext() {
  return useContext(ExportContext);
}
