// Values of the export job that follow other values, kept up to date for the whole export screen whichever tab is
// open: invoice FOB (INR), item FOB, drawback rows and amounts, FOB Rs / DBK Rs of the header, Nature of Cargo of an
// air SB and port / country names of codes read from a file. Only values that follow from others are filled; nothing
// typed by the operator is replaced (a drawback amount typed by hand is kept).
import { useEffect, useState } from 'react';
import { useExportContext } from './ExportContext';
import { getMaster } from '../../utils/masterCache';
import { loadForeignPorts } from '../../utils/foreignPorts';
import { invoiceFobInr, itemFobFromInvoice } from '../../utils/exportFob';
import { num, isDbkItem, invOf, itemNoOf, itemFobInr, findDbk, dbkAmount, claimText, claimWhy, flagOn } from './Tabs/Schemes/schemeUtils';

const listOf = (reply) => (Array.isArray(reply) ? reply : (reply && Array.isArray(reply.data) ? reply.data : []));

// a master list shared by every part of the screen (one fetch per list, see utils/masterCache)
export function useMasterList(url, enabled = true) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const load = async () => {
      try {
        const reply = await getMaster(url);
        if (live) setList(listOf(reply));
      } catch {
        // the list stays empty
      }
    };
    load();
    return () => { live = false; };
  }, [url, enabled]);
  return list;
}

export const blankDbkRow = (item, index) => ({
  id: item.id ?? `${invOf(item, index)}/${itemNoOf(item, index)}`, itemId: item.id, srNo: index + 1, invNo: invOf(item, index), itemNo: itemNoOf(item, index),
  dbkNo: item.dbkNo || '', dbkQty: String(item.dbkQty || item.qty || item.quantity || ''), dbkQtyAuto: !item.dbkQty || num(item.dbkQty) === num(item.qty || item.quantity), accUnit: item.unit || item.uqc || 'NOS',
  dbkRtAdv: '', dbkRtSpe: '', dbkCap: '', dbkVal: '', dbkWhy: '', drawbackAvailable: 'Y',
});

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
const upper = (value) => String(value || '').trim().toUpperCase();
const isAirWithoutCargo = (job) => (job.shipmentMode || 'AIR') === 'AIR' && isBlank(job.natureOfCargo);
const dbkRowKey = (row) => `${String(row.invNo || row.invSr || 1)}/${String(row.itemNo || row.itemSr)}`;

const PORT_FIELDS = [['customsPortCode', 'customsPortName'], ['loadingPortCode', 'loadingPortName'], ['destPortCode', 'destPortName'], ['discPortCode', 'discPortName']];
const COUNTRY_FIELDS = [['destCountryCode', 'destCountryName'], ['discCountryCode', 'discCountryName']];

// A drawback row with its item: DBK qty follows the item qty unless it was typed different, rates come from the
// drawback schedule when only the DBK No is known, and the amount follows FOB / qty / rates unless typed by hand.
function filledDbkRow(row, item, dbkMaster) {
  row.valManual = flagOn(row.valManual);
  const itemQty = String(item.qty ?? item.quantity ?? '').trim();
  const autoFlag = row.dbkQtyAuto;
  // rows saved before the flag existed follow the item when their qty is the item's qty (or blank)
  row.dbkQtyAuto = (autoFlag === undefined || autoFlag === null || autoFlag === '') ? (!String(row.dbkQty ?? '').trim() || num(row.dbkQty) === num(itemQty)) : flagOn(autoFlag);
  if (row.dbkQtyAuto && itemQty && num(row.dbkQty) !== num(itemQty)) row.dbkQty = itemQty;
  if (row.dbkNo && !(num(row.dbkRtAdv) > 0 || num(row.dbkRtSpe) > 0) && dbkMaster.length) {
    const schedule = findDbk(dbkMaster, row.dbkNo);
    if (schedule) {
      row.dbkRtAdv = String(num(schedule.drawbackRate));
      row.dbkRtSpe = String(num(schedule.drawbackRateSpec));
      row.dbkCap = String(num(schedule.drawbackCap));
      if (!row.accUnit) row.accUnit = schedule.uqc || 'NOS';
      row.valManual = false;
    }
  }
  if (!row.valManual && (num(row.dbkRtAdv) > 0 || num(row.dbkRtSpe) > 0)) {
    const claim = { fob: itemFobInr(item), qty: row.dbkQty, rateAdv: row.dbkRtAdv, rateSpe: row.dbkRtSpe, cap: row.dbkCap };
    row.dbkVal = claimText(dbkAmount(claim));
    row.dbkWhy = claimWhy(claim);
  }
  return row;
}

