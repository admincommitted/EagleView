// Import BE checklist in the "E-Annex" layout used by the CHA (same blocks and order as the checklist PDFs
// the user shared, 28-Oct-2026). Built from the CACHI01 JSON the job will send (POST /api/icegate/preview-be),
// so the checklist shows exactly what goes to ICEGATE; duty figures are our estimate (computeItemDuty).
import React from 'react';
import axios from 'axios';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';

const F = { fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '8.5pt', color: '#000', lineHeight: 1.2 }; // 10-Nov-2026: 9.5pt -> 8.5pt (user: text a bit smaller)
const B = { fontWeight: 700 };
const n2 = (v, d = 2) => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return isNaN(x) ? (0).toFixed(d) : x.toFixed(d); };
const dmy = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[3]}/${m[2]}/${m[1]}`; if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`; return t; };
const yn = (v) => (String(v || '').toUpperCase() === 'Y' ? 'Yes' : 'No');
const list = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = []; } } return Array.isArray(v) ? v : []; };
const obj = (v) => { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } } return v && typeof v === 'object' ? v : {}; };

// rupees in words (Indian system)
function inWords(num) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  let x = Math.round(num || 0);
  if (!x) return 'Zero';
  const parts = [];
  const crore = Math.floor(x / 10000000); x %= 10000000;
  const lakh = Math.floor(x / 100000); x %= 100000;
  const thou = Math.floor(x / 1000); x %= 1000;
  if (crore) parts.push(inWords(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thou) parts.push(two(thou) + ' Thousand');
  if (x) parts.push(three(x));
  return parts.join(' ');
}

const IMPORTER_TYPE = { P: 'Private', G: 'Government', U: 'Undertaking', O: 'Others', J: 'Jobbing' };
const NATURE = { S: 'SALE', O: 'OTHERS', C: 'CONSIGNMENT', H: 'HIRE', R: 'RENT', F: 'FREE OF COST' };
const PAY_TERMS = { OTH: 'Others', FC: 'Free of Cost', DP: 'Delivery against Payment', DA: 'Delivery against Acceptance', LC: 'Letter of Credit', AP: 'Advance Payment' };
const DOC_TYPE = { '101000': 'Registration Document', '703000': 'House waybill', '704000': 'Master air waybill', '705000': 'Bill of lading', '740000': 'Air waybill',
  '380000': 'Commercial Invoice', '271000': 'Packing list', '861000': 'Certificate of origin', '005000': 'Other Document' };
const BE_TITLE = { H: 'Bill of Entry for Home Consumption', W: 'Bill of Entry for Warehousing', X: 'Bill of Entry for Ex-Bond Clearance' };
const MODE = { A: 'Air', S: 'Sea', L: 'Land' };

