import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { asList } from '../../utils/asList';

export const ExportContext = createContext();

// jobDate stays blank until a real job is loaded / created
const blankExportData = () => ({
  jobNo: '',
  jobDate: '',
  shipmentMode: 'AIR',
  branchCode: 'DEL',
  shipperId: null,
  consigneeId: null,
  invoices: [],
  items: [],
  containers: [],
  docs: [],
  dbkItems: [],
  licenseItems: [],
});

const toNumber = (value, fallback) => {
  const number = parseInt(value, 10);
  return Number.isNaN(number) ? fallback : number;
};
const serialPair = (invoiceSerial, itemSerial) => `${toNumber(invoiceSerial, 1)}/${toNumber(itemSerial, 0)}`;

// writes the serial under the key the row already uses (invoiceSerialNumber or invoiceSrNo), as text when it was text
function withSerial(row, key, altKey, serial) {
  const copy = { ...row };
  const usedKey = copy[key] !== undefined ? key : (copy[altKey] !== undefined ? altKey : key);
  copy[usedKey] = typeof row[usedKey] === 'string' ? String(serial) : serial;
  return copy;
}

export function ExportProvider({ children }) {
  const [items, setItems] = useState([]);
  const [containers, setContainers] = useState([]);
  const [docs, setDocs] = useState([]);
  const [dbkItems, setDbkItems] = useState([]);
  const [licenseItems, setLicenseItems] = useState([]);
  const [exportData, setExportData] = useState(blankExportData);

  // The Items / Invoices forms reach the job only on Save / Modify. Both tabs register a check here
  // (registerPendingEdits('items', () => 'message' | '')); Save Draft, Send to ICEGATE, Validate, Preview and a tab
  // change ask first when something is still only in the form.
  const pendingEdits = useRef({});
  const registerPendingEdits = useCallback((key, check) => {
    if (typeof check === 'function') pendingEdits.current[key] = check;
    else delete pendingEdits.current[key];
    return () => { if (pendingEdits.current[key] === check) delete pendingEdits.current[key]; };
  }, []);
  const pendingEditsMessage = useCallback((onlyKey) => {
    for (const key of Object.keys(pendingEdits.current)) {
      if (onlyKey && key !== onlyKey) continue;
      try {
        const message = pendingEdits.current[key]();
        if (message) return message;
      } catch {
        // a check that fails says nothing
      }
    }
    return '';
  }, []);

  // SW info / RoDTEP rows (_infoTypes) and statements (_statements) read from a file sit on the job, keyed by invoice /
  // item serial. When items are deleted, moved or renumbered the rows follow their item (by id); rows of a deleted item
  // go with it. goneInvoices: serials of deleted invoices - their invoice level rows go, later invoices move up.
  const remapItemRows = useCallback((previousItems, nextItems, goneInvoices) => {
    const itemIdBySerial = new Map();
    (previousItems || []).forEach((item) => { if (item && item.id != null) itemIdBySerial.set(serialPair(item.invSr, item.itemSr), item.id); });
    const nextItemById = new Map();
    (nextItems || []).forEach((item) => { if (item && item.id != null) nextItemById.set(item.id, item); });
    const goneSerials = (goneInvoices || []).map((serial) => toNumber(serial, 0)).filter(Boolean);

    let anythingMoved = goneSerials.length > 0;
    itemIdBySerial.forEach((id, serial) => {
      const item = nextItemById.get(id);
      if (!item || serialPair(item.invSr, item.itemSr) !== serial) anythingMoved = true;
    });
    if (!anythingMoved) return;

    const followItems = (list) => {
      const rows = asList(list);
      if (!rows.length) return list;
      return rows.flatMap((row) => {
        const invoiceSerial = toNumber(row.invoiceSerialNumber ?? row.invoiceSrNo, 1);
        const itemSerial = toNumber(row.itemSerialNumber ?? row.itemSrNo, 0);
        if (!itemSerial) {
          // invoice level (job level when the invoice is 0)
          if (!invoiceSerial || !goneSerials.length) return [row];
          if (goneSerials.includes(invoiceSerial)) return [];
          return [withSerial(row, 'invoiceSerialNumber', 'invoiceSrNo', invoiceSerial - goneSerials.filter((gone) => gone < invoiceSerial).length)];
        }
        const itemId = itemIdBySerial.get(`${invoiceSerial}/${itemSerial}`);
        if (itemId === undefined) return [row];
        const item = nextItemById.get(itemId);
        if (!item) return [];
        const movedInvoice = withSerial(row, 'invoiceSerialNumber', 'invoiceSrNo', toNumber(item.invSr, 1));
        return [withSerial(movedInvoice, 'itemSerialNumber', 'itemSrNo', toNumber(item.itemSr, 1))];
      });
    };

    setExportData((previous) => {
      const next = { ...previous };
      if (asList(previous._infoTypes).length) next._infoTypes = followItems(previous._infoTypes);
      if (asList(previous._statements).length) next._statements = followItems(previous._statements);
      return next;
    });
  }, []);

  const resetExportContext = () => {
    setExportData(blankExportData());
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
      registerPendingEdits, pendingEditsMessage, remapItemRows,
    }}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExportContext() {
  return useContext(ExportContext);
}