// One drawback row per drawback item (scheme 19 / 60). A row belongs to its item by the item id first; rows saved with
// the job or read from a file carry no current item id and are found by invoice + item no, but never a row that still
// belongs to another item on the screen (a deleted item / invoice must not pass its DBK No / qty to the next one).
function dbkRowsFor(items, previousRows, dbkMaster) {
  const used = new Set();
  const liveItemIds = new Set(items.map((item) => item.id).filter((id) => id != null));
  const dbkEntries = items.map((item, index) => ({ item, index })).filter(({ item }) => isDbkItem(item));
  return dbkEntries.map(({ item, index }, rowIndex) => {
    const invoiceNo = invOf(item, index);
    const itemNo = itemNoOf(item, index);
    let existing = item.id != null ? previousRows.find((row) => !used.has(row) && row.itemId != null && row.itemId === item.id) : null;
    if (!existing) existing = previousRows.find((row) => !used.has(row) && !(row.itemId != null && liveItemIds.has(row.itemId)) && dbkRowKey(row) === `${invoiceNo}/${itemNo}`);
    if (existing) used.add(existing);
    const row = existing
      ? { ...existing, id: item.id ?? existing.id ?? `${invoiceNo}/${itemNo}`, itemId: item.id, srNo: rowIndex + 1, invNo: invoiceNo, itemNo }
      : { ...blankDbkRow(item, index), srNo: rowIndex + 1 };
    if (!row.drawbackAvailable) row.drawbackAvailable = 'Y';
    return filledDbkRow(row, item, dbkMaster);
  });
}

function namesOfCodes(job, { ports, airports, countries, locodes }) {
  const names = {};
  const consigneeCountry = upper(job.destCountryCode || job.consigneeCountryCode || job.consigneeCountry);
  const portName = (code, country) => {
    const portCode = upper(code);
    if (!portCode) return '';
    const port = ports.find((entry) => upper(entry.portCode) === portCode);
    if (port) return port.portName || '';
    const iata = portCode.length === 3 ? portCode : (portCode.length === 5 ? portCode.slice(2) : '');
    const airport = iata && airports.find((entry) => upper(entry.iataCode) === iata && (portCode.length === 3 || upper(entry.countryCode) === portCode.slice(0, 2)));
    if (airport) return airport.cityName + (airport.airportName ? ' - ' + airport.airportName : '');
    const locode = portCode.length === 3 && country ? upper(country) + portCode : portCode;
    const foreignPort = locodes.find((entry) => entry.portCode === locode);
    return foreignPort ? foreignPort.portName : '';
  };
  const countryOfPort = (codeField) => {
    if (/^(customs|loading)/.test(codeField)) return 'IN';
    return codeField === 'discPortCode' ? (job.discCountryCode || consigneeCountry) : consigneeCountry;
  };
  PORT_FIELDS.forEach(([codeField, nameField]) => {
    if (isBlank(job[codeField]) || !isBlank(job[nameField])) return;
    const name = portName(job[codeField], countryOfPort(codeField));
    if (name) names[nameField] = name;
  });
  COUNTRY_FIELDS.forEach(([codeField, nameField]) => {
    if (isBlank(job[codeField]) || !isBlank(job[nameField])) return;
    const country = countries.find((entry) => upper(entry.code) === upper(job[codeField]));
    if (country && country.name) names[nameField] = String(country.name).toUpperCase();
  });
  return names;
}

