// Values of the export job that follow other values - 12-Nov-2026.
//
// These were worked out inside the tab that shows them, so they were only right after that tab had been opened:
// - drawback rates / amounts were filled only on Scheme > Dbk (a job opened from the list or read from a file showed
//   DBK Rs 0.00 on the header and 0 on the S/B checklist until someone opened that tab);
// - invoice FOB (INR) only in the Invoices tab form, so a job read from a file had no invoice FOB and its items kept
//   "value x rate" as FOB (freight / insurance of a CIF invoice never taken out);
// - FOB Rs / DBK Rs of the header only while the SB Header tab was open;
// - port / country names were blank for a job read from a file (only the codes are in it).
// This hook runs once for the whole export screen, whichever tab is open. It only fills values that follow from
// others; nothing typed by the operator is replaced (a drawback amount typed by hand is kept).
import { useEffect, useState } from 'react';
import { useExportContext } from './ExportContext';
import { getMaster } from '../../utils/masterCache';
import { loadForeignPorts } from '../../utils/foreignPorts';
import { invoiceFobInr, itemFobFromInvoice } from '../../utils/exportFob';
import { num, isDbkItem, invOf, itemNoOf, itemFobInr, findDbk, dbkAmount, claimText, claimWhy, flagOn } from './Tabs/Schemes/schemeUtils';

const listOf = (d) => (Array.isArray(d) ? d : (d && Array.isArray(d.data) ? d.data : []));

// a master list shared by every part of the screen (one fetch per list, see utils/masterCache)
export function useMasterList(url, enabled = true) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    getMaster(url).then((d) => { if (live) setList(listOf(d)); }).catch(() => {});
    return () => { live = false; };
  }, [url, enabled]);
  return list;
}

export const blankDbkRow = (item, i) => ({
  id: item.id ?? `${invOf(item, i)}/${itemNoOf(item, i)}`, itemId: item.id, srNo: i + 1, invNo: invOf(item, i), itemNo: itemNoOf(item, i),
  dbkNo: item.dbkNo || '', dbkQty: String(item.dbkQty || item.qty || item.quantity || ''), dbkQtyAuto: !item.dbkQty || num(item.dbkQty) === num(item.qty || item.quantity), accUnit: item.unit || item.uqc || 'NOS',
  dbkRtAdv: '', dbkRtSpe: '', dbkCap: '', dbkVal: '', dbkWhy: '', drawbackAvailable: 'Y',
});

const blank = (v) => v === undefined || v === null || String(v).trim() === '';
const up = (v) => String(v || '').trim().toUpperCase();