export default function ImportChecklistEAnnex({ jobData, items, esanchitDocs, masters }) {
  const [cj, setCj] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [cha, setCha] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [softwareName, setSoftwareName] = React.useState('EagleView 360');
  const [tariff, setTariff] = React.useState({});
  // 18-Nov-2026: Docket No. under Job No / Date, as on iCAFFE's checklist - the job's own docket (loaded iCAFFE jobs)
  // or the docket made with Register Shipment (Shipments.ediJobNo = job no)
  const [shipDocket, setShipDocket] = React.useState('');
  React.useEffect(() => {
    const no = String(jobData?.jobNo || '').trim();
    setShipDocket('');
    if (String(jobData?.docketNo || '').trim() || !no || /^draft$/i.test(no)) return undefined;
    let live = true;
    fetch('/api/shipments/by-job?jobNo=' + encodeURIComponent(no)).then(r => (r.ok ? r.json() : null)).then(d => { if (live && d && d.docketNo) setShipDocket(d.docketNo); }).catch(() => {});
    return () => { live = false; };
  }, [jobData?.jobNo, jobData?.docketNo]);
  const docketNo = String(jobData?.docketNo || '').trim() || shipDocket;
  // 18-Nov-2026: e-Sanchit document type names from the e-Sanchit master (379 codes, loaded from iCAFFE) - the list
  // below had only 9, so 315HS1 printed with no name (iCAFFE: "High Sea Sale Agreement"). Active codes first.
  const [docNames, setDocNames] = React.useState({});
  React.useEffect(() => {
    let live = true;
    fetch('/api/masters/esanchits').then(r => (r.ok ? r.json() : [])).then(j => {
      const rows = Array.isArray(j) ? j : (j && Array.isArray(j.data) ? j.data : []);
      const m = {};
      [...rows.filter(x => x && x.isActive === false), ...rows.filter(x => x && x.isActive !== false)].forEach(x => { const c = String(x.documentCode || '').trim(); if (c && x.description) m[c] = String(x.description).trim(); });
      if (live) setDocNames(m);
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const docTypeName = (c) => docNames[String(c || '').trim()] || DOC_TYPE[c] || '';

  const beType = ({ WAREHOUSE: 'W', EX_BOND: 'X' })[String(jobData?.boeType || '').toUpperCase()] || String(jobData?.autoField_51 || 'H').charAt(0).toUpperCase() || 'H';
  const mode = ({ AIR: 'A', SEA: 'S', LAND: 'L' })[String(jobData?.shipmentMode || '').toUpperCase()] || String(jobData?.autoField_52 || 'A').charAt(0).toUpperCase();

  const load = React.useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/icegate/preview-be', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData: { ...jobData, esanchitDocs: esanchitDocs || [] }, items, invoices: jobData?.invoices || [], beType, transportMode: mode }) });
      const d = await res.json();
      if (d && d.success) setCj(d.cachi01); else setErr((d && d.error) || 'Could not build the checklist');
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, [jobData, items, esanchitDocs, beType, mode]);

  // 30-Oct-2026: this ran on every change of jobData / items, so typing in any box fired a /preview-be POST per
  // keystroke - each one builds the whole BE and takes a sequence number. The checklist is now rebuilt a moment
  // after typing stops (and at once when the job, its BE type or its mode changes), with a Refresh button below.
  const loadRef = React.useRef(load);
  loadRef.current = load;
  React.useEffect(() => { const t = setTimeout(() => loadRef.current(), 600); return () => clearTimeout(t); }, [jobData, items, esanchitDocs, beType, mode]);
  // title = our software name (Settings key "software_name", default EagleView 360) instead of "E-Annex". 28-Oct-2026
  React.useEffect(() => { fetch('/api/settings').then(r => r.json()).then(s => { if (s && s.software_name) setSoftwareName(s.software_name); }).catch(() => {}); }, []);
  // items without a BCD / IGST rate (e.g. a BE read from a JSON file): take the rate from the Tariff master for the estimate
  React.useEffect(() => {
    const ritcs = [...new Set((cj?.master?.itemsModel || []).map(it => it.ritcCode).filter(Boolean))].filter(r => !(r in tariff));
    if (!ritcs.length) return;
    Promise.all(ritcs.map(r => fetch('/api/tariff/' + r).then(x => x.json()).then(d => [r, d && d.success ? d.data : null]).catch(() => [r, null])))
      .then(rows => setTariff(prev => ({ ...prev, ...Object.fromEntries(rows) })));
  }, [cj]);
  React.useEffect(() => {
    axios.get('/api/masters/cha-master').then(r => {
      const all = (r.data && r.data.data) || (Array.isArray(r.data) ? r.data : []);
      // CHA picked in Job Header ("NAME - CODE" or just the code) -> CHA Master row; if the job has none, the
      // default CHA of Settings > CHA Master. If the code is not in the master, the name typed in the header is used. 28-Oct-2026
      const raw = String(jobData?.chaCode || jobData?.autoField_3 || '').trim();
      const cut = raw.lastIndexOf(' - ');
      const code = (cut >= 0 ? raw.slice(cut + 3) : raw).trim().toUpperCase();
      const hit = code && all.find(c => String(c.chaCode || '').toUpperCase() === code || String(c.chaLicense || '').toUpperCase() === code);
      if (hit) setCha(hit);
      else if (code) setCha({ chaCode: code, chaName: cut >= 0 ? raw.slice(0, cut).trim() : '', chaAddress: '', chaCity: '', chaPin: '' });
      else setCha(all.find(c => c.isDefault) || null);
    }).catch(() => {});
  }, [jobData?.chaCode, jobData?.autoField_3]);

  if (err) return <div style={{ color: '#dc2626', padding: '1rem' }}>Checklist: {err}</div>;
  if (!cj) return <div style={{ padding: '1rem', color: '#64748b' }}>{loading ? 'Preparing checklist...' : ''}</div>;

  const m = cj.master || {};
  const h = cj.headerField || {};
  const be = (m.beModel || [])[0] || {};
  const igm = (m.igmsModel || [])[0] || {};
  const ctx = (m.ctxModel || [])[0] || {};
  // a job without invoices gets one empty invoice row in the JSON (schema needs one) - not printed. 29-Oct-2026
  const invs = (m.invoiceModel || []).filter(iv => iv.actualInvoiceNumber || parseFloat(iv.invoiceValue));
  const its = m.itemsModel || [];
  const duties = m.sbedutyModel || [];
  const rates = m.exchangeModel || [];
  const country = (c) => { const x = (masters?.countries || []).find(k => String(k.code).toUpperCase() === String(c || '').toUpperCase()); return x ? String(x.name).toUpperCase() : (c || ''); };
  // 17-Nov-2026: a foreign port / airport is not in the (Indian) port master, so the code was printed (THBKK); now the
  // name picked on the Job Header (Origin / Shipment Port) is used for that code - iCAFFE prints the name (BANGKOK)
  const portHint = {};
  [[jobData?.portOfShipment, jobData?.portOfShipmentName], [jobData?.portOfOrigin || jobData?.autoField_22, jobData?.portOfOriginName]].forEach(([c, n]) => { if (c && n && String(n).trim()) portHint[String(c).toUpperCase()] = String(n).trim().toUpperCase(); });
  const portName = (c) => { const x = (masters?.ports || []).find(k => String(k.portCode).toUpperCase() === String(c || '').toUpperCase()); return x ? String(x.portName).toUpperCase() : (portHint[String(c || '').toUpperCase()] || c || ''); };
  const stateName = (code) => { const x = (masters?.states || []).find(s => String(s.taxCode) === String(code)); return x ? String(x.stateName).toUpperCase() : ''; };
  // 29-Oct-2026: the Total Freight / Misc / Insurance box printed the header's cumulative boxes (0.00 on most jobs);
  // now the invoices' freight / misc / insurance added up in rupees (amount x exchange rate, or % of the invoice value)
  const exOf = (cur) => { const c = String(cur || '').toUpperCase(); if (!c || c === 'INR') return 1; const r = rates.find(x => x.currencyCode === c); return r ? (parseFloat(r.rate) || 0) / (parseFloat(r.unitInRs) || 1) : 0; };
  const chargeInr = (iv, amt, cur, pct) => { const a = parseFloat(amt) || 0, p = parseFloat(pct) || 0; return a ? a * exOf(cur || iv.invoiceCurrency) : (p ? p / 100 * (parseFloat(iv.invoiceValue) || 0) * exOf(iv.invoiceCurrency) : 0); };
  const totFrt = (m.invoiceModel || []).reduce((s, iv) => s + chargeInr(iv, iv.freightValue, iv.freightCurrency, iv.freightRate), 0);
  const totIns = (m.invoiceModel || []).reduce((s, iv) => s + chargeInr(iv, iv.insuranceValue, iv.insuranceCurrency, iv.insuranceRate), 0);
  const totMisc = (m.invoiceModel || []).reduce((s, iv) => s + chargeInr(iv, iv.miscCharges, iv.miscCurrency, iv.miscChargesRate), 0);
  const rateLine = (cur) => { const r = rates.find(x => x.currencyCode === cur); return r ? `${n2(r.unitInRs)} ${cur} = ${n2(r.rate, 4)} INR` : (cur === 'INR' ? `1.00 INR = 1.0000 INR` : `${cur} rate missing`); };
  const user = (() => { try { const t = localStorage.getItem('token'); return t ? (JSON.parse(atob(t.split('.')[1])).username || '') : ''; } catch (e) { return ''; } })();
  const printedAt = (() => { const d = new Date(); const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const h12 = d.getHours() % 12 || 12, p = (x) => String(x).padStart(2, '0');
    return `${p(d.getDate())}-${mon}-${d.getFullYear()} ${p(h12)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`; })();

  // screen item for each JSON item (duty rates live on the screen item)
  const rateNotes = [];
  const screenItem = (it) => {
    const s = (items || []).find(x => String(x.invSrNo || x.invoiceSrNo || 1) === String(it.invoiceSerialNumber) && String(x.itemSrNo || x.itemNo) === String(it.itemSerialNumber)) || {};
    const t = tariff[it.ritcCode];
    const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const ig = obj(s.igstData);
    const out = { ...s };
    const tag = `Item ${it.invoiceSerialNumber}/${it.itemSerialNumber} (${it.ritcCode})`;
    // 30-Oct-2026: a nearest-heading line of the master (exact:false) is never used as the item's rate
    const tExact = t && t.exact !== false ? t : null;
    const near = t && t.exact === false ? ` (master has only the nearest line ${t.matchedCode || t.ritc} - not used)` : '';
    if (!has(s.bcdRate)) {
      if (it.bcdNotification) rateNotes.push(`${tag}: BCD rate not entered (notification ${it.bcdNotification} ${it.bcdNotificationSrNo || ''}) - BCD taken as 0`);
      else if (tExact && tExact.bcdRate != null) { out.bcdRate = String(tExact.bcdRate); rateNotes.push(`${tag}: BCD ${tExact.bcdRate}% from Tariff master`); }
      else rateNotes.push(`${tag}: BCD rate missing${near}`);
    }
    if (!has(ig.rate)) {
      if (tExact && tExact.igstRate != null) { out.igstData = { ...ig, rate: String(tExact.igstRate) }; rateNotes.push(`${tag}: IGST ${tExact.igstRate}% from Tariff master`); }
      else rateNotes.push(`${tag}: IGST rate missing${near}`);
    }
    // 30-Oct-2026: a specific (per-unit) tariff rate was ignored here as well, so the checklist showed only the
    // percentage of lines that read "x% or Rs y per kg, whichever is higher" - and the client was quoted too little.
    if (!has(s.bcdSpecAmount) && tExact && tExact.bcd && parseFloat(tExact.bcd.amount) > 0) { // 09-Nov-2026: a master line with Rs 0 is no specific rate (it put "BCD also Rs 0 per" on every item)
      out.bcdSpecAmount = String(tExact.bcd.amount);
      if (!has(s.bcdUnit) && tExact.bcd.uqc) out.bcdUnit = String(tExact.bcd.uqc).toUpperCase();
      if (!has(s.bcdRateBasis) && tExact.bcd.basis) out.bcdRateBasis = String(tExact.bcd.basis);
      rateNotes.push(`${tag}: BCD also Rs ${tExact.bcd.amount} per ${String(tExact.bcd.uqc || '').toUpperCase()} from Tariff master`);
    }
    return out;
  };
  const dutyOf = (it) => { const r = dutyRows.find(x => x.it === it); return r ? r.d : computeItemDuty(screenItem(it), jobData?.invoices || [], jobData || {}); };
  const rowsOf = (it, type, flag) => duties.filter(d => d.invoiceSerialNumber === it.invoiceSerialNumber && d.itemSerialNumber === it.itemSerialNumber && d.dutyType === type && d.addlDutyFlag === flag);
  const dutyRows = its.map(it => { const s = screenItem(it); return { it, s, d: computeItemDuty(s, jobData?.invoices || [], jobData || {}) }; });
  // which side of a two-rate BCD line the estimate used, and when the specific side could not be worked out
  dutyRows.forEach(({ it, d }) => {
    const b = d.bcdBasis; if (!b) return;
    const tag = `Item ${it.invoiceSerialNumber}/${it.itemSerialNumber} (${it.ritcCode})`;
    if (b.needQty) rateNotes.push(`${tag}: BCD has a rate per ${b.uqc} but the item quantity is in another unit - only the % is applied, enter "Qty in duty unit"`);
    else if (b.adv !== null && b.spec !== null) rateNotes.push(`${tag}: BCD ${b.applied === 'S' ? 'Rs ' + b.spec.toFixed(2) + ' at the specific rate' : 'Rs ' + b.adv.toFixed(2) + ' by rate'} applied (the other side came to Rs ${(b.applied === 'S' ? b.adv : b.spec).toFixed(2)})`);
    else if (b.spec !== null) rateNotes.push(`${tag}: BCD is a specific rate - Rs ${b.spec.toFixed(2)} on ${b.units} ${b.uqc}`);
  });
  const notes = [...new Set(rateNotes)];
  const sum = (f) => dutyRows.reduce((s, r) => s + (r.d[f] || 0), 0);
  const totAv = sum('av'), totBcd = sum('bcd'), totSws = sum('sws'), totIgst = sum('igst'), totHealth = sum('health'), totAdd = sum('add'), totOther = sum('other');
  const totCvd = sum('cvd') + sum('adlCvd') + sum('sapta'), totCess = sum('compCess');
  // 30-Oct-2026: every duty line of the estimate (CVD / addl CVD / SAPTA, comp. cess included); the BE total is rounded to the rupee like ICES
  // 17-Nov-2026: the gross total is printed to the paisa (iCAFFE: 28856.10); only the duty payable is rounded to the rupee
  const totGross = Math.round((totBcd + totSws + totIgst + totHealth + totAdd + totOther + totCvd + totCess) * 100) / 100;
  // 12-Nov-2026: duty foregone (licence / scrip debit, EOU) is in the gross total but not payable - as iCAFFE's checklist
  const totForegone = sum('foregone');
  const totDuty = Math.round(totGross - totForegone);
  const notionalNote = dutyRows.some(r => r.d.notional && (r.d.notional.insurance || r.d.notional.freight || r.d.notional.freightCapped))
    ? 'Estimate uses ICES notional charges: ' + [...new Set(dutyRows.flatMap(r => [r.d.notional?.insurance && 'insurance 1.125 % of FOB (none given)', r.d.notional?.freight && 'freight 20 % of FOB (none given)', r.d.notional?.freightCapped && 'air freight capped at 20 % of FOB'].filter(Boolean)))].join('; ') : '';
  if (notionalNote) notes.push(notionalNote);
  // our Job No (Query / header). Not the ICEGATE "jobNumber", which is only a running number (a time-based one for an unsaved job)
  const jobNoText = jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'DRAFT';
  const pan = String(ctx.commercialTaxRegistrationNo || '').length === 15 ? String(ctx.commercialTaxRegistrationNo).slice(2, 12) : '';
  // 29-Oct-2026: sections that were not on the checklist (misc charge rows, conditions of sale, SVB, anti-dumping, re-import, RSP, DEPB ...)
  const miscRows = (iv) => (m.misc_chModel || []).filter(r => String(r.invoiceSerialNumber) === String(iv.invoiceSerialNumber));
  const cond = (iv) => [1, 2, 3, 4, 5].map(i => iv['conditionsAttachedWithSale' + i]).filter(Boolean).join('; ');
  const svbText = (x) => [x.svbReferenceNumber ? `Ref ${x.svbReferenceNumber}` : '', x.svbReferenceDate ? `Dt. ${dmy(x.svbReferenceDate)}` : '', x.customHouseCodeWhichHasImposedLoad ? `CH ${x.customHouseCodeWhichHasImposedLoad}` : '',
    x.svbLoadAssessableValue ? `Load on AV ${n2(x.svbLoadAssessableValue)} % (${x.whetherloadProvisionalOnAssValue || x.whetherLoadProvisionalOnAssessableValue || ''})` : '', x.svbLoadOnDuty ? `Load on duty ${n2(x.svbLoadOnDuty)} % (${x.whetherProvisionalOnDuty || x.whetherLoadProvisionalOnDuty || ''})` : '', x.svbFlag ? `Flag ${x.svbFlag}` : ''].filter(Boolean).join(', ');
  const forItem = (list) => (it) => (list || []).filter(r => String(r.invoiceSerialNumber) === String(it.invoiceSerialNumber) && String(r.itemSerialNumberInvoice || r.itemSerialNumber) === String(it.itemSerialNumber));
  const reimpOf = forItem(m.reimportModel), rspOf = forItem(m.rspModel), depbOf = forItem(m.depbModel), licOf = forItem(m.licenseModel);
  const notn = (a, b) => [a, b].filter(Boolean).join(' ');
  const line = (label, text) => <tr><td style={{ ...td, ...B }}>{label}</td><td style={td} colSpan="6">{text}</td></tr>;

  const th = { ...B, textAlign: 'left', padding: '1px 3px', verticalAlign: 'top' };
  const td = { padding: '1px 3px', verticalAlign: 'top' };
  const tdr = { ...td, textAlign: 'right', paddingRight: '6px' };
  const sec = (t) => <div className="sech" style={{ ...B, fontSize: '9.5pt', marginTop: '6px', borderBottom: '1px solid #000' }}>{t}</div>;
  const dash = { borderBottom: '1px dashed #000' };
  const thr = { ...th, textAlign: 'right', paddingRight: '6px' };
  // fixed-width columns (percent) so text lines up the same way on every page
  const cols = (w) => <colgroup>{w.map((x, i) => <col key={i} style={{ width: x + '%' }} />)}</colgroup>;
  // header grid: label | : | value | label | : | value || label | : | value
  const grid9 = cols([15.5, 1.5, 12, 13.5, 1.5, 11, 15.5, 1.5, 28]);
  // label, colon and value cells; span = how many grid columns the value takes
  const K = (k, v, span = 1) => (<><td style={{ ...td, ...B, whiteSpace: 'nowrap', overflow: 'hidden' }}>{k}</td><td style={{ ...td, padding: '1px 0' }}>:</td><td style={td} colSpan={span}>{v}</td></>);

  return (
    <div className="eannex" style={F}>
      <style>{`
        @media print {
          @page { size: 210mm 305mm; margin: 12mm 10mm 14mm 10mm;
            @bottom-left { content: "${printedAt}"; font: 8pt Helvetica, Arial, sans-serif; }
            @bottom-center { content: "Prepared By : ${String(user).replace(/"/g, '')}"; font: 8pt Helvetica, Arial, sans-serif; }
            @bottom-right { content: "Page " counter(page) " Of " counter(pages); font: 8pt Helvetica, Arial, sans-serif; } }
          .eannex .avoid { break-inside: avoid; }
          .eannex .sech { break-after: avoid; page-break-after: avoid; }
          .eannex .sech + table tr:nth-child(-n+2) { break-before: avoid; }
        }
        .eannex table { border-collapse: collapse; width: 100%; }
      `}</style>

      {notes.length > 0 && (
        <div className="no-print" style={{ border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px', fontSize: '8.5pt' }}>
          <b>Duty rates - please check (not printed):</b>
          <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{notes.slice(0, 12).map((x, i) => <li key={i}>{x}</li>)}{notes.length > 12 && <li>...and {notes.length - 12} more</li>}</ul>
          Enter the rates in 4. Items (IGST popup / BCD rate) or use "Fetch Item".
        </div>
      )}
      {/* ---- title ---- */}
      <div style={{ textAlign: 'center', ...B, fontSize: '10pt' }}>
        <div>{softwareName}</div>
        <div>{cha ? String(cha.chaName).toUpperCase() : ''}</div>
        <div>CHA : {(cha && cha.chaCode) || be.chaCode}</div>
        <div>{BE_TITLE[be.beType] || BE_TITLE.H}</div>
      </div>

      {/* ---- job / importer + IGM: one fixed 9-column grid so every label, colon and value lines up (31-Oct fix) ---- */}
      <table style={{ marginTop: '10px', tableLayout: 'fixed' }}>{grid9}<tbody>
        <tr>{K('Location', `${portName(h.receiverID)} [ ${h.receiverID} ] [ ${MODE[be.modeOfTransport] || ''} ]`, 4)}{K('Job No / Date', <>{jobNoText} &nbsp;Dt. {dmy(jobData?.jobDate || h.jobDate)}</>)}</tr>
        <tr><td colSpan={6} style={td} />{K('Docket No.', docketNo)}</tr>
        <tr>{K('B/E No. / Date', jobData?.beNo ? <>{jobData.beNo} &nbsp;Dt. {dmy(jobData.beDate)}</> : '', 4)}{K('User Job No', jobData?.userJobNo || '')}</tr>
        <tr>{K('CHA Details', <>{(cha && cha.chaCode) || be.chaCode}{cha && <><br />{String(cha.chaName || '').toUpperCase()}<br />{String(cha.chaAddress || '').toUpperCase()} {String(cha.chaCity || '').toUpperCase()}{cha.chaPin ? ' - ' + cha.chaPin : ''}</>}</>, 4)}
          {K('Importer Detail', <>{be.iecCode} &nbsp;&nbsp;<span style={B}>Branch Code :</span> {be.branchSrNo}<br />
            {be.nameOfImporter}<br />{[be.address1, be.address2].filter(Boolean).join(' ')} {be.city} {be.state}{be.pin ? ' - ' + be.pin : ''}
            {pan && <><br /><span style={B}>PAN No. :</span> {pan}</>}
            {ctx.commercialTaxRegistrationNo && <><br /><span style={B}>GSTIN No. :</span> {ctx.commercialTaxRegistrationNo}</>}</>)}</tr>
        <tr>{K('Kaccha BE', yn(be.kachchaBE))}{K('Green Channel', yn(be.greenChannelRequested))}{K('Importer Type', <>{IMPORTER_TYPE[be.importerType] || be.importerType} &nbsp;&nbsp;<span style={B}>AD Code :</span> {be.authorizedEconomicDealerCode}</>)}</tr>
        <tr>{K('Section 48', yn(be.section48Requested))}{K('First Check', yn(be.firstCheckRequested))}{K('Pay Mode', be.paymentMethodCode === 'T' ? 'TRANSACTION' : be.paymentMethodCode)}</tr>
        <tr>{K('WH B/E No.', be.warehouseBENo)}{K('WH B/E Dt.', dmy(be.warehouseBEDate))}{K('Prior BE', yn(be.whetherPriorBE))}</tr>
        <tr>{K('WH Job No.', jobData?.whJobNo || '')}{K('WH Job Dt.', '')}<td colSpan="3" /></tr>
        {/* 29-Oct-2026: high-sea sale, UCR, warehouse code / site and the packages released on a W / X BE were not printed */}
        {(be.highSeaSaleFlag === 'Y' || be.uniqueConsignmentReferenceNo || be.warehouseCode || be.warehouseCustomSiteId) && (
          <tr>{K('High Sea Sale', yn(be.highSeaSaleFlag))}{K('UCR No.', [be.uniqueConsignmentReferenceNo, be.ucrType ? `(${be.ucrType})` : ''].filter(Boolean).join(' '))}{K('WH Code / Site', [be.warehouseCode, be.warehouseCustomSiteId].filter(Boolean).join(' / '))}</tr>)}
        {(be.noOfPackagesReleased || be.grossWeight) && (
          <tr>{K('Pkgs Released', `${be.noOfPackagesReleased || ''} ${be.packageCode || ''}`)}{K('Gross Wt.', `${be.grossWeight ? n2(be.grossWeight, 3) : ''} ${be.unitOfMeasurement || ''}`)}{K('BE Class', be.beClass)}</tr>)}
      </tbody></table>
      {(m.permissionModel || []).length > 0 && (<div className="avoid">{sec('Permission Requested')}
        <table style={{ tableLayout: 'fixed' }}>{cols([12, 28, 60])}<tbody><tr style={dash}><th style={th}>Code</th><th style={th}>Permission</th><th style={th}>Reason</th></tr>
          {(m.permissionModel || []).map((r, i) => <tr key={i}><td style={td}>{r.permissionCode}</td><td style={td}>{({ S48: 'Section 48', FCK: 'First Check', PRV: 'Provisional Assessment' })[r.permissionCode] || ''}</td><td style={td}>{r.reasonsForRequest}</td></tr>)}</tbody></table></div>)}
      {(m.hssModel || []).length > 0 && (<div className="avoid">{sec('High Sea Sale Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([30, 14, 8, 30, 10, 8])}<tbody><tr style={dash}><th style={th}>Seller Name</th><th style={th}>IEC</th><th style={th}>Br.</th><th style={th}>Address</th><th style={th}>Pin</th><th style={th}>Level</th></tr>
          {(m.hssModel || []).map((r, i) => <tr key={i}><td style={td}>{r.importerName}</td><td style={td}>{r.iec}</td><td style={td}>{r.branchSrNo}</td><td style={td}>{[r.importerAddress1, r.importerAddress2, r.importerCity].filter(Boolean).join(' ')}</td><td style={td}>{r.importerPin}</td><td style={td}>{r.precedingLevel}</td></tr>)}</tbody></table></div>)}

      {/* ---- IGM (same grid) ---- */}
      {sec('IGM Details')}
      <table style={{ tableLayout: 'fixed' }}>{grid9}<tbody>
        <tr>{K('IGM No.', igm.igmNumber || '0')}{K('Dt.', dmy(igm.igmDate))}{K('Port Of Loading', portName(be.portOfShipment))}</tr>
        <tr>{K('IGM Inward Date', dmy(igm.inwardDate), 4)}{K('Reporting Port', igm.gatewayPortCode ? (portName(igm.gatewayPortCode) && portName(igm.gatewayPortCode) !== igm.gatewayPortCode ? portName(igm.gatewayPortCode) + ' (' + igm.gatewayPortCode + ')' : igm.gatewayPortCode) : '')}</tr>
        {igm.gatewayIgmNo && <tr>{K('Gateway IGM No.', igm.gatewayIgmNo)}{K('Dt.', dmy(igm.gatewayIgmDate))}{K('Port of Origin', portName(be.portOfOrigin))}</tr>}
        <tr>{K('Country/Origin', country(be.countryOfOrigin), 4)}{K('Country/Consig.', country(be.countryOfConsignment))}</tr>
        {/* 20-Nov-2026: B/L labels for everything but air - an ICD BE goes as Land (L) and carries the B/L */}
        <tr>{K(MODE[be.modeOfTransport] !== 'Air' ? 'MBL No.' : 'MAWB No.', igm.mawbNo)}{K('Dt.', dmy(igm.mawbDate))}
          {K(MODE[be.modeOfTransport] !== 'Air' ? 'HBL No.' : 'HAWB No.', <>{igm.hawbNo}{igm.hawbDate ? <> &nbsp;&nbsp;<span style={B}>Dt. :</span> {dmy(igm.hawbDate)}</> : null}</>)}</tr>
        <tr>{K('No. Of Packages', `${igm.totalNoOfPackages || ''} ${igm.packageCode || ''}`, 4)}{K('Gross Weight', `${n2(igm.grossWeight, 3)} ${igm.unitQuantityCode || ''}`)}</tr>
        <tr>{K('Marks & No.', [igm.marksAndNumbers1, igm.marksAndNumbers2, igm.marksAndNumbers3].filter(Boolean).join(' '), 7)}</tr>
      </tbody></table>
      {(m.containerModel || []).length > 0 && (<>
        {sec('Container Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([25, 25, 15, 35])}<tbody><tr style={dash}><th style={th}>Container No.</th><th style={th}>Seal No.</th><th style={th}>FCL/LCL</th><th style={th}>Truck No.</th></tr>
          {(m.containerModel || []).map((c, i) => <tr key={i}><td style={td}>{c.contNumber}</td><td style={td}>{c.sealNumber}</td><td style={td}>{c.lclfcl === 'F' ? 'FCL' : c.lclfcl === 'L' ? 'LCL' : c.lclfcl}</td><td style={td}>{c.truckNumber}</td></tr>)}
        </tbody></table></>)}

      {/* ---- invoices: left and right halves each use a label / colon / value grid ---- */}
      {sec('Invoice Details')}
      {invs.map((iv, k) => {
        // 17-Nov-2026: a charge given as a % printed only "1.13 %"; now as iCAFFE: the amount in the invoice currency and the
        // rate to 4 places ("10.87 USD | 1.1250 %")
        const amt = (v, cur, rate) => (String(v || '').trim() && parseFloat(v) ? `${n2(v)} ${cur || ''}`
          : (String(rate || '').trim() && parseFloat(rate) ? `${n2(parseFloat(rate) / 100 * (parseFloat(iv.invoiceValue) || 0))} ${iv.invoiceCurrency || ''} | ${n2(rate, 4)} %` : '0.00'));
        const half = (rows) => (<table style={{ tableLayout: 'fixed' }}>{cols([36, 4, 60])}<tbody>{rows.map(([kk, vv], i) => <tr key={i}>{K(kk, vv)}</tr>)}</tbody></table>);
        const fx = (cur) => rateLine(cur).replace(/^([\d.]+) (\w+)/, '$1 ( $2 )');
        return (
          <table key={k} className="avoid" style={{ marginBottom: '4px', tableLayout: 'fixed', borderBottom: k < invs.length - 1 ? '1px dashed #000' : undefined }}>{cols([50, 50])}<tbody><tr>
            <td style={{ verticalAlign: 'top', paddingRight: '8px' }}>{half([
              ['Inv No.', <>{iv.actualInvoiceNumber} &nbsp;Dt. {dmy(iv.invoiceDate)}</>],
              ['Inv Value', <>{n2(iv.invoiceValue)} {iv.invoiceCurrency} &nbsp;&nbsp;&nbsp;<span style={B}>TOI :</span> {iv.termsOfInvoice}</>],
              ['Freight', amt(iv.freightValue, iv.freightCurrency, iv.freightRate)],
              ['Insurance', amt(iv.insuranceValue, iv.insuranceCurrency, iv.insuranceRate)],
              ['Agency Comm.', amt(iv.agencyCommission, iv.agencyCommissionCurrency, iv.agencyCommissionRate)],
              ['Loading Charges', amt(iv.loadingCharges, iv.loadingCurrency, iv.loadRate)],
              ['M Chrgs in Inv', amt(iv.miscCharges, iv.miscCurrency, iv.miscChargesRate)],
              ['High Sea Sale', amt(iv.hssLoadAmount, '', iv.hssLoadRate)],
              ['Discount', amt(iv.discountAmount, '', iv.discountRate)],
              ['Nature of Trans.', NATURE[iv.natureOfTransaction] || iv.natureOfTransaction],
              ['Terms of Payment', PAY_TERMS[iv.paymentTerms] || iv.paymentTerms],
              ['Valuation Method', String(iv.valuationMethodApplicable || '').toUpperCase()],
              // 29-Oct-2026: PO / contract / terms place / discount nature / conditions / other info were not printed
              ...(iv.purchaseOrderNumber ? [['PO No / Dt', [iv.purchaseOrderNumber, dmy(iv.purchaseOrderDate)].filter(Boolean).join(' Dt. ')]] : []),
              ...(iv.contractNumber ? [['Contract No / Dt', [iv.contractNumber, dmy(iv.contractDate)].filter(Boolean).join(' Dt. ')]] : []),
              ...(iv.termsPlace ? [['Terms Place', iv.termsPlace]] : []),
              ...(iv.natureOfDiscount ? [['Nature of Disc.', iv.natureOfDiscount]] : []),
              ...(miscRows(iv).length ? [['Misc Chrg Rows', miscRows(iv).map(r => `${r.miscChargesCode || ''} ${r.miscChargesDscrptn || ''} ${parseFloat(r.miscCharges) ? n2(r.miscCharges) : (parseFloat(r.miscRate) ? n2(r.miscRate) + ' %' : '')}`.trim()).join('; ')]] : []),
              ...(cond(iv) ? [['Conditions', cond(iv)]] : []),
              ...(iv.otherRelevantInform ? [['Other Info', iv.otherRelevantInform]] : []),
            ])}</td>
            <td style={{ verticalAlign: 'top' }}>{half([
              ['Supplier Detail', <>{iv.supplierName}<br />{[iv.supplierAddress1, iv.supplierAddress2, iv.supplierAddress3].filter(x => x && x !== ',').join(' ')}<br />{String(iv.supplierCountryName || '').length <= 3 ? country(iv.supplierCountryName) : iv.supplierCountryName}</>],
              ['B/S Related', yn(iv.whetherBuyerAndSellerAreRelated) === 'Yes' ? 'YES' : 'NO'],
              ['Exchange Rate', <>{rateLine(iv.invoiceCurrency)}
                {iv.freightCurrency && <><br />FRT :- {fx(iv.freightCurrency)}</>}
                {iv.insuranceCurrency && <><br />INS :- {fx(iv.insuranceCurrency)}</>}
                {iv.miscCurrency && <><br />MISC :- {fx(iv.miscCurrency)}</>}</>],
              ['LOC No-Date', [iv.lcNumber, dmy(iv.lcDate)].filter(Boolean).join(' - ')],
              // 29-Oct-2026: seller / broker / third party / AEO / invoice SVB were not printed
              ...(iv.sellerName ? [['Seller Detail', <>{iv.sellerName}<br />{[iv.sellerAddress1, iv.sellerAddress2, iv.sellerAddress3].filter(Boolean).join(' ')} {String(iv.sellerCountryName || '').length <= 3 ? country(iv.sellerCountryName) : iv.sellerCountryName}</>]] : []),
              ...(iv.brokerName ? [['Broker Detail', <>{iv.brokerName}<br />{[iv.brokerAddress1, iv.brokerAddress2, iv.brokerAddress3].filter(Boolean).join(' ')} {country(iv.brokerCountry)}</>]] : []),
              ...(iv.thirdPartyName ? [['Third Party', <>{iv.thirdPartyName}<br />{[iv.thirdPartyAddress1, iv.thirdPartyAddress2, iv.thirdPartyCity, iv.thirdPartyCntrySubDvsn].filter(Boolean).join(' ')} {country(iv.thirdPartyCountryCode)}{iv.thirdPartyPin ? ' - ' + iv.thirdPartyPin : ''}</>]] : []),
              ...(iv.authorizedEconomicOperatorCode ? [['AEO', [iv.authorizedEconomicOperatorCode, iv.authorizedEconomicOperatorCountry, iv.authorizedEconomicOperatorRole].filter(Boolean).join(' / ')]] : []),
              ...((iv.svbReferenceNumber || iv.svbLoadAssessableValue || iv.svbLoadOnDuty) ? [['SVB (Invoice)', svbText(iv)]] : []),
            ])}</td>
          </tr></tbody></table>
        );
      })}

      {/* ---- items: fixed 7 columns; numbers right-aligned under right-aligned headings ---- */}
      <div style={{ ...dash, marginTop: '4px' }} />
      {sec('Item Details')}
      <table style={{ tableLayout: 'fixed' }}>{cols([16, 15, 12, 9, 16, 14, 18])}<tbody>
        <tr><th style={th}>Sr. No.</th><th style={th}>RITC</th><th style={th} colSpan="4">Description (Generic Description - Model)</th><th style={thr}>SVB Loading(A/D)</th></tr>
        <tr style={{ borderBottom: '1px solid #000' }}><th style={th}>Qty<br />Unit</th><th style={thr}>Unit Price<br />Ass Val (Rs.)</th><th style={{ ...th, paddingLeft: '8px' }}>CTH<br />CETH</th><th style={th}>Std/Pref</th>
          <th style={th}>Cus Notn.<br />Exc Notn.</th><th style={thr}>Cus Dty Rate<br />Exc Dty Rate</th><th style={thr}>BCD Amt (Rs.)<br />CVD Amt (Rs.)</th></tr>
      </tbody>
      {invs.map((iv, k) => {
        const rows = dutyRows.filter(r => r.it.invoiceSerialNumber === iv.invoiceSerialNumber);
        const ivAv = rows.reduce((s, r) => s + r.d.av, 0), ivDuty = rows.reduce((s, r) => s + r.d.total, 0);
        const duty = (label, notn, rate, amount) => <tr><td style={{ ...td, ...B }} colSpan="4">{label}</td><td style={td}>{notn}</td><td style={tdr}>{n2(rate)} %</td><td style={tdr}>{n2(amount)}</td></tr>;
        return (
          <React.Fragment key={k}>
          <tbody>
            <tr><td style={{ ...td, paddingTop: '4px' }} colSpan="7"><span style={B}>Inv Sr. No. :</span> {iv.invoiceSerialNumber} &nbsp;&nbsp;&nbsp;&nbsp;<span style={B}>Inv No. :</span> {iv.actualInvoiceNumber} &nbsp;&nbsp;&nbsp;&nbsp;<span style={B}>Inv Dt :</span> {dmy(iv.invoiceDate)}</td></tr>
          </tbody>
            {rows.map(({ it, d, s }, j) => {
              const aidc = rowsOf(it, 'C', 'A')[0], ig = rowsOf(it, 'G', 'I')[0], cess = rowsOf(it, 'G', 'P')[0];
              const igRate = obj(s.igstData).rate;
              // full description as typed on the item (the JSON splits it at 60 characters, sometimes mid-word)
              const desc = String(s.desc || s.productDescription || '').trim() || [it.itemDescription1, it.itemDescription2].filter(Boolean).join(' ');
              const gen = it.genericDescriptionOfTheItem && it.genericDescriptionOfTheItem !== it.itemDescription1 ? it.genericDescriptionOfTheItem : '';
              const pt = { paddingTop: '6px' };
              return (
                <tbody key={j} className="avoid">
                  <tr><td style={{ ...td, ...B, ...pt }}>{it.itemSerialNumber}</td><td style={{ ...td, ...pt }}>{it.ritcCode}</td>
                    <td style={{ ...td, ...pt }} colSpan="4">{gen ? `(${gen}) ` : ''}{desc}{it.model && it.model !== 'NA' && !desc.includes(it.model) ? ` (${it.model})` : ''}</td><td style={{ ...tdr, ...pt }}>{it.svbFlag || ''}</td></tr>
                  <tr><td style={td}>{n2(it.quantity, 6)}</td><td style={tdr}>{n2(it.unitPriceInvoiced, 6)}</td><td style={{ ...td, paddingLeft: '8px' }}>{it.cth}</td><td style={td}>{it.preferentialStandard === 'P' ? 'Pref' : 'Std'}</td>
                    <td style={td}>{[it.bcdNotification, it.bcdNotificationSrNo].filter(Boolean).join(' ')}</td><td style={tdr}>{n2(s.bcdRate)} %</td><td style={tdr}>{n2(d.bcd)}</td></tr>
                  <tr><td style={td}>{it.unitQuantityCode}</td><td style={tdr}>{n2(d.av)}</td><td style={{ ...td, paddingLeft: '8px' }}>{it.ceth === 'NOEXCISE' ? it.cth : it.ceth}</td><td /><td style={td}>{[it.cvdNotification, it.cvdNotificationSrNo].filter(Boolean).join(' ')}</td><td style={tdr}>0.00 %</td><td style={tdr}>0.00</td></tr>
                  {aidc && duty('AIDC Duty (C)', `${aidc.notificationNo} ${aidc.notificationSrNo}`, obj(s.otherDutyData)['Infra Cess_rate'] || 0, d.aidc || 0)}
                  {duty('Social Welfare Surcharge', [it.socialWelfareNotn, it.socialWelfareNotnSlno].filter(Boolean).join(' '), s.swsRate || 10, d.sws)}
                  {d.health > 0 && duty('Health Cess', [it.healthNotn, it.healthSrNo].filter(Boolean).join(' '), s.healthCessRate, d.health)}
                  {duty('IGST', ig ? `${ig.notificationNo} ${ig.notificationSrNo}` : '', igRate, d.igst)}
                  {(cess || d.compCess > 0) && duty('GST Compensation Cess', cess ? `${cess.notificationNo} ${cess.notificationSrNo}` : '', obj(s.igstData).cessRate || 0, d.compCess || 0)}
                  {/* 29-Oct-2026: the other notifications of the item (anti-dumping, safeguard, SAPTA, addl CVD, NCD, addl 1/2, other, tariff value, aggregate) */}
                  {it.antiDumpingDutyNotification && duty('Anti-dumping Duty' + (it.cthSerialNumber || it.supplierSerialNumber ? ` (CTH Sr ${it.cthSerialNumber || '-'} / Supp Sr ${it.supplierSerialNumber || '-'}${it.quantityAsPerAntiDumpingNotn ? ' / Qty ' + it.quantityAsPerAntiDumpingNotn : ''})` : ''), notn(it.antiDumpingDutyNotification, it.antiDumpingDutySerialNumber), obj(s.addData).rate, d.add)}
                  {it.safeguardDutyNotn && duty('Safeguard Duty', notn(it.safeguardDutyNotn, it.safeguardDutyNotnSrNo), 0, 0)}
                  {it.saptaNotn && duty('SAPTA / Preferential', notn(it.saptaNotn, it.saptaSerialNumber), s.saptaRate, s.saptaAmount)}
                  {it.additionalCvdNotn && duty('Additional CVD', notn(it.additionalCvdNotn, it.additionalCvdSrNo), s.adlCvdRate, s.adlCvdAmount)}
                  {it.ncdNotn && duty('NCD', notn(it.ncdNotn, it.ncdNotnSrNo), obj(s.ncdData).ncdRate, obj(s.ncdData).ncdAmount)}
                  {it.additionalNotification1 && duty('Additional Notn 1', notn(it.additionalNotification1, it.additionalNotification1SrNo), 0, 0)}
                  {it.additionalNotification2 && duty('Additional Notn 2', notn(it.additionalNotification2, it.additionalNotification2SrNo), 0, 0)}
                  {it.otherNotification && duty('Other Notn', notn(it.otherNotification, it.otherNotificationSrNo), 0, 0)}
                  {it.cusEducessNotfnNumber && duty('Customs Edu. Cess', notn(it.cusEducessNotfnNumber, it.cusEducessNotfnSrNo), 0, 0)}
                  {it.tariffValueNotn && line('Tariff Val Notn', `${notn(it.tariffValueNotn, it.tariffValueItemSerialNumber)}${it.quantityAsPerTariffValueNotn ? ' / Qty ' + it.quantityAsPerTariffValueNotn : ''}`)}
                  {it.aggregateDutyNotn && duty('Aggregate Duty Notn', notn(it.aggregateDutyNotn, it.aggregateDutyNotnSrNo), 0, 0)}
                  {(it.discountRate || it.discountAmount) && line('Item Discount', `${it.discountRate ? n2(it.discountRate) + ' %' : ''} ${it.discountAmount ? n2(it.discountAmount) : ''}`.trim())}
                  {(it.quantityAsPerCth || it.cthQty) && line('Qty as per CTH', `${it.quantityAsPerCth || ''} ${it.cthQty || ''}`.trim())}
                  <tr><td style={{ ...td, ...B }}>Manufacturer</td><td style={td} colSpan="3">{String(it.manufacturerName || '').toUpperCase()}</td><td style={td}><span style={B}>Acc. Status :</span> {it.accessoryStatus}</td><td style={td} colSpan="2"><span style={B}>Country of Origin :</span> {country(it.countryOfOrigin)}</td></tr>
                  <tr><td style={{ ...td, ...B }}>End Use</td><td style={td}>{it.endUseOfItem}</td><td style={td} colSpan="2"><span style={B}>Brand :</span> {it.brandName}</td><td style={td} colSpan="3"><span style={B}>Model :</span> {it.model}</td></tr>
                  {/* 29-Oct-2026: manufacturer address, source / transit country, accessories, category, policy para, previous BE, SVB, re-import, RSP, DEPB were not printed */}
                  {(it.itemManufacturerAddress1 || it.itemManufacturerCity || it.itemManufacturerCntry || it.itemManufacturerCode) && line('Mfr. Address', [it.itemManufacturerType && it.itemManufacturerCode ? `${it.itemManufacturerType} ${it.itemManufacturerCode}` : it.itemManufacturerCode, it.itemManufacturerAddress1, it.itemManufacturerAddress2, it.itemManufacturerCity, it.itemManufacturerSubdivision, it.itemManufacturerPin, country(it.itemManufacturerCntry)].filter(Boolean).join(' '))}
                  {(it.sourceCountry || it.transitCountry) && line('Src/Transit', `${it.sourceCountry ? 'Source ' + country(it.sourceCountry) : ''}${it.sourceCountry && it.transitCountry ? ' / ' : ''}${it.transitCountry ? 'Transit ' + country(it.transitCountry) : ''}`)}
                  {(it.accessoriesForTheItem || it.itemCategory) && line('Accessories', [it.accessoriesForTheItem, it.itemCategory ? `Category ${it.itemCategory}` : ''].filter(Boolean).join(' / '))}
                  {(it.policyParaNo || it.policyYear) && line('Policy Para', `${it.policyParaNo || ''} ${it.policyYear ? '(' + it.policyYear + ')' : ''}`.trim())}
                  {it.previousBeNo && line('Previous BE', [it.previousBeNo, it.previousBeDate ? 'Dt. ' + dmy(it.previousBeDate) : '', it.prevCustomSite, it.prevUnitPriceInvoiced ? `Unit price ${it.prevUnitPriceInvoiced} ${it.prevCurrencyCode || ''}` : ''].filter(Boolean).join(' '))}
                  {(it.svbReferenceNumber || it.svbLoadAssessableValue || it.svbLoadOnDuty) && line('SVB', svbText(it))}
                  {reimpOf(it).map((r, q) => <React.Fragment key={'re' + q}>{line('Re-import', `SB ${r.shippingBillNo} Dt. ${dmy(r.shippingBillDate)} ${r.portOfExport || ''}${r.invoiceNoSb ? ' Inv ' + r.invoiceNoSb : ''}${r.itemNoSb ? ' Item ' + r.itemNoSb : ''}${r.notificationNo ? ' Notn ' + notn(r.notificationNo, r.notificationSrNo) : ''} | Export freight ${n2(r.exportFreight)} Insurance ${n2(r.exportInsurance)} Customs duty ${n2(r.customsDuty)} Excise ${n2(r.exciseDuty)}`)}</React.Fragment>)}
                  {rspOf(it).map((r, q) => <React.Fragment key={'rsp' + q}>{line('RSP / MRP', `Rs. ${n2(r.rsp)} x ${r.quantity}${r.rspNotification ? ' Notn ' + notn(r.rspNotification, r.rspNotificationSrNo) : ''} (RSP applicability ${it.rspApplicability})`)}</React.Fragment>)}
                  {depbOf(it).map((r, q) => <React.Fragment key={'dp' + q}>{line('Scheme Exmp.', `Exemption ${r.whetherExemption} - Notn ${notn(r.bcdNotification, r.bcdNotificationSrNo)}`)}</React.Fragment>)}
                </tbody>
              );
            })}
          <tbody>
            <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}><td style={{ ...tdr, ...B, whiteSpace: 'nowrap' }} colSpan="2">Rs. {n2(ivAv)}</td><td colSpan="3" /><td style={{ ...tdr, ...B }}>Rs.</td><td style={{ ...tdr, ...B }}>{n2(ivDuty)}</td></tr>
          </tbody>
          </React.Fragment>
        );
      })}
      </table>

      {/* ---- totals: label | Rs. | amount on both sides ---- */}
      <table className="avoid" style={{ marginTop: '8px', tableLayout: 'fixed' }}>{cols([20, 5, 18, 5, 29, 5, 18])}<tbody>
        <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}><td style={{ ...td, ...B }}>Total Ass. Value</td><td style={{ ...tdr, ...B }}>Rs.</td><td style={{ ...tdr, ...B }}>{n2(totAv)}</td><td /><td style={{ ...td, ...B }}>BE Gross Total</td><td style={{ ...tdr, ...B }}>Rs.</td><td style={{ ...tdr, ...B }}>{n2(totGross)}</td></tr>
        {[['BCD', totBcd, 'SWS Duty', totSws], ['Safeguard Duty', 0, 'CESS', 0], ['Antidumping Duty', totAdd, 'Customs Educational Cess', 0], ['NCD Customs', 0, 'Secondary Custom Edu. Cess', 0],
          ['CVD', 0, 'Additional Duty(Imports)', totOther], ['AIDC Duty', 0, 'Custom Health Cess', totHealth], ['IGST', totIgst, 'IGST Cess', 0], ...(totForegone > 0 ? [['Duty Foregone', totForegone, '', null]] : [])].map(([a, av, b, bv]) => (
          <tr key={a}><td style={td}>{a}</td><td style={tdr}>Rs.</td><td style={tdr}>{n2(av)}</td><td /><td style={td}>{b}</td><td style={tdr}>{bv === null ? '' : 'Rs.'}</td><td style={tdr}>{bv === null ? '' : n2(bv)}</td></tr>
        ))}
        <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000' }}><td style={{ ...td, ...B }} colSpan="5">Duty Payable Rupees {inWords(totDuty)} Only</td><td style={{ ...tdr, ...B }}>Rs.</td><td style={{ ...tdr, ...B }}>{Math.round(totDuty)}</td></tr>
      </tbody></table>

      {/* ---- IGST duty details (sbedutyModel) ---- */}
      {duties.length > 0 && (<div className="avoid">
        {sec('IGST Duty Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([5, 5, 6, 5, 6, 13, 7, 11, 8, 11, 7, 8, 8])}<thead><tr style={dash}>{[['Inv No'], ['Itm No'], ['Duty Type'], ['Flg'], ['IGST Flg'], ['IGST Notn No & Slno'], ['IGST Rate', 1], ['IGST Amt', 1], ['IGST Amts & Uqc', 1], ['Exmp Notn No & Slno'], ['Exmp Rate', 1], ['Exmp Amt', 1], ['Exmp Amt & Uqc', 1]].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr></thead>
          <tbody>{duties.map((d, i) => {
            const it = its.find(x => x.invoiceSerialNumber === d.invoiceSerialNumber && x.itemSerialNumber === d.itemSerialNumber);
            const igRow = d.dutyType === 'G' && d.addlDutyFlag === 'I';
            const rate = igRow && it ? obj(screenItem(it).igstData).rate : 0;
            const amtv = igRow && it ? dutyOf(it).igst : 0;
            return <tr key={i}><td style={td}>{d.invoiceSerialNumber}</td><td style={td}>{d.itemSerialNumber}</td><td style={td}>{d.dutyType}</td><td style={td}>{d.addlDutyFlag}</td><td style={td}>{d.customsNotnExemptingIgstFlag}</td>
              <td style={td}>{[d.notificationNo, d.notificationSrNo].filter(Boolean).join(' ')}</td><td style={tdr}>{n2(rate)}</td><td style={tdr}>{n2(amtv)}</td><td style={tdr}>0.00</td><td style={td}>{[d.exmpNotificationNo, d.exmpNotificationSrNo].filter(Boolean).join(' ')}</td><td style={tdr}>0.00</td><td style={tdr}>0.00</td><td style={tdr}>0.00</td></tr>;
          })}</tbody></table></div>)}

      {/* ---- certificate / bond / licence ---- */}
      {(m.certModel || []).length > 0 && (<div className="avoid">{sec('Certificate Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([40, 25, 35])}<tbody><tr style={dash}><th style={th}>Certificate No</th><th style={th}>Certificate Date</th><th style={th}>Certificate Type</th></tr>
          {(m.certModel || []).map((c, i) => <tr key={i}><td style={td}>{c.certificateNumber}</td><td style={td}>{dmy(c.certificationDate)}</td><td style={td}>{c.certificationType}</td></tr>)}</tbody></table></div>)}
      {(m.bondModel || []).length > 0 && (<div className="avoid">{sec('Bond Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([40, 25, 35])}<tbody><tr style={dash}><th style={th}>Bond No</th><th style={th}>Bond Code</th><th style={th}>Bond Port</th></tr>
          {(m.bondModel || []).map((c, i) => <tr key={i}><td style={td}>{c.bondNumber}</td><td style={td}>{c.bondCode}</td><td style={td}>{c.bondPort}</td></tr>)}</tbody></table></div>)}
      {(m.licenseModel || []).length > 0 && (<div className="avoid">{sec('Licence Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([10, 18, 12, 8, 12, 8, 16, 16])}<tbody><tr style={dash}>{[['Inv/Itm'], ['Licence No'], ['Date'], ['Code'], ['Port'], ['Lic Sr'], ['Debit Value', 1], ['Debit Qty', 1]].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr>
          {(m.licenseModel || []).map((l, i) => <tr key={i}><td style={td}>{l.invoiceSerialNumber} / {l.itemSerialNumberInvoice}</td><td style={td}>{l.licenseRegistrationNumber}</td><td style={td}>{dmy(l.licenseRegistrationDate)}</td><td style={td}>{l.licenseCode}</td><td style={td}>{l.licenseRegnPort}</td><td style={td}>{l.itemSrNoLicense}</td><td style={tdr}>{l.debitValue}</td><td style={tdr}>{l.debitQuantity} {l.debitUnitOfMeasurement}</td></tr>)}</tbody></table></div>)}

      {/* ---- single window ---- */}
      {(m.infoTypeModel || []).length > 0 && (<div className="avoid">{sec('Single Window Info')}
        <table style={{ tableLayout: 'fixed' }}>{cols([12, 25, 10, 9, 19, 17, 8])}<tbody><tr style={dash}>{[['Inv/Itm No'], ['Type'], ['Qualifier'], ['Code'], ['Text'], ['Measurement', 1], ['Unit']].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr>
          {(m.infoTypeModel || []).map((r, i) => <tr key={i}><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td><td style={td}>{r.infoType}{r.infoType === 'CHR' ? ' - Item Characteristics' : r.infoType === 'ORC' ? ' - Origin Criteria' : ''}</td>
            <td style={td}>{r.infoQualifier}</td><td style={td}>{r.infoCode}</td><td style={td}>{r.infoText}</td><td style={tdr}>{r.infoMsr}</td><td style={{ ...td, paddingLeft: '8px' }}>{r.infoUqc}</td></tr>)}</tbody></table></div>)}
      {(m.ctrlModel || []).length > 0 && (<div className="avoid">{sec('Single Window Control')}
        <table style={{ tableLayout: 'fixed' }}>{cols([12, 10, 14, 11, 11, 12, 30])}<tbody><tr style={dash}>{['Inv/Itm No', 'Type', 'Location', 'Start Dt', 'End Dt', 'Result Code', 'Result Text'].map(x => <th key={x} style={th}>{x}</th>)}</tr>
          {(m.ctrlModel || []).map((r, i) => <tr key={i}><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td><td style={td}>{r.controlTypeCode}</td><td style={td}>{r.controlLocation}</td><td style={td}>{dmy(r.controlStartDate)}</td><td style={td}>{dmy(r.controlEndDate)}</td><td style={td}>{r.controlResultCode}</td><td style={td}>{r.controlResultText}</td></tr>)}</tbody></table></div>)}
      {(m.sw_ConstModel || []).length > 0 && (<div className="avoid">{sec('Single Window Constituent')}
        <table style={{ tableLayout: 'fixed' }}>{cols([12, 8, 34, 16, 10, 10, 10])}<tbody><tr style={dash}>{[['Inv/Itm No'], ['Sr'], ['Element Name'], ['Code'], ['%', 1], ['Yield %', 1], ['Active']].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr>
          {(m.sw_ConstModel || []).map((r, i) => <tr key={i}><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td><td style={td}>{r.constituentSrNo}</td><td style={td}>{r.constituentElementName}</td><td style={td}>{r.constituentElementCode}</td><td style={tdr}>{r.constituentPercentage}</td><td style={tdr}>{r.constituentYieldPercentage}</td><td style={{ ...td, paddingLeft: '8px' }}>{r.activeIngredientFlag}</td></tr>)}</tbody></table></div>)}
      {(m.sw_ProdModel || []).length > 0 && (<div className="avoid">{sec('Single Window Production (Batch)')}
        <table style={{ tableLayout: 'fixed' }}>{cols([12, 24, 16, 8, 13, 13, 14])}<tbody><tr style={dash}>{[['Inv/Itm No'], ['Batch Id'], ['Batch Qty', 1], ['UQC'], ['Mfg Date'], ['Expiry'], ['Best Before']].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr>
          {(m.sw_ProdModel || []).map((r, i) => <tr key={i}><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td><td style={td}>{r.productionBatchIdentifier}</td><td style={tdr}>{r.productionBatchQuantity}</td><td style={{ ...td, paddingLeft: '8px' }}>{r.unitQuantityCode}</td><td style={td}>{dmy(r.dateOfManufacturing)}</td><td style={td}>{dmy(r.dateOfExpiry)}</td><td style={td}>{dmy(r.bestBefore)}</td></tr>)}</tbody></table></div>)}
      {(m.statementModel || []).length > 0 && (<div className="avoid">{sec('Single Window Statement')}
        <table style={{ tableLayout: 'fixed' }}>{cols([15, 15, 25, 45])}<tbody><tr style={dash}>{['Inv/Itm No', 'Statement For', 'Statement Type', 'Statement Code'].map(x => <th key={x} style={th}>{x}</th>)}</tr>
          {(m.statementModel || []).map((r, i) => <tr key={i}><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td>
            <td style={td}>{String(r.invoiceSerialNumber) === '0' ? 'M' : String(r.itemSerialNumber) === '0' ? 'N' : 'I'}</td>
            <td style={td}>{r.statementType}{({ DEC: ' - DECLARATION', UTG: ' - UNDERTAKING', REM: ' - REMARK' })[r.statementType] || ''}</td><td style={td}>{r.statementCode}{r.statementText ? ' - ' + r.statementText : ''}</td></tr>)}</tbody></table></div>)}

      {(m.supportingDocsModel || []).length > 0 && (<div>{sec('Single Window Supporting Document')}
        <table style={{ tableLayout: 'fixed' }}>{cols([8, 9, 17, 12, 15, 7, 10, 12, 10])}<tbody><tr style={dash}>{['Inv/Itm', 'Doc For', 'Doc No', 'Doc Type', 'Issued Party', 'Place', 'Issue Dt', 'Bnf Party', 'ICEGate Id'].map(x => <th key={x} style={th}>{x}</th>)}</tr>
          {(m.supportingDocsModel || []).map((r, i) => <tr key={i} className="avoid"><td style={td}>{r.invoiceSerialNumber} / {r.itemSerialNumber}</td>
            <td style={td}>{String(r.invoiceSerialNumber) === '0' ? 'BE' : String(r.itemSerialNumber) === '0' ? 'INVOICE' : 'ITEM'}</td>
            <td style={{ ...td, wordBreak: 'break-all' }}>{r.imageReferenceNo}</td><td style={td}>{r.documentTypeCode}<br />{docTypeName(r.documentTypeCode)}</td>
            <td style={td}>{[r.documentIssuingPartyName, r.documentIssuingPartyNameAddress1, r.documentIssuingPartyNameAddress2, r.documentIssuingPartyNameCity].filter(x => x && x !== ',').join(' ')}</td>
            <td style={td}>{r.placeOfIssue}</td><td style={td}>{dmy(r.documentIssueDate)}</td>
            <td style={td}>{[r.documentBeneficiaryPartyName, r.documentBeneficiaryPartyNameAddress1, r.documentBeneficiaryPartyNameAddress2, r.documentBeneficiaryPartyNameCity, r.documentBeneficiaryPartyPin].filter(Boolean).join(' ')}</td>
            <td style={{ ...td, wordBreak: 'break-all' }}>{r.icegateUserId}</td></tr>)}</tbody></table></div>)}

      {/* ---- GSTIN / totals ---- */}
      <div className="avoid">
        {sec('GSTIN Details')}
        <table style={{ tableLayout: 'fixed' }}>{cols([22, 8, 8, 16, 16, 15, 15])}<tbody><tr style={dash}>{[['Document No'], ['Type'], ['State'], ['Cd/Name'], ['IGST Ass. Val', 1], ['IGST Amt.', 1], ['GST Cess Amt', 1]].map(([x, r]) => <th key={x} style={r ? thr : th}>{x}</th>)}</tr>
          <tr><td style={td}>{ctx.commercialTaxRegistrationNo}</td><td style={td}>{ctx.commercialTaxType}</td><td style={td}>{ctx.stateCode}</td><td style={td}>{stateName(ctx.stateCode)}</td>
            <td style={tdr}>{Math.round(totAv + totBcd + totSws + totHealth + totAdd + totOther)}</td><td style={tdr}>{Math.round(totIgst)}</td><td style={tdr}>0</td></tr></tbody></table>
        <div style={{ ...B, marginTop: '6px', ...dash }}>Total Freight / Misc / Insurance Details</div>
        <table style={{ tableLayout: 'fixed' }}>{cols([33, 34, 33])}<tbody><tr><th style={{ ...th, textAlign: 'center' }}>Total Freight</th><th style={{ ...th, textAlign: 'center' }}>Total Misc</th><th style={{ ...th, textAlign: 'center' }}>Total Insurance</th></tr>
          <tr><td style={{ ...td, textAlign: 'center' }}>{n2(totFrt)}</td><td style={{ ...td, textAlign: 'center' }}>{n2(totMisc)}</td><td style={{ ...td, textAlign: 'center' }}>{n2(totIns)}</td></tr></tbody></table>
        <table style={{ tableLayout: 'fixed', borderTop: '1px solid #000', marginTop: '4px' }}>{cols([50, 32, 18])}<tbody>
          {Object.entries(invs.reduce((acc, iv) => { acc[iv.invoiceCurrency] = (acc[iv.invoiceCurrency] || 0) + (parseFloat(iv.invoiceValue) || 0); return acc; }, {})).map(([c, v], i) => (
            <tr key={c}><td style={{ ...td, ...B }}>{i === 0 ? 'Grand Total' : ''}</td><td style={{ ...tdr, ...B }}>{n2(v)}</td><td style={{ ...td, ...B }}>{c}</td></tr>))}
        </tbody></table>
        <table style={{ marginTop: '14px' }}><tbody><tr><td style={td}>I/We declare that the particulars given herein are true and are correct</td><td style={tdr}>Signature of Importer/CHA With Date</td></tr></tbody></table>
        <div className="no-print" style={{ marginTop: '10px', fontSize: '8pt', color: '#64748b' }}>Prepared By : {user} &nbsp; | &nbsp; {printedAt} &nbsp; | &nbsp; Duty amounts are an estimate; ICEGATE assesses the final duty.</div>
      </div>
    </div>
  );
}