export default function useExportCalc() {
  const { exportData, setExportData, items, setItems, dbkItems, setDbkItems } = useExportContext();
  const invoices = exportData && exportData.invoices;
  const hasDbk = (items || []).some(isDbkItem);
  const currencies = useMasterList('/masters/currencies', (invoices || []).length > 0);
  const dbkMaster = useMasterList('/masters/drawbacks', hasDbk);

  // invoice FOB (INR) from value, rate and charges (same rule as the Invoices tab form)
  useEffect(() => {
    if (!(invoices || []).length) return;
    setExportData((previous) => {
      let changed = false;
      const next = (previous.invoices || []).map((invoice) => {
        const fob = invoiceFobInr(invoice, currencies);
        if (fob === null) return invoice;
        const fobText = fob.toFixed(2);
        if (String(invoice.invFobInr ?? '') === fobText) return invoice;
        changed = true;
        return { ...invoice, invFobInr: fobText };
      });
      return changed ? { ...previous, invoices: next } : previous;
    });
  }, [invoices, currencies, setExportData]);

  // item FOB (INR) = its share of the invoice FOB
  useEffect(() => {
    if (!(items || []).length || !(invoices || []).length) return;
    setItems((previous) => {
      let changed = false;
      const next = (previous || []).map((item) => {
        const invoice = invoices[(parseInt(item.invSr, 10) || 1) - 1];
        if (!invoice) return item;
        const fob = itemFobFromInvoice(item, invoice);
        if (fob === null || num(item.itemFob).toFixed(2) === fob) return item;
        changed = true;
        return { ...item, itemFob: fob };
      });
      return changed ? next : previous;
    });
  }, [items, invoices, setItems]);

  // a job being opened / a new job (no items yet): the drawback rows are not touched
  useEffect(() => {
    if (!(items || []).length) return;
    setDbkItems((previous) => {
      const previousRows = previous || [];
      const next = dbkRowsFor(items, previousRows, dbkMaster);
      const same = next.length === previousRows.length && next.every((row, index) => JSON.stringify(row) === JSON.stringify(previousRows[index]));
      return same ? previous : next;
    });
  }, [items, dbkMaster, setDbkItems]);

  // FOB Rs / DBK Rs of the header follow the items and the drawback rows (job list and dashboard read them), also after
  // the Invoices tab put its own total in
  const fobFromItems = (items || []).reduce((sum, item) => sum + (parseFloat(item.itemFob) || 0), 0);
  const dbkFromRows = (dbkItems || []).reduce((sum, row) => sum + (parseFloat(row.dbkVal) || 0), 0);
  const itemCount = (items || []).length;
  useEffect(() => {
    if (!itemCount) return;
    const fob = fobFromItems.toFixed(2);
    const dbk = dbkFromRows.toFixed(2);
    setExportData((previous) => (String(previous.fobRs || '') === fob && String(previous.dbkRs || '') === dbk ? previous : { ...previous, fobRs: fob, dbkRs: dbk }));
  }, [fobFromItems, dbkFromRows, itemCount, exportData.fobRs, exportData.dbkRs, setExportData]);

  // an air SB takes only Nature of Cargo P
  const { shipmentMode, natureOfCargo } = exportData;
  useEffect(() => {
    if (isAirWithoutCargo({ shipmentMode, natureOfCargo })) setExportData((previous) => (isAirWithoutCargo(previous) ? { ...previous, natureOfCargo: 'P' } : previous));
  }, [shipmentMode, natureOfCargo, setExportData]);

  // port / country names of the codes read from a file or saved without a name
  const needPort = PORT_FIELDS.some(([codeField, nameField]) => !isBlank(exportData[codeField]) && isBlank(exportData[nameField]));
  const needCountry = COUNTRY_FIELDS.some(([codeField, nameField]) => !isBlank(exportData[codeField]) && isBlank(exportData[nameField]));
  const ports = useMasterList('/masters/ports', needPort);
  const airports = useMasterList('/locations/airports', needPort);
  const countries = useMasterList('/masters/countries', needCountry);
  const [locodes, setLocodes] = useState([]);
  useEffect(() => {
    if (!needPort || locodes.length) return;
    const load = async () => setLocodes((await loadForeignPorts()) || []);
    load();
  }, [needPort, locodes.length]);
  useEffect(() => {
    if (!needPort && !needCountry) return;
    setExportData((previous) => {
      const names = namesOfCodes(previous, { ports, airports, countries, locodes });
      return Object.keys(names).length ? { ...previous, ...names } : previous;
    });
  }, [needPort, needCountry, ports, airports, countries, locodes, setExportData]);

  return { dbkMaster };
}