export default function useExportCalc() {
  const { exportData, setExportData, items, setItems, dbkItems, setDbkItems } = useExportContext();
  const invoices = exportData && exportData.invoices;
  const hasDbk = (items || []).some(isDbkItem);
  const currencies = useMasterList('/api/masters/currencies', (invoices || []).length > 0);
  const dbkMaster = useMasterList('/api/masters/drawbacks', hasDbk);

  // 1. invoice FOB (INR) from value, rate and charges (same rule as the Invoices tab form)
  useEffect(() => {
    if (!(invoices || []).length) return;
    setExportData((prev) => {
      const list = prev.invoices || [];
      let changed = false;
      const next = list.map((inv) => {
        const f = invoiceFobInr(inv, currencies);
        if (f === null) return inv;
        const t = f.toFixed(2);
        if (String(inv.invFobInr ?? '') === t) return inv;
        changed = true;
        return { ...inv, invFobInr: t };
      });
      return changed ? { ...prev, invoices: next } : prev;
    });
  }, [invoices, currencies, setExportData]);

  // 2. item FOB (INR) = its share of the invoice FOB
  useEffect(() => {
    if (!(items || []).length || !(invoices || []).length) return;
    setItems((prev) => {
      let changed = false;
      const next = (prev || []).map((it) => {
        const inv = invoices[(parseInt(it.invSr, 10) || 1) - 1];
        if (!inv) return it;
        const f = itemFobFromInvoice(it, inv);
        if (f === null || num(it.itemFob).toFixed(2) === f) return it;
        changed = true;
        return { ...it, itemFob: f };
      });
      return changed ? next : prev;
    });
  }, [items, invoices, setItems]);

  // 3. one drawback row per drawback item (scheme 19 / 60); rows saved with the job / read from a file have no item id:
  // matched by invoice + item no. Rates come from the drawback schedule, the amount follows FOB / qty / rates.
  useEffect(() => {
    if (!(items || []).length) return; // a job being opened / a new job: rows are not touched
    setDbkItems((prev) => {
      const dbkList = (items || []).map((it, i) => ({ it, i })).filter(({ it }) => isDbkItem(it));
      const used = new Set();
      const keyOf = (p) => String(p.invNo || p.invSr || 1) + '/' + String(p.itemNo || p.itemSr);
      // 12-Nov-2026: a row belongs to its item by the item id first. Matched by invoice + item no first, an item deleted
      // or an invoice deleted (numbers move up) gave the next item the DBK No / qty of the deleted one. Rows saved
      // with the job or read from a file carry no current item id: those are found by invoice + item no, but never a
      // row that still belongs to another item on the screen.
      const liveIds = new Set((items || []).map((it) => it.id).filter((x) => x != null));
      const next = dbkList.map(({ it, i }, k) => {
        const inv = invOf(it, i), itm = itemNoOf(it, i);
        let ex = it.id != null ? (prev || []).find((p) => !used.has(p) && p.itemId != null && p.itemId === it.id) : null;
        if (!ex) ex = (prev || []).find((p) => !used.has(p) && !(p.itemId != null && liveIds.has(p.itemId)) && keyOf(p) === inv + '/' + itm);
        if (ex) used.add(ex);
        const row = ex ? { ...ex, id: it.id ?? ex.id ?? `${inv}/${itm}`, itemId: it.id, srNo: k + 1, invNo: inv, itemNo: itm } : { ...blankDbkRow(it, i), srNo: k + 1 };
        if (!row.drawbackAvailable) row.drawbackAvailable = 'Y';
        row.valManual = flagOn(row.valManual);
        // 12-Nov-2026: DBK qty follows the item qty unless it was typed different (item 10 -> 20 left DBK qty 10).
        // Rows saved before this have no flag: they follow when their qty is the item's qty (or blank).
        const itQty = String(it.qty ?? it.quantity ?? '').trim();
        const flag = row.dbkQtyAuto;
        row.dbkQtyAuto = (flag === undefined || flag === null || flag === '') ? (!String(row.dbkQty ?? '').trim() || num(row.dbkQty) === num(itQty)) : flagOn(flag);
        if (row.dbkQtyAuto && itQty && num(row.dbkQty) !== num(itQty)) row.dbkQty = itQty;
        // rates of a schedule number not filled yet (rows read from a file / an older job)
        if (row.dbkNo && !(num(row.dbkRtAdv) > 0 || num(row.dbkRtSpe) > 0) && dbkMaster.length) {
          const m = findDbk(dbkMaster, row.dbkNo);
          if (m) { row.dbkRtAdv = String(num(m.drawbackRate)); row.dbkRtSpe = String(num(m.drawbackRateSpec)); row.dbkCap = String(num(m.drawbackCap)); if (!row.accUnit) row.accUnit = m.uqc || 'NOS'; row.valManual = false; }
        }
        if (!row.valManual && (num(row.dbkRtAdv) > 0 || num(row.dbkRtSpe) > 0)) {
          const a = { fob: itemFobInr(it), qty: row.dbkQty, rateAdv: row.dbkRtAdv, rateSpe: row.dbkRtSpe, cap: row.dbkCap };
          row.dbkVal = claimText(dbkAmount(a)); row.dbkWhy = claimWhy(a);
        }
        return row;
      });
      const same = next.length === (prev || []).length && next.every((r, k) => JSON.stringify(r) === JSON.stringify(prev[k]));
      return same ? prev : next;
    });
  }, [items, dbkMaster, setDbkItems]);

  // 4. FOB Rs / DBK Rs of the header follow the items and the drawback rows (job list and dashboard read them)
  // 18-Nov-2026: also after the Invoices tab put its own total in (Modify on an invoice): the box showed the invoice total
  // until the job was reopened, then the items' total - one paisa apart when the item shares are rounded
  const fobFromItems = (items || []).reduce((s, it) => s + (parseFloat(it.itemFob) || 0), 0);
  const dbkFromRows = (dbkItems || []).reduce((s, d) => s + (parseFloat(d.dbkVal) || 0), 0);
  useEffect(() => {
    if (!(items || []).length) return;
    const fob = fobFromItems.toFixed(2), dbk = dbkFromRows.toFixed(2);
    setExportData((prev) => (String(prev.fobRs || '') === fob && String(prev.dbkRs || '') === dbk ? prev : { ...prev, fobRs: fob, dbkRs: dbk }));
  }, [fobFromItems, dbkFromRows, (items || []).length, exportData.fobRs, exportData.dbkRs, setExportData]);

  // 5. an air SB takes only Nature of Cargo P (the box showed Select while the SB was filed with P)
  useEffect(() => {
    if ((exportData.shipmentMode || 'AIR') === 'AIR' && blank(exportData.natureOfCargo)) setExportData((prev) => ((prev.shipmentMode || 'AIR') === 'AIR' && blank(prev.natureOfCargo) ? { ...prev, natureOfCargo: 'P' } : prev));
  }, [exportData.shipmentMode, exportData.natureOfCargo, setExportData]);

  // 6. port / country names of the codes read from a file or saved without a name
  const PORTS = [['customsPortCode', 'customsPortName'], ['loadingPortCode', 'loadingPortName'], ['destPortCode', 'destPortName'], ['discPortCode', 'discPortName']];
  const COUNTRIES = [['destCountryCode', 'destCountryName'], ['discCountryCode', 'discCountryName']];
  const needPort = PORTS.some(([c, n]) => !blank(exportData[c]) && blank(exportData[n]));
  const needCountry = COUNTRIES.some(([c, n]) => !blank(exportData[c]) && blank(exportData[n]));
  const ports = useMasterList('/api/masters/ports', needPort);
  const airports = useMasterList('/api/locations/airports', needPort);
  const countries = useMasterList('/api/masters/countries', needCountry);
  const [locodes, setLocodes] = useState([]);
  useEffect(() => { if (needPort && !locodes.length) loadForeignPorts().then((l) => setLocodes(l || [])); }, [needPort]);
  useEffect(() => {
    if (!needPort && !needCountry) return;
    setExportData((prev) => {
      const add = {};
      const cc = up(prev.destCountryCode || prev.consigneeCountryCode || prev.consigneeCountry);
      const portName = (code, country) => {
        const c = up(code); if (!c) return '';
        const p = ports.find((x) => up(x.portCode) === c);
        if (p) return p.portName || '';
        const iata = c.length === 3 ? c : (c.length === 5 ? c.slice(2) : '');
        const a = iata && airports.find((x) => up(x.iataCode) === iata && (c.length === 3 || up(x.countryCode) === c.slice(0, 2)));
        if (a) return a.cityName + (a.airportName ? ' - ' + a.airportName : '');
        const lc = c.length === 3 && country ? up(country) + c : c;
        const l = locodes.find((x) => x.portCode === lc);
        return l ? l.portName : '';
      };
      PORTS.forEach(([c, n]) => { if (!blank(prev[c]) && blank(prev[n])) { const v = portName(prev[c], /^(customs|loading)/.test(c) ? 'IN' : (c === 'discPortCode' ? (prev.discCountryCode || cc) : cc)); if (v) add[n] = v; } });
      COUNTRIES.forEach(([c, n]) => { if (!blank(prev[c]) && blank(prev[n])) { const m = countries.find((x) => up(x.code) === up(prev[c])); if (m && m.name) add[n] = String(m.name).toUpperCase(); } });
      return Object.keys(add).length ? { ...prev, ...add } : prev;
    });
  }, [needPort, needCountry, ports, airports, countries, locodes, setExportData]);

  return { dbkMaster };
}
