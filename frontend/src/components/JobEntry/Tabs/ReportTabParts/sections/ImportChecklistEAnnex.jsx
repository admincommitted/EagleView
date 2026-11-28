// Import BE checklist in the "E-Annex" layout used by the CHA (same blocks and order as the checklist PDFs the user
// shared). Built from the CACHI01 JSON the job will send (POST /icegate/preview-be), so the checklist shows exactly
// what goes to ICEGATE; duty figures are our estimate (computeItemDuty).
import { Fragment, useCallback, useEffect, useState } from 'react';
import { computeItemDuty } from '../../ItemGridTabParts/helpers';
import { jobEntryApi } from '@/components/JobEntry/jobEntryApi';
import { errorMessage } from '@/services/axiosInstance';
import { cn } from '@/lib/utils';
import { cellSpecOf, parseJsonObject } from './reportFormat';
import { ColumnWidths, ReportBody, ReportCell, ReportHeadCell, ReportNote, ReportPage, ReportRow, ReportTable, ReportTableHeader } from '../reportTable';

const fixed = (value, decimals = 2) => {
  const number = parseFloat(String(value ?? '').replace(/,/g, ''));
  return isNaN(number) ? (0).toFixed(decimals) : number.toFixed(decimals);
};
const toDmy = (value) => {
  const text = String(value || '').trim();
  let match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (match) return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
  return text;
};
const yesNo = (value) => (String(value || '').toUpperCase() === 'Y' ? 'Yes' : 'No');
const joinNotification = (number, serial) => [number, serial].filter(Boolean).join(' ');
const textOf = (value) => value ?? '';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigitWords = (number) => (number < 20 ? ONES[number] : TENS[Math.floor(number / 10)] + (number % 10 ? ' ' + ONES[number % 10] : ''));
const threeDigitWords = (number) => (number >= 100 ? ONES[Math.floor(number / 100)] + ' Hundred' + (number % 100 ? ' ' + twoDigitWords(number % 100) : '') : twoDigitWords(number));

// rupees in words (Indian system)
function inWords(amount) {
  let rest = Math.round(amount || 0);
  if (!rest) return 'Zero';
  const crore = Math.floor(rest / 10000000); rest %= 10000000;
  const lakh = Math.floor(rest / 100000); rest %= 100000;
  const thousand = Math.floor(rest / 1000); rest %= 1000;
  const parts = [];
  if (crore) parts.push(inWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigitWords(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigitWords(thousand) + ' Thousand');
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(' ');
}

const IMPORTER_TYPE = { P: 'Private', G: 'Government', U: 'Undertaking', O: 'Others', J: 'Jobbing' };
const NATURE = { S: 'SALE', O: 'OTHERS', C: 'CONSIGNMENT', H: 'HIRE', R: 'RENT', F: 'FREE OF COST' };
const PAY_TERMS = { OTH: 'Others', FC: 'Free of Cost', DP: 'Delivery against Payment', DA: 'Delivery against Acceptance', LC: 'Letter of Credit', AP: 'Advance Payment' };
const DOC_TYPE = { '101000': 'Registration Document', '703000': 'House waybill', '704000': 'Master air waybill', '705000': 'Bill of lading', '740000': 'Air waybill',
  '380000': 'Commercial Invoice', '271000': 'Packing list', '861000': 'Certificate of origin', '005000': 'Other Document' };
const BE_TITLE = { H: 'Bill of Entry for Home Consumption', W: 'Bill of Entry for Warehousing', X: 'Bill of Entry for Ex-Bond Clearance' };
const MODE = { A: 'Air', S: 'Sea', L: 'Land' };
const PERMISSION = { S48: 'Section 48', FCK: 'First Check', PRV: 'Provisional Assessment' };
const STATEMENT_TYPE = { DEC: ' - DECLARATION', UTG: ' - UNDERTAKING', REM: ' - REMARK' };

// header grid: label | : | value | label | : | value || label | : | value
const HEADER_GRID = [15.5, 1.5, 12, 13.5, 1.5, 11, 15.5, 1.5, 28];
// every line is the same thin solid black rule. There is no Tailwind reset, so the sides without a line are set to 0 -
// otherwise border-solid draws the browser's default 3px border on them (the "box" round the headings).
const LINE_BELOW = 'tw:border-x-0 tw:border-t-0 tw:border-b tw:border-solid tw:border-black';
const LINE_ABOVE = 'tw:border-x-0 tw:border-b-0 tw:border-t tw:border-solid tw:border-black';
const RULED_ROW = 'tw:border-x-0 tw:border-y tw:border-solid tw:border-black';

function Cell({ align, className, ...props }) {
  return <ReportCell look="plain" align={align} className={cn(align === 'right' && 'tw:pr-[6px]', className)} {...props} />;
}

function HeadCell({ align, className, ...props }) {
  return <ReportHeadCell look="plain" align={align} className={cn(align === 'right' && 'tw:pr-[6px]', className)} {...props} />;
}

const EmptyCell = (props) => <ReportCell look="bare" {...props} />;

function SectionTitle({ children }) {
  return <div className={cn('sech tw:mt-[6px] tw:text-[9.5pt] tw:font-bold tw:print:break-after-avoid', LINE_BELOW)}>{children}</div>;
}

// label, colon and value cells; span = how many grid columns the value takes
function FieldCells({ label, value, span = 1 }) {
  return (
    <>
      <Cell className="tw:overflow-hidden tw:font-bold tw:whitespace-nowrap">{label}</Cell>
      <Cell className="tw:px-0">:</Cell>
      <Cell colSpan={span}>{value}</Cell>
    </>
  );
}

function TextLine({ label, text }) {
  return <ReportRow><Cell className="tw:font-bold">{label}</Cell><Cell colSpan={6}>{text}</Cell></ReportRow>;
}

function DutyLine({ label, notification, rate, amount }) {
  return (
    <ReportRow>
      <Cell className="tw:font-bold" colSpan={4}>{label}</Cell>
      <Cell>{notification}</Cell>
      <Cell align="right">{fixed(rate)} %</Cell>
      <Cell align="right">{fixed(amount)}</Cell>
    </ReportRow>
  );
}

// a list block: a ruled heading row, then one row per record; cells are values or { value, className }
function ChecklistList({ widths, columns, rightAligned = [], rows, headInThead = false, rowClassName }) {
  const alignOf = (column) => (rightAligned.includes(column) ? 'right' : undefined);
  const headRow = (
    <ReportRow className={LINE_BELOW}>
      {columns.map((column) => <HeadCell key={column} align={alignOf(column)}>{column}</HeadCell>)}
    </ReportRow>
  );
  const bodyRows = rows.map((cells, rowIndex) => (
    <ReportRow key={rowIndex} className={rowClassName}>
      {cells.map((cell, cellIndex) => {
        const spec = cellSpecOf(cell);
        return <Cell key={cellIndex} align={alignOf(columns[cellIndex])} className={spec.className}>{spec.value}</Cell>;
      })}
    </ReportRow>
  ));
  return (
    <ReportTable className="tw:table-fixed">
      <ColumnWidths widths={widths} />
      {headInThead
        ? <><ReportTableHeader>{headRow}</ReportTableHeader><ReportBody>{bodyRows}</ReportBody></>
        : <ReportBody>{headRow}{bodyRows}</ReportBody>}
    </ReportTable>
  );
}

function ListSection({ title, avoidBreak = true, children }) {
  return <div className={cn(avoidBreak && 'tw:print:break-inside-avoid')}><SectionTitle>{title}</SectionTitle>{children}</div>;
}

const tokenUser = () => {
  try {
    const token = localStorage.getItem('token');
    return token ? (JSON.parse(atob(token.split('.')[1])).username || '') : '';
  } catch {
    return '';
  }
};

const printedAtText = () => {
  const now = new Date();
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
  const hour12 = now.getHours() % 12 || 12;
  const pad = (number) => String(number).padStart(2, '0');
  return `${pad(now.getDate())}-${month}-${now.getFullYear()} ${pad(hour12)}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${now.getHours() < 12 ? 'AM' : 'PM'}`;
};

export default function ImportChecklistEAnnex({ jobData, items, esanchitDocs, masters }) {
  const [checklistJson, setChecklistJson] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [cha, setCha] = useState(null);
  const [loading, setLoading] = useState(false);
  const [softwareName, setSoftwareName] = useState('EagleView 360');
  const [tariff, setTariff] = useState({});
  const [docNames, setDocNames] = useState({});
  // Docket No. under Job No / Date, as on iCAFFE's checklist - the job's own docket (loaded iCAFFE jobs)
  // or the docket made with Register Shipment (Shipments.ediJobNo = job no)
  const [shipDocket, setShipDocket] = useState('');

  useEffect(() => {
    const jobNo = String(jobData?.jobNo || '').trim();
    setShipDocket('');
    if (String(jobData?.docketNo || '').trim() || !jobNo || /^draft$/i.test(jobNo)) return undefined;
    let live = true;
    (async () => {
      try {
        const shipment = await jobEntryApi.shipmentByJob(jobNo);
        if (live && shipment && shipment.docketNo) setShipDocket(shipment.docketNo);
      } catch { /* no shipment registered for this job */ }
    })();
    return () => { live = false; };
  }, [jobData?.jobNo, jobData?.docketNo]);
  const docketNo = String(jobData?.docketNo || '').trim() || shipDocket;

  // e-Sanchit document type names from the e-Sanchit master (the short DOC_TYPE list is the fallback);
  // active codes are read last so their names win
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const payload = await jobEntryApi.esanchitMasters();
        const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
        const names = {};
        [...rows.filter((row) => row && row.isActive === false), ...rows.filter((row) => row && row.isActive !== false)].forEach((row) => {
          const code = String(row.documentCode || '').trim();
          if (code && row.description) names[code] = String(row.description).trim();
        });
        if (live) setDocNames(names);
      } catch { /* names stay from the short list */ }
    })();
    return () => { live = false; };
  }, []);
  const docTypeName = (code) => docNames[String(code || '').trim()] || DOC_TYPE[code] || '';

  const beType = ({ WAREHOUSE: 'W', EX_BOND: 'X' })[String(jobData?.boeType || '').toUpperCase()] || String(jobData?.autoField_51 || 'H').charAt(0).toUpperCase() || 'H';
  const mode = ({ AIR: 'A', SEA: 'S', LAND: 'L' })[String(jobData?.shipmentMode || '').toUpperCase()] || String(jobData?.autoField_52 || 'A').charAt(0).toUpperCase();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await jobEntryApi.previewBe({
        jobData: { ...jobData, esanchitDocs: esanchitDocs || [] }, items, invoices: jobData?.invoices || [], beType, transportMode: mode,
      });
      if (result && result.success) setChecklistJson(result.cachi01);
      else setLoadError((result && result.error) || 'Could not build the checklist');
    } catch (error) {
      setLoadError(errorMessage(error));
    }
    setLoading(false);
  }, [jobData, items, esanchitDocs, beType, mode]);

  // each preview builds the whole BE and takes a sequence number, so it runs a moment after typing stops
  useEffect(() => {
    const timer = setTimeout(load, 600);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const settings = await jobEntryApi.appSettings();
        if (settings && settings.software_name) setSoftwareName(settings.software_name);
      } catch { /* keep the default name */ }
    })();
  }, []);

  // items without a BCD / IGST rate (e.g. a BE read from a JSON file): take the rate from the Tariff master for the estimate
  useEffect(() => {
    const ritcs = [...new Set((checklistJson?.master?.itemsModel || []).map((item) => item.ritcCode).filter(Boolean))].filter((ritc) => !(ritc in tariff));
    if (!ritcs.length) return;
    (async () => {
      const lines = await Promise.all(ritcs.map(async (ritc) => {
        try {
          const result = await jobEntryApi.tariffLine(ritc);
          return [ritc, result && result.success ? result.data : null];
        } catch {
          return [ritc, null];
        }
      }));
      setTariff((previous) => ({ ...previous, ...Object.fromEntries(lines) }));
    })();
  }, [checklistJson, tariff]);

  // CHA picked in Job Header ("NAME - CODE" or just the code) -> CHA Master row; if the job has none, the default CHA
  // of Settings > CHA Master. If the code is not in the master, the name typed in the header is used.
  useEffect(() => {
    (async () => {
      try {
        const payload = await jobEntryApi.chaMaster();
        const all = (payload && payload.data) || (Array.isArray(payload) ? payload : []);
        const raw = String(jobData?.chaCode || jobData?.autoField_3 || '').trim();
        const cut = raw.lastIndexOf(' - ');
        const code = (cut >= 0 ? raw.slice(cut + 3) : raw).trim().toUpperCase();
        const match = code && all.find((row) => String(row.chaCode || '').toUpperCase() === code || String(row.chaLicense || '').toUpperCase() === code);
        if (match) setCha(match);
        else if (code) setCha({ chaCode: code, chaName: cut >= 0 ? raw.slice(0, cut).trim() : '', chaAddress: '', chaCity: '', chaPin: '' });
        else setCha(all.find((row) => row.isDefault) || null);
      } catch { /* CHA block stays empty */ }
    })();
  }, [jobData?.chaCode, jobData?.autoField_3]);

  if (loadError) return <div className="tw:p-4 tw:text-[#dc2626]">Checklist: {loadError}</div>;
  if (!checklistJson) return <div className="tw:p-4 tw:text-[#64748b]">{loading ? 'Preparing checklist...' : ''}</div>;

  const master = checklistJson.master || {};
  const header = checklistJson.headerField || {};
  const be = (master.beModel || [])[0] || {};
  const igm = (master.igmsModel || [])[0] || {};
  const taxDetails = (master.ctxModel || [])[0] || {};
  // a job without invoices gets one empty invoice row in the JSON (schema needs one) - not printed
  const invoices = (master.invoiceModel || []).filter((invoice) => invoice.actualInvoiceNumber || parseFloat(invoice.invoiceValue));
  const jsonItems = master.itemsModel || [];
  const dutyModelRows = master.sbedutyModel || [];
  const exchangeRates = master.exchangeModel || [];
  const screenInvoices = jobData?.invoices || [];

  const country = (code) => {
    const match = (masters?.countries || []).find((row) => String(row.code).toUpperCase() === String(code || '').toUpperCase());
    return match ? String(match.name).toUpperCase() : (code || '');
  };
  // a foreign port / airport is not in the (Indian) port master: the name picked on the Job Header (Origin / Shipment
  // Port) is used for that code, as iCAFFE prints the name (BANGKOK), not the code (THBKK)
  const portHint = {};
  [[jobData?.portOfShipment, jobData?.portOfShipmentName], [jobData?.portOfOrigin || jobData?.autoField_22, jobData?.portOfOriginName]].forEach(([code, name]) => {
    if (code && name && String(name).trim()) portHint[String(code).toUpperCase()] = String(name).trim().toUpperCase();
  });
  const portName = (code) => {
    const match = (masters?.ports || []).find((row) => String(row.portCode).toUpperCase() === String(code || '').toUpperCase());
    return match ? String(match.portName).toUpperCase() : (portHint[String(code || '').toUpperCase()] || code || '');
  };
  const stateName = (code) => {
    const match = (masters?.states || []).find((row) => String(row.taxCode) === String(code));
    return match ? String(match.stateName).toUpperCase() : '';
  };

  // the invoices' freight / misc / insurance added up in rupees (amount x exchange rate, or % of the invoice value)
  const exchangeOf = (currency) => {
    const code = String(currency || '').toUpperCase();
    if (!code || code === 'INR') return 1;
    const rate = exchangeRates.find((row) => row.currencyCode === code);
    return rate ? (parseFloat(rate.rate) || 0) / (parseFloat(rate.unitInRs) || 1) : 0;
  };
  const chargeInr = (invoice, amount, currency, percent) => {
    const value = parseFloat(amount) || 0;
    const rate = parseFloat(percent) || 0;
    if (value) return value * exchangeOf(currency || invoice.invoiceCurrency);
    return rate ? rate / 100 * (parseFloat(invoice.invoiceValue) || 0) * exchangeOf(invoice.invoiceCurrency) : 0;
  };
  const sumCharges = (pick) => (master.invoiceModel || []).reduce((sum, invoice) => sum + pick(invoice), 0);
  const totalFreight = sumCharges((invoice) => chargeInr(invoice, invoice.freightValue, invoice.freightCurrency, invoice.freightRate));
  const totalInsurance = sumCharges((invoice) => chargeInr(invoice, invoice.insuranceValue, invoice.insuranceCurrency, invoice.insuranceRate));
  const totalMisc = sumCharges((invoice) => chargeInr(invoice, invoice.miscCharges, invoice.miscCurrency, invoice.miscChargesRate));
  const rateLine = (currency) => {
    const rate = exchangeRates.find((row) => row.currencyCode === currency);
    if (rate) return `${fixed(rate.unitInRs)} ${currency} = ${fixed(rate.rate, 4)} INR`;
    return currency === 'INR' ? '1.00 INR = 1.0000 INR' : `${currency} rate missing`;
  };
  const user = tokenUser();
  const printedAt = printedAtText();

  // screen item for each JSON item (duty rates live on the screen item)
  const rateNotes = [];
  const itemTag = (item) => `Item ${item.invoiceSerialNumber}/${item.itemSerialNumber} (${item.ritcCode})`;
  const screenItem = (item) => {
    const screen = (items || []).find((row) => String(row.invSrNo || row.invoiceSrNo || 1) === String(item.invoiceSerialNumber) && String(row.itemSrNo || row.itemNo) === String(item.itemSerialNumber)) || {};
    const tariffLine = tariff[item.ritcCode];
    const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';
    const igst = parseJsonObject(screen.igstData);
    const out = { ...screen };
    const tag = itemTag(item);
    // a nearest-heading line of the master (exact:false) is never used as the item's rate
    const exactLine = tariffLine && tariffLine.exact !== false ? tariffLine : null;
    const nearNote = tariffLine && tariffLine.exact === false ? ` (master has only the nearest line ${tariffLine.matchedCode || tariffLine.ritc} - not used)` : '';
    if (!has(screen.bcdRate)) {
      if (item.bcdNotification) rateNotes.push(`${tag}: BCD rate not entered (notification ${item.bcdNotification} ${item.bcdNotificationSrNo || ''}) - BCD taken as 0`);
      else if (exactLine && exactLine.bcdRate != null) {
        out.bcdRate = String(exactLine.bcdRate);
        rateNotes.push(`${tag}: BCD ${exactLine.bcdRate}% from Tariff master`);
      } else rateNotes.push(`${tag}: BCD rate missing${nearNote}`);
    }
    if (!has(igst.rate)) {
      if (exactLine && exactLine.igstRate != null) {
        out.igstData = { ...igst, rate: String(exactLine.igstRate) };
        rateNotes.push(`${tag}: IGST ${exactLine.igstRate}% from Tariff master`);
      } else rateNotes.push(`${tag}: IGST rate missing${nearNote}`);
    }
    // a specific (per-unit) rate of the master ("x% or Rs y per kg, whichever is higher"); a master line with Rs 0 is no specific rate
    if (!has(screen.bcdSpecAmount) && exactLine && exactLine.bcd && parseFloat(exactLine.bcd.amount) > 0) {
      out.bcdSpecAmount = String(exactLine.bcd.amount);
      if (!has(screen.bcdUnit) && exactLine.bcd.uqc) out.bcdUnit = String(exactLine.bcd.uqc).toUpperCase();
      if (!has(screen.bcdRateBasis) && exactLine.bcd.basis) out.bcdRateBasis = String(exactLine.bcd.basis);
      rateNotes.push(`${tag}: BCD also Rs ${exactLine.bcd.amount} per ${String(exactLine.bcd.uqc || '').toUpperCase()} from Tariff master`);
    }
    return out;
  };
  const dutyRows = jsonItems.map((item) => {
    const screen = screenItem(item);
    return { item, screen, duty: computeItemDuty(screen, screenInvoices, jobData || {}) };
  });
  const dutyOf = (item) => {
    const row = dutyRows.find((dutyRow) => dutyRow.item === item);
    return row ? row.duty : computeItemDuty(screenItem(item), screenInvoices, jobData || {});
  };
  const dutyModelRowsOf = (item, type, flag) => dutyModelRows.filter((row) => row.invoiceSerialNumber === item.invoiceSerialNumber && row.itemSerialNumber === item.itemSerialNumber && row.dutyType === type && row.addlDutyFlag === flag);
  // which side of a two-rate BCD line the estimate used, and when the specific side could not be worked out
  dutyRows.forEach(({ item, duty }) => {
    const basis = duty.bcdBasis;
    if (!basis) return;
    const tag = itemTag(item);
    if (basis.needQty) rateNotes.push(`${tag}: BCD has a rate per ${basis.uqc} but the item quantity is in another unit - only the % is applied, enter "Qty in duty unit"`);
    else if (basis.adv !== null && basis.spec !== null) rateNotes.push(`${tag}: BCD ${basis.applied === 'S' ? 'Rs ' + basis.spec.toFixed(2) + ' at the specific rate' : 'Rs ' + basis.adv.toFixed(2) + ' by rate'} applied (the other side came to Rs ${(basis.applied === 'S' ? basis.adv : basis.spec).toFixed(2)})`);
    else if (basis.spec !== null) rateNotes.push(`${tag}: BCD is a specific rate - Rs ${basis.spec.toFixed(2)} on ${basis.units} ${basis.uqc}`);
  });
  const notes = [...new Set(rateNotes)];
  const sum = (field) => dutyRows.reduce((total, row) => total + (row.duty[field] || 0), 0);
  const totAv = sum('av'), totBcd = sum('bcd'), totSws = sum('sws'), totIgst = sum('igst'), totHealth = sum('health'), totAdd = sum('add'), totOther = sum('other');
  const totCvd = sum('cvd') + sum('adlCvd') + sum('sapta'), totCess = sum('compCess');
  // every duty line of the estimate; the gross total is printed to the paisa (as iCAFFE), only the duty payable is
  // rounded to the rupee like ICES
  const totGross = Math.round((totBcd + totSws + totIgst + totHealth + totAdd + totOther + totCvd + totCess) * 100) / 100;
  // duty foregone (licence / scrip debit, EOU) is in the gross total but not payable - as iCAFFE's checklist
  const totForegone = sum('foregone');
  const totDuty = Math.round(totGross - totForegone);
  const notionalNote = dutyRows.some((row) => row.duty.notional && (row.duty.notional.insurance || row.duty.notional.freight || row.duty.notional.freightCapped))
    ? 'Estimate uses ICES notional charges: ' + [...new Set(dutyRows.flatMap((row) => [
      row.duty.notional?.insurance && 'insurance 1.125 % of FOB (none given)',
      row.duty.notional?.freight && 'freight 20 % of FOB (none given)',
      row.duty.notional?.freightCapped && 'air freight capped at 20 % of FOB',
    ].filter(Boolean)))].join('; ')
    : '';
  if (notionalNote) notes.push(notionalNote);
  // our Job No (Query / header). Not the ICEGATE "jobNumber", which is only a running number (a time-based one for an unsaved job)
  const jobNoText = jobData?.jobNo && jobData.jobNo !== 'DRAFT' ? jobData.jobNo : 'DRAFT';
  const pan = String(taxDetails.commercialTaxRegistrationNo || '').length === 15 ? String(taxDetails.commercialTaxRegistrationNo).slice(2, 12) : '';
  const miscRows = (invoice) => (master.misc_chModel || []).filter((row) => String(row.invoiceSerialNumber) === String(invoice.invoiceSerialNumber));
  const conditionsOf = (invoice) => [1, 2, 3, 4, 5].map((index) => invoice['conditionsAttachedWithSale' + index]).filter(Boolean).join('; ');
  const svbText = (row) => [
    row.svbReferenceNumber ? `Ref ${row.svbReferenceNumber}` : '',
    row.svbReferenceDate ? `Dt. ${toDmy(row.svbReferenceDate)}` : '',
    row.customHouseCodeWhichHasImposedLoad ? `CH ${row.customHouseCodeWhichHasImposedLoad}` : '',
    row.svbLoadAssessableValue ? `Load on AV ${fixed(row.svbLoadAssessableValue)} % (${row.whetherloadProvisionalOnAssValue || row.whetherLoadProvisionalOnAssessableValue || ''})` : '',
    row.svbLoadOnDuty ? `Load on duty ${fixed(row.svbLoadOnDuty)} % (${row.whetherProvisionalOnDuty || row.whetherLoadProvisionalOnDuty || ''})` : '',
    row.svbFlag ? `Flag ${row.svbFlag}` : '',
  ].filter(Boolean).join(', ');
  const rowsForItem = (list) => (item) => (list || []).filter((row) => String(row.invoiceSerialNumber) === String(item.invoiceSerialNumber) && String(row.itemSerialNumberInvoice || row.itemSerialNumber) === String(item.itemSerialNumber));
  const reimportOf = rowsForItem(master.reimportModel), rspOf = rowsForItem(master.rspModel), depbOf = rowsForItem(master.depbModel);
  const invItem = (row) => `${textOf(row.invoiceSerialNumber)} / ${textOf(row.itemSerialNumber)}`;
  const isAir = MODE[be.modeOfTransport] === 'Air';
  const reportingPort = () => {
    if (!igm.gatewayPortCode) return '';
    const name = portName(igm.gatewayPortCode);
    return name && name !== igm.gatewayPortCode ? name + ' (' + igm.gatewayPortCode + ')' : igm.gatewayPortCode;
  };
  const countryText = (name) => (String(name || '').length <= 3 ? country(name) : name);
  const currencyTotals = Object.entries(invoices.reduce((totals, invoice) => {
    totals[invoice.invoiceCurrency] = (totals[invoice.invoiceCurrency] || 0) + (parseFloat(invoice.invoiceValue) || 0);
    return totals;
  }, {}));
  const totalLines = [
    ['BCD', totBcd, 'SWS Duty', totSws], ['Safeguard Duty', 0, 'CESS', 0], ['Antidumping Duty', totAdd, 'Customs Educational Cess', 0],
    ['NCD Customs', 0, 'Secondary Custom Edu. Cess', 0], ['CVD', 0, 'Additional Duty(Imports)', totOther], ['AIDC Duty', 0, 'Custom Health Cess', totHealth],
    ['IGST', totIgst, 'IGST Cess', 0], ...(totForegone > 0 ? [['Duty Foregone', totForegone, '', null]] : []),
  ];

  return (
    <ReportPage className="eannex tw:text-[8.5pt] tw:leading-[1.2]">
      <style>{`
        @media print {
          @page { size: 210mm 305mm; margin: 12mm 10mm 14mm 10mm;
            @bottom-left { content: "${printedAt}"; font: 8pt Helvetica, Arial, sans-serif; }
            @bottom-center { content: "Prepared By : ${String(user).replace(/"/g, '')}"; font: 8pt Helvetica, Arial, sans-serif; }
            @bottom-right { content: "Page " counter(page) " Of " counter(pages); font: 8pt Helvetica, Arial, sans-serif; } }
          .eannex .sech + [data-slot="table-container"] tr:nth-child(-n+2) { break-before: avoid; }
        }
      `}</style>

      {notes.length > 0 && (
        <ReportNote className="tw:mb-[8px] tw:rounded-[4px] tw:px-[10px] tw:py-[6px] tw:text-[8.5pt]">
          <b>Duty rates - please check (not printed):</b>
          <ul className="tw:mt-[4px] tw:mr-0 tw:mb-0 tw:ml-[16px] tw:p-0">
            {notes.slice(0, 12).map((note, index) => <li key={index}>{note}</li>)}
            {notes.length > 12 && <li>...and {notes.length - 12} more</li>}
          </ul>
          Enter the rates in 4. Items (IGST popup / BCD rate) or use &quot;Fetch Item&quot;.
        </ReportNote>
      )}

      <div className="tw:text-center tw:text-[10pt] tw:font-bold">
        <div>{softwareName}</div>
        <div>{cha ? String(cha.chaName).toUpperCase() : ''}</div>
        <div>CHA : {(cha && cha.chaCode) || be.chaCode}</div>
        <div>{BE_TITLE[be.beType] || BE_TITLE.H}</div>
      </div>

      {/* job / importer: one fixed 9-column grid so every label, colon and value lines up */}
      <ReportTable className="tw:mt-[10px] tw:table-fixed">
        <ColumnWidths widths={HEADER_GRID} />
        <ReportBody>
          <ReportRow>
            <FieldCells label="Location" span={4} value={`${portName(header.receiverID)} [ ${header.receiverID} ] [ ${MODE[be.modeOfTransport] || ''} ]`} />
            <FieldCells label="Job No / Date" value={<>{jobNoText} &nbsp;Dt. {toDmy(jobData?.jobDate || header.jobDate)}</>} />
          </ReportRow>
          <ReportRow><Cell colSpan={6} /><FieldCells label="Docket No." value={docketNo} /></ReportRow>
          <ReportRow>
            <FieldCells label="B/E No. / Date" span={4} value={jobData?.beNo ? <>{jobData.beNo} &nbsp;Dt. {toDmy(jobData.beDate)}</> : ''} />
            <FieldCells label="User Job No" value={jobData?.userJobNo || ''} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="CHA Details" span={4} value={(
              <>
                {(cha && cha.chaCode) || be.chaCode}
                {cha && <><br />{String(cha.chaName || '').toUpperCase()}<br />{String(cha.chaAddress || '').toUpperCase()} {String(cha.chaCity || '').toUpperCase()}{cha.chaPin ? ' - ' + cha.chaPin : ''}</>}
              </>
            )} />
            <FieldCells label="Importer Detail" value={(
              <>
                {be.iecCode} &nbsp;&nbsp;<b>Branch Code :</b> {be.branchSrNo}<br />
                {be.nameOfImporter}<br />{[be.address1, be.address2].filter(Boolean).join(' ')} {be.city} {be.state}{be.pin ? ' - ' + be.pin : ''}
                {pan && <><br /><b>PAN No. :</b> {pan}</>}
                {taxDetails.commercialTaxRegistrationNo && <><br /><b>GSTIN No. :</b> {taxDetails.commercialTaxRegistrationNo}</>}
              </>
            )} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="Kaccha BE" value={yesNo(be.kachchaBE)} />
            <FieldCells label="Green Channel" value={yesNo(be.greenChannelRequested)} />
            <FieldCells label="Importer Type" value={<>{IMPORTER_TYPE[be.importerType] || be.importerType} &nbsp;&nbsp;<b>AD Code :</b> {be.authorizedEconomicDealerCode}</>} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="Section 48" value={yesNo(be.section48Requested)} />
            <FieldCells label="First Check" value={yesNo(be.firstCheckRequested)} />
            <FieldCells label="Pay Mode" value={be.paymentMethodCode === 'T' ? 'TRANSACTION' : be.paymentMethodCode} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="WH B/E No." value={be.warehouseBENo} />
            <FieldCells label="WH B/E Dt." value={toDmy(be.warehouseBEDate)} />
            <FieldCells label="Prior BE" value={yesNo(be.whetherPriorBE)} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="WH Job No." value={jobData?.whJobNo || ''} />
            <FieldCells label="WH Job Dt." value="" />
            <EmptyCell colSpan={3} />
          </ReportRow>
          {(be.highSeaSaleFlag === 'Y' || be.uniqueConsignmentReferenceNo || be.warehouseCode || be.warehouseCustomSiteId) && (
            <ReportRow>
              <FieldCells label="High Sea Sale" value={yesNo(be.highSeaSaleFlag)} />
              <FieldCells label="UCR No." value={[be.uniqueConsignmentReferenceNo, be.ucrType ? `(${be.ucrType})` : ''].filter(Boolean).join(' ')} />
              <FieldCells label="WH Code / Site" value={[be.warehouseCode, be.warehouseCustomSiteId].filter(Boolean).join(' / ')} />
            </ReportRow>
          )}
          {(be.noOfPackagesReleased || be.grossWeight) && (
            <ReportRow>
              <FieldCells label="Pkgs Released" value={`${be.noOfPackagesReleased || ''} ${be.packageCode || ''}`} />
              <FieldCells label="Gross Wt." value={`${be.grossWeight ? fixed(be.grossWeight, 3) : ''} ${be.unitOfMeasurement || ''}`} />
              <FieldCells label="BE Class" value={be.beClass} />
            </ReportRow>
          )}
        </ReportBody>
      </ReportTable>
      {(master.permissionModel || []).length > 0 && (
        <ListSection title="Permission Requested">
          <ChecklistList widths={[12, 28, 60]} columns={['Code', 'Permission', 'Reason']}
            rows={master.permissionModel.map((row) => [row.permissionCode, PERMISSION[row.permissionCode] || '', row.reasonsForRequest])} />
        </ListSection>
      )}
      {(master.hssModel || []).length > 0 && (
        <ListSection title="High Sea Sale Details">
          <ChecklistList widths={[30, 14, 8, 30, 10, 8]} columns={['Seller Name', 'IEC', 'Br.', 'Address', 'Pin', 'Level']}
            rows={master.hssModel.map((row) => [row.importerName, row.iec, row.branchSrNo, [row.importerAddress1, row.importerAddress2, row.importerCity].filter(Boolean).join(' '), row.importerPin, row.precedingLevel])} />
        </ListSection>
      )}

      <SectionTitle>IGM Details</SectionTitle>
      <ReportTable className="tw:table-fixed">
        <ColumnWidths widths={HEADER_GRID} />
        <ReportBody>
          <ReportRow>
            <FieldCells label="IGM No." value={igm.igmNumber || '0'} />
            <FieldCells label="Dt." value={toDmy(igm.igmDate)} />
            <FieldCells label="Port Of Loading" value={portName(be.portOfShipment)} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="IGM Inward Date" span={4} value={toDmy(igm.inwardDate)} />
            <FieldCells label="Reporting Port" value={reportingPort()} />
          </ReportRow>
          {igm.gatewayIgmNo && (
            <ReportRow>
              <FieldCells label="Gateway IGM No." value={igm.gatewayIgmNo} />
              <FieldCells label="Dt." value={toDmy(igm.gatewayIgmDate)} />
              <FieldCells label="Port of Origin" value={portName(be.portOfOrigin)} />
            </ReportRow>
          )}
          <ReportRow>
            <FieldCells label="Country/Origin" span={4} value={country(be.countryOfOrigin)} />
            <FieldCells label="Country/Consig." value={country(be.countryOfConsignment)} />
          </ReportRow>
          {/* B/L labels for everything but air - an ICD BE goes as Land (L) and carries the B/L */}
          <ReportRow>
            <FieldCells label={isAir ? 'MAWB No.' : 'MBL No.'} value={igm.mawbNo} />
            <FieldCells label="Dt." value={toDmy(igm.mawbDate)} />
            <FieldCells label={isAir ? 'HAWB No.' : 'HBL No.'} value={<>{igm.hawbNo}{igm.hawbDate ? <> &nbsp;&nbsp;<b>Dt. :</b> {toDmy(igm.hawbDate)}</> : null}</>} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="No. Of Packages" span={4} value={`${igm.totalNoOfPackages || ''} ${igm.packageCode || ''}`} />
            <FieldCells label="Gross Weight" value={`${fixed(igm.grossWeight, 3)} ${igm.unitQuantityCode || ''}`} />
          </ReportRow>
          <ReportRow>
            <FieldCells label="Marks & No." span={7} value={[igm.marksAndNumbers1, igm.marksAndNumbers2, igm.marksAndNumbers3].filter(Boolean).join(' ')} />
          </ReportRow>
        </ReportBody>
      </ReportTable>
      {(master.containerModel || []).length > 0 && (
        <>
          <SectionTitle>Container Details</SectionTitle>
          <ChecklistList widths={[25, 25, 15, 35]} columns={['Container No.', 'Seal No.', 'FCL/LCL', 'Truck No.']}
            rows={master.containerModel.map((row) => [row.contNumber, row.sealNumber, row.lclfcl === 'F' ? 'FCL' : row.lclfcl === 'L' ? 'LCL' : row.lclfcl, row.truckNumber])} />
        </>
      )}

      {/* invoices: left and right halves each use a label / colon / value grid */}
      <SectionTitle>Invoice Details</SectionTitle>
      {invoices.map((invoice, invoiceIndex) => (
        <InvoiceBlock key={invoiceIndex} invoice={invoice} last={invoiceIndex === invoices.length - 1}
          miscRows={miscRows(invoice)} conditions={conditionsOf(invoice)} rateLine={rateLine} country={country} countryText={countryText} svbText={svbText} />
      ))}

      {/* items: fixed 7 columns; numbers right-aligned under right-aligned headings */}
      <SectionTitle>Item Details</SectionTitle>
      <ReportTable className="tw:table-fixed">
        <ColumnWidths widths={[16, 15, 12, 9, 16, 14, 18]} />
        <ReportBody>
          <ReportRow>
            <HeadCell>Sr. No.</HeadCell><HeadCell>RITC</HeadCell><HeadCell colSpan={4}>Description (Generic Description - Model)</HeadCell><HeadCell align="right">SVB Loading(A/D)</HeadCell>
          </ReportRow>
          <ReportRow className={LINE_BELOW}>
            <HeadCell>Qty<br />Unit</HeadCell>
            <HeadCell align="right">Unit Price<br />Ass Val (Rs.)</HeadCell>
            <HeadCell className="tw:pl-[8px]">CTH<br />CETH</HeadCell>
            <HeadCell>Std/Pref</HeadCell>
            <HeadCell>Cus Notn.<br />Exc Notn.</HeadCell>
            <HeadCell align="right">Cus Dty Rate<br />Exc Dty Rate</HeadCell>
            <HeadCell align="right">BCD Amt (Rs.)<br />CVD Amt (Rs.)</HeadCell>
          </ReportRow>
        </ReportBody>
        {invoices.map((invoice, invoiceIndex) => {
          const rows = dutyRows.filter((row) => row.item.invoiceSerialNumber === invoice.invoiceSerialNumber);
          const invoiceAv = rows.reduce((total, row) => total + row.duty.av, 0);
          const invoiceDuty = rows.reduce((total, row) => total + row.duty.total, 0);
          return (
            <Fragment key={invoiceIndex}>
              <ReportBody>
                <ReportRow>
                  <Cell className="tw:pt-[4px]" colSpan={7}>
                    <b>Inv Sr. No. :</b> {invoice.invoiceSerialNumber} &nbsp;&nbsp;&nbsp;&nbsp;<b>Inv No. :</b> {invoice.actualInvoiceNumber} &nbsp;&nbsp;&nbsp;&nbsp;<b>Inv Dt :</b> {toDmy(invoice.invoiceDate)}
                  </Cell>
                </ReportRow>
              </ReportBody>
              {rows.map(({ item, duty, screen }, rowIndex) => (
                <ItemRows key={rowIndex} item={item} duty={duty} screen={screen} country={country} svbText={svbText}
                  aidcRow={dutyModelRowsOf(item, 'C', 'A')[0]} igstRow={dutyModelRowsOf(item, 'G', 'I')[0]} cessRow={dutyModelRowsOf(item, 'G', 'P')[0]}
                  reimports={reimportOf(item)} rsps={rspOf(item)} depbs={depbOf(item)} />
              ))}
              <ReportBody>
                <ReportRow className={RULED_ROW}>
                  <Cell align="right" className="tw:font-bold tw:whitespace-nowrap" colSpan={2}>Rs. {fixed(invoiceAv)}</Cell>
                  <EmptyCell colSpan={3} />
                  <Cell align="right" className="tw:font-bold">Rs.</Cell>
                  <Cell align="right" className="tw:font-bold">{fixed(invoiceDuty)}</Cell>
                </ReportRow>
              </ReportBody>
            </Fragment>
          );
        })}
      </ReportTable>

      {/* totals: label | Rs. | amount on both sides */}
      <ReportTable className="tw:mt-[8px] tw:table-fixed tw:print:break-inside-avoid">
        <ColumnWidths widths={[20, 5, 18, 5, 29, 5, 18]} />
        <ReportBody>
          <ReportRow className={RULED_ROW}>
            <Cell className="tw:font-bold">Total Ass. Value</Cell><Cell align="right" className="tw:font-bold">Rs.</Cell><Cell align="right" className="tw:font-bold">{fixed(totAv)}</Cell>
            <EmptyCell />
            <Cell className="tw:font-bold">BE Gross Total</Cell><Cell align="right" className="tw:font-bold">Rs.</Cell><Cell align="right" className="tw:font-bold">{fixed(totGross)}</Cell>
          </ReportRow>
          {totalLines.map(([leftLabel, leftValue, rightLabel, rightValue]) => (
            <ReportRow key={leftLabel}>
              <Cell>{leftLabel}</Cell><Cell align="right">Rs.</Cell><Cell align="right">{fixed(leftValue)}</Cell>
              <EmptyCell />
              <Cell>{rightLabel}</Cell><Cell align="right">{rightValue === null ? '' : 'Rs.'}</Cell><Cell align="right">{rightValue === null ? '' : fixed(rightValue)}</Cell>
            </ReportRow>
          ))}
          <ReportRow className={RULED_ROW}>
            <Cell className="tw:font-bold" colSpan={5}>Duty Payable Rupees {inWords(totDuty)} Only</Cell>
            <Cell align="right" className="tw:font-bold">Rs.</Cell>
            <Cell align="right" className="tw:font-bold">{Math.round(totDuty)}</Cell>
          </ReportRow>
        </ReportBody>
      </ReportTable>

      {dutyModelRows.length > 0 && (
        <ListSection title="IGST Duty Details">
          <ChecklistList headInThead widths={[5, 5, 6, 5, 6, 13, 7, 11, 8, 11, 7, 8, 8]}
            columns={['Inv No', 'Itm No', 'Duty Type', 'Flg', 'IGST Flg', 'IGST Notn No & Slno', 'IGST Rate', 'IGST Amt', 'IGST Amts & Uqc', 'Exmp Notn No & Slno', 'Exmp Rate', 'Exmp Amt', 'Exmp Amt & Uqc']}
            rightAligned={['IGST Rate', 'IGST Amt', 'IGST Amts & Uqc', 'Exmp Rate', 'Exmp Amt', 'Exmp Amt & Uqc']}
            rows={dutyModelRows.map((row) => {
              const item = jsonItems.find((jsonItem) => jsonItem.invoiceSerialNumber === row.invoiceSerialNumber && jsonItem.itemSerialNumber === row.itemSerialNumber);
              const isIgstRow = row.dutyType === 'G' && row.addlDutyFlag === 'I';
              const rate = isIgstRow && item ? parseJsonObject(screenItem(item).igstData).rate : 0;
              const amount = isIgstRow && item ? dutyOf(item).igst : 0;
              return [
                row.invoiceSerialNumber, row.itemSerialNumber, row.dutyType, row.addlDutyFlag, row.customsNotnExemptingIgstFlag,
                joinNotification(row.notificationNo, row.notificationSrNo), fixed(rate), fixed(amount), '0.00',
                joinNotification(row.exmpNotificationNo, row.exmpNotificationSrNo), '0.00', '0.00', '0.00',
              ];
            })} />
        </ListSection>
      )}

      {(master.certModel || []).length > 0 && (
        <ListSection title="Certificate Details">
          <ChecklistList widths={[40, 25, 35]} columns={['Certificate No', 'Certificate Date', 'Certificate Type']}
            rows={master.certModel.map((row) => [row.certificateNumber, toDmy(row.certificationDate), row.certificationType])} />
        </ListSection>
      )}
      {(master.bondModel || []).length > 0 && (
        <ListSection title="Bond Details">
          <ChecklistList widths={[40, 25, 35]} columns={['Bond No', 'Bond Code', 'Bond Port']}
            rows={master.bondModel.map((row) => [row.bondNumber, row.bondCode, row.bondPort])} />
        </ListSection>
      )}
      {(master.licenseModel || []).length > 0 && (
        <ListSection title="Licence Details">
          <ChecklistList widths={[10, 18, 12, 8, 12, 8, 16, 16]}
            columns={['Inv/Itm', 'Licence No', 'Date', 'Code', 'Port', 'Lic Sr', 'Debit Value', 'Debit Qty']} rightAligned={['Debit Value', 'Debit Qty']}
            rows={master.licenseModel.map((row) => [
              `${textOf(row.invoiceSerialNumber)} / ${textOf(row.itemSerialNumberInvoice)}`, row.licenseRegistrationNumber, toDmy(row.licenseRegistrationDate), row.licenseCode,
              row.licenseRegnPort, row.itemSrNoLicense, row.debitValue, `${textOf(row.debitQuantity)} ${textOf(row.debitUnitOfMeasurement)}`,
            ])} />
        </ListSection>
      )}

      {(master.infoTypeModel || []).length > 0 && (
        <ListSection title="Single Window Info">
          <ChecklistList widths={[12, 25, 10, 9, 19, 17, 8]}
            columns={['Inv/Itm No', 'Type', 'Qualifier', 'Code', 'Text', 'Measurement', 'Unit']} rightAligned={['Measurement']}
            rows={master.infoTypeModel.map((row) => [
              invItem(row), `${textOf(row.infoType)}${row.infoType === 'CHR' ? ' - Item Characteristics' : row.infoType === 'ORC' ? ' - Origin Criteria' : ''}`,
              row.infoQualifier, row.infoCode, row.infoText, row.infoMsr, { value: row.infoUqc, className: 'tw:pl-[8px]' },
            ])} />
        </ListSection>
      )}
      {(master.ctrlModel || []).length > 0 && (
        <ListSection title="Single Window Control">
          <ChecklistList widths={[12, 10, 14, 11, 11, 12, 30]}
            columns={['Inv/Itm No', 'Type', 'Location', 'Start Dt', 'End Dt', 'Result Code', 'Result Text']}
            rows={master.ctrlModel.map((row) => [
              invItem(row), row.controlTypeCode, row.controlLocation, toDmy(row.controlStartDate), toDmy(row.controlEndDate), row.controlResultCode, row.controlResultText,
            ])} />
        </ListSection>
      )}
      {(master.sw_ConstModel || []).length > 0 && (
        <ListSection title="Single Window Constituent">
          <ChecklistList widths={[12, 8, 34, 16, 10, 10, 10]}
            columns={['Inv/Itm No', 'Sr', 'Element Name', 'Code', '%', 'Yield %', 'Active']} rightAligned={['%', 'Yield %']}
            rows={master.sw_ConstModel.map((row) => [
              invItem(row), row.constituentSrNo, row.constituentElementName, row.constituentElementCode, row.constituentPercentage,
              row.constituentYieldPercentage, { value: row.activeIngredientFlag, className: 'tw:pl-[8px]' },
            ])} />
        </ListSection>
      )}
      {(master.sw_ProdModel || []).length > 0 && (
        <ListSection title="Single Window Production (Batch)">
          <ChecklistList widths={[12, 24, 16, 8, 13, 13, 14]}
            columns={['Inv/Itm No', 'Batch Id', 'Batch Qty', 'UQC', 'Mfg Date', 'Expiry', 'Best Before']} rightAligned={['Batch Qty']}
            rows={master.sw_ProdModel.map((row) => [
              invItem(row), row.productionBatchIdentifier, row.productionBatchQuantity, { value: row.unitQuantityCode, className: 'tw:pl-[8px]' },
              toDmy(row.dateOfManufacturing), toDmy(row.dateOfExpiry), toDmy(row.bestBefore),
            ])} />
        </ListSection>
      )}
      {(master.statementModel || []).length > 0 && (
        <ListSection title="Single Window Statement">
          <ChecklistList widths={[15, 15, 25, 45]} columns={['Inv/Itm No', 'Statement For', 'Statement Type', 'Statement Code']}
            rows={master.statementModel.map((row) => [
              invItem(row),
              String(row.invoiceSerialNumber) === '0' ? 'M' : String(row.itemSerialNumber) === '0' ? 'N' : 'I',
              `${textOf(row.statementType)}${STATEMENT_TYPE[row.statementType] || ''}`,
              `${textOf(row.statementCode)}${row.statementText ? ' - ' + row.statementText : ''}`,
            ])} />
        </ListSection>
      )}

      {(master.supportingDocsModel || []).length > 0 && (
        <ListSection title="Single Window Supporting Document" avoidBreak={false}>
          <ChecklistList widths={[8, 9, 17, 12, 15, 7, 10, 12, 10]} rowClassName="tw:print:break-inside-avoid"
            columns={['Inv/Itm', 'Doc For', 'Doc No', 'Doc Type', 'Issued Party', 'Place', 'Issue Dt', 'Bnf Party', 'ICEGate Id']}
            rows={master.supportingDocsModel.map((row) => [
              invItem(row),
              String(row.invoiceSerialNumber) === '0' ? 'BE' : String(row.itemSerialNumber) === '0' ? 'INVOICE' : 'ITEM',
              { value: row.imageReferenceNo, className: 'tw:break-all' },
              <>{row.documentTypeCode}<br />{docTypeName(row.documentTypeCode)}</>,
              [row.documentIssuingPartyName, row.documentIssuingPartyNameAddress1, row.documentIssuingPartyNameAddress2, row.documentIssuingPartyNameCity].filter((part) => part && part !== ',').join(' '),
              row.placeOfIssue,
              toDmy(row.documentIssueDate),
              [row.documentBeneficiaryPartyName, row.documentBeneficiaryPartyNameAddress1, row.documentBeneficiaryPartyNameAddress2, row.documentBeneficiaryPartyNameCity, row.documentBeneficiaryPartyPin].filter(Boolean).join(' '),
              { value: row.icegateUserId, className: 'tw:break-all' },
            ])} />
        </ListSection>
      )}

      <ListSection title="GSTIN Details">
        <ChecklistList widths={[22, 8, 8, 16, 16, 15, 15]}
          columns={['Document No', 'Type', 'State', 'Cd/Name', 'IGST Ass. Val', 'IGST Amt.', 'GST Cess Amt']} rightAligned={['IGST Ass. Val', 'IGST Amt.', 'GST Cess Amt']}
          rows={[[
            taxDetails.commercialTaxRegistrationNo, taxDetails.commercialTaxType, taxDetails.stateCode, stateName(taxDetails.stateCode),
            Math.round(totAv + totBcd + totSws + totHealth + totAdd + totOther), Math.round(totIgst), 0,
          ]]} />
        <div className={cn('tw:mt-[6px] tw:font-bold', LINE_BELOW)}>Total Freight / Misc / Insurance Details</div>
        <ReportTable className="tw:table-fixed">
          <ColumnWidths widths={[33, 34, 33]} />
          <ReportBody>
            <ReportRow>
              <HeadCell align="center">Total Freight</HeadCell><HeadCell align="center">Total Misc</HeadCell><HeadCell align="center">Total Insurance</HeadCell>
            </ReportRow>
            <ReportRow>
              <Cell align="center">{fixed(totalFreight)}</Cell><Cell align="center">{fixed(totalMisc)}</Cell><Cell align="center">{fixed(totalInsurance)}</Cell>
            </ReportRow>
          </ReportBody>
        </ReportTable>
        <ReportTable className={cn('tw:mt-[4px] tw:table-fixed', LINE_ABOVE)}>
          <ColumnWidths widths={[50, 32, 18]} />
          <ReportBody>
            {currencyTotals.map(([currency, value], index) => (
              <ReportRow key={currency}>
                <Cell className="tw:font-bold">{index === 0 ? 'Grand Total' : ''}</Cell>
                <Cell align="right" className="tw:font-bold">{fixed(value)}</Cell>
                <Cell className="tw:font-bold">{currency}</Cell>
              </ReportRow>
            ))}
          </ReportBody>
        </ReportTable>
        <ReportTable className="tw:mt-[14px]">
          <ReportBody>
            <ReportRow>
              <Cell>I/We declare that the particulars given herein are true and are correct</Cell>
              <Cell align="right">Signature of Importer/CHA With Date</Cell>
            </ReportRow>
          </ReportBody>
        </ReportTable>
        <div className="no-print tw:mt-[10px] tw:text-[8pt] tw:text-[#64748b]">
          Prepared By : {user} &nbsp; | &nbsp; {printedAt} &nbsp; | &nbsp; Duty amounts are an estimate; ICEGATE assesses the final duty.
        </div>
      </ListSection>
    </ReportPage>
  );
}

function InvoiceHalf({ rows }) {
  return (
    <ReportTable className="tw:table-fixed">
      <ColumnWidths widths={[36, 4, 60]} />
      <ReportBody>
        {rows.map(([label, value], index) => <ReportRow key={index}><FieldCells label={label} value={value} /></ReportRow>)}
      </ReportBody>
    </ReportTable>
  );
}

const optionalRow = (condition, label, value) => (condition ? [[label, value]] : []);

function InvoiceBlock({ invoice, last, miscRows, conditions, rateLine, country, countryText, svbText }) {
  // a charge given as a % is printed as iCAFFE does: the amount in the invoice currency and the rate to 4 places
  // ("10.87 USD | 1.1250 %")
  const amountText = (value, currency, rate) => {
    if (String(value || '').trim() && parseFloat(value)) return `${fixed(value)} ${currency || ''}`;
    if (String(rate || '').trim() && parseFloat(rate)) return `${fixed(parseFloat(rate) / 100 * (parseFloat(invoice.invoiceValue) || 0))} ${invoice.invoiceCurrency || ''} | ${fixed(rate, 4)} %`;
    return '0.00';
  };
  const chargeRate = (currency) => rateLine(currency).replace(/^([\d.]+) (\w+)/, '$1 ( $2 )');
  const miscText = miscRows.map((row) => `${row.miscChargesCode || ''} ${row.miscChargesDscrptn || ''} ${parseFloat(row.miscCharges) ? fixed(row.miscCharges) : (parseFloat(row.miscRate) ? fixed(row.miscRate) + ' %' : '')}`.trim()).join('; ');
  const leftRows = [
    ['Inv No.', <>{invoice.actualInvoiceNumber} &nbsp;Dt. {toDmy(invoice.invoiceDate)}</>],
    ['Inv Value', <>{fixed(invoice.invoiceValue)} {invoice.invoiceCurrency} &nbsp;&nbsp;&nbsp;<b>TOI :</b> {invoice.termsOfInvoice}</>],
    ['Freight', amountText(invoice.freightValue, invoice.freightCurrency, invoice.freightRate)],
    ['Insurance', amountText(invoice.insuranceValue, invoice.insuranceCurrency, invoice.insuranceRate)],
    ['Agency Comm.', amountText(invoice.agencyCommission, invoice.agencyCommissionCurrency, invoice.agencyCommissionRate)],
    ['Loading Charges', amountText(invoice.loadingCharges, invoice.loadingCurrency, invoice.loadRate)],
    ['M Chrgs in Inv', amountText(invoice.miscCharges, invoice.miscCurrency, invoice.miscChargesRate)],
    ['High Sea Sale', amountText(invoice.hssLoadAmount, '', invoice.hssLoadRate)],
    ['Discount', amountText(invoice.discountAmount, '', invoice.discountRate)],
    ['Nature of Trans.', NATURE[invoice.natureOfTransaction] || invoice.natureOfTransaction],
    ['Terms of Payment', PAY_TERMS[invoice.paymentTerms] || invoice.paymentTerms],
    ['Valuation Method', String(invoice.valuationMethodApplicable || '').toUpperCase()],
    ...optionalRow(invoice.purchaseOrderNumber, 'PO No / Dt', [invoice.purchaseOrderNumber, toDmy(invoice.purchaseOrderDate)].filter(Boolean).join(' Dt. ')),
    ...optionalRow(invoice.contractNumber, 'Contract No / Dt', [invoice.contractNumber, toDmy(invoice.contractDate)].filter(Boolean).join(' Dt. ')),
    ...optionalRow(invoice.termsPlace, 'Terms Place', invoice.termsPlace),
    ...optionalRow(invoice.natureOfDiscount, 'Nature of Disc.', invoice.natureOfDiscount),
    ...optionalRow(miscRows.length, 'Misc Chrg Rows', miscText),
    ...optionalRow(conditions, 'Conditions', conditions),
    ...optionalRow(invoice.otherRelevantInform, 'Other Info', invoice.otherRelevantInform),
  ];
  const rightRows = [
    ['Supplier Detail', <>{invoice.supplierName}<br />{[invoice.supplierAddress1, invoice.supplierAddress2, invoice.supplierAddress3].filter((part) => part && part !== ',').join(' ')}<br />{countryText(invoice.supplierCountryName)}</>],
    ['B/S Related', yesNo(invoice.whetherBuyerAndSellerAreRelated) === 'Yes' ? 'YES' : 'NO'],
    ['Exchange Rate', (
      <>
        {rateLine(invoice.invoiceCurrency)}
        {invoice.freightCurrency && <><br />FRT :- {chargeRate(invoice.freightCurrency)}</>}
        {invoice.insuranceCurrency && <><br />INS :- {chargeRate(invoice.insuranceCurrency)}</>}
        {invoice.miscCurrency && <><br />MISC :- {chargeRate(invoice.miscCurrency)}</>}
      </>
    )],
    ['LOC No-Date', [invoice.lcNumber, toDmy(invoice.lcDate)].filter(Boolean).join(' - ')],
    ...optionalRow(invoice.sellerName, 'Seller Detail', <>{invoice.sellerName}<br />{[invoice.sellerAddress1, invoice.sellerAddress2, invoice.sellerAddress3].filter(Boolean).join(' ')} {countryText(invoice.sellerCountryName)}</>),
    ...optionalRow(invoice.brokerName, 'Broker Detail', <>{invoice.brokerName}<br />{[invoice.brokerAddress1, invoice.brokerAddress2, invoice.brokerAddress3].filter(Boolean).join(' ')} {country(invoice.brokerCountry)}</>),
    ...optionalRow(invoice.thirdPartyName, 'Third Party', <>{invoice.thirdPartyName}<br />{[invoice.thirdPartyAddress1, invoice.thirdPartyAddress2, invoice.thirdPartyCity, invoice.thirdPartyCntrySubDvsn].filter(Boolean).join(' ')} {country(invoice.thirdPartyCountryCode)}{invoice.thirdPartyPin ? ' - ' + invoice.thirdPartyPin : ''}</>),
    ...optionalRow(invoice.authorizedEconomicOperatorCode, 'AEO', [invoice.authorizedEconomicOperatorCode, invoice.authorizedEconomicOperatorCountry, invoice.authorizedEconomicOperatorRole].filter(Boolean).join(' / ')),
    ...optionalRow(invoice.svbReferenceNumber || invoice.svbLoadAssessableValue || invoice.svbLoadOnDuty, 'SVB (Invoice)', svbText(invoice)),
  ];
  return (
    <ReportTable className={cn('tw:mb-[4px] tw:table-fixed tw:print:break-inside-avoid', !last && LINE_BELOW)}>
      <ColumnWidths widths={[50, 50]} />
      <ReportBody>
        <ReportRow>
          <ReportCell look="bare" className="tw:pr-[8px]"><InvoiceHalf rows={leftRows} /></ReportCell>
          <ReportCell look="bare"><InvoiceHalf rows={rightRows} /></ReportCell>
        </ReportRow>
      </ReportBody>
    </ReportTable>
  );
}

function ItemRows({ item, duty, screen, country, svbText, aidcRow, igstRow, cessRow, reimports, rsps, depbs }) {
  const igstRate = parseJsonObject(screen.igstData).rate;
  // full description as typed on the item (the JSON splits it at 60 characters, sometimes mid-word)
  const description = String(screen.desc || screen.productDescription || '').trim() || [item.itemDescription1, item.itemDescription2].filter(Boolean).join(' ');
  const generic = item.genericDescriptionOfTheItem && item.genericDescriptionOfTheItem !== item.itemDescription1 ? item.genericDescriptionOfTheItem : '';
  const otherDuty = parseJsonObject(screen.otherDutyData);
  const ncd = parseJsonObject(screen.ncdData);
  const antiDumpingLabel = 'Anti-dumping Duty' + (item.cthSerialNumber || item.supplierSerialNumber
    ? ` (CTH Sr ${item.cthSerialNumber || '-'} / Supp Sr ${item.supplierSerialNumber || '-'}${item.quantityAsPerAntiDumpingNotn ? ' / Qty ' + item.quantityAsPerAntiDumpingNotn : ''})`
    : '');
  const manufacturerAddress = [
    item.itemManufacturerType && item.itemManufacturerCode ? `${item.itemManufacturerType} ${item.itemManufacturerCode}` : item.itemManufacturerCode,
    item.itemManufacturerAddress1, item.itemManufacturerAddress2, item.itemManufacturerCity, item.itemManufacturerSubdivision, item.itemManufacturerPin,
    country(item.itemManufacturerCntry),
  ].filter(Boolean).join(' ');
  const sourceTransit = `${item.sourceCountry ? 'Source ' + country(item.sourceCountry) : ''}${item.sourceCountry && item.transitCountry ? ' / ' : ''}${item.transitCountry ? 'Transit ' + country(item.transitCountry) : ''}`;
  const previousBe = [item.previousBeNo, item.previousBeDate ? 'Dt. ' + toDmy(item.previousBeDate) : '', item.prevCustomSite, item.prevUnitPriceInvoiced ? `Unit price ${item.prevUnitPriceInvoiced} ${item.prevCurrencyCode || ''}` : ''].filter(Boolean).join(' ');
  return (
    <ReportBody className="tw:print:break-inside-avoid">
      <ReportRow>
        <Cell className="tw:pt-[6px] tw:font-bold">{item.itemSerialNumber}</Cell>
        <Cell className="tw:pt-[6px]">{item.ritcCode}</Cell>
        <Cell className="tw:pt-[6px]" colSpan={4}>{generic ? `(${generic}) ` : ''}{description}{item.model && item.model !== 'NA' && !description.includes(item.model) ? ` (${item.model})` : ''}</Cell>
        <Cell align="right" className="tw:pt-[6px]">{item.svbFlag || ''}</Cell>
      </ReportRow>
      <ReportRow>
        <Cell>{fixed(item.quantity, 6)}</Cell>
        <Cell align="right">{fixed(item.unitPriceInvoiced, 6)}</Cell>
        <Cell className="tw:pl-[8px]">{item.cth}</Cell>
        <Cell>{item.preferentialStandard === 'P' ? 'Pref' : 'Std'}</Cell>
        <Cell>{joinNotification(item.bcdNotification, item.bcdNotificationSrNo)}</Cell>
        <Cell align="right">{fixed(screen.bcdRate)} %</Cell>
        <Cell align="right">{fixed(duty.bcd)}</Cell>
      </ReportRow>
      <ReportRow>
        <Cell>{item.unitQuantityCode}</Cell>
        <Cell align="right">{fixed(duty.av)}</Cell>
        <Cell className="tw:pl-[8px]">{item.ceth === 'NOEXCISE' ? item.cth : item.ceth}</Cell>
        <EmptyCell />
        <Cell>{joinNotification(item.cvdNotification, item.cvdNotificationSrNo)}</Cell>
        <Cell align="right">0.00 %</Cell>
        <Cell align="right">0.00</Cell>
      </ReportRow>
      {aidcRow && <DutyLine label="AIDC Duty (C)" notification={`${aidcRow.notificationNo} ${aidcRow.notificationSrNo}`} rate={otherDuty['Infra Cess_rate'] || 0} amount={duty.aidc || 0} />}
      <DutyLine label="Social Welfare Surcharge" notification={joinNotification(item.socialWelfareNotn, item.socialWelfareNotnSlno)} rate={screen.swsRate || 10} amount={duty.sws} />
      {duty.health > 0 && <DutyLine label="Health Cess" notification={joinNotification(item.healthNotn, item.healthSrNo)} rate={screen.healthCessRate} amount={duty.health} />}
      <DutyLine label="IGST" notification={igstRow ? `${igstRow.notificationNo} ${igstRow.notificationSrNo}` : ''} rate={igstRate} amount={duty.igst} />
      {(cessRow || duty.compCess > 0) && <DutyLine label="GST Compensation Cess" notification={cessRow ? `${cessRow.notificationNo} ${cessRow.notificationSrNo}` : ''} rate={parseJsonObject(screen.igstData).cessRate || 0} amount={duty.compCess || 0} />}
      {item.antiDumpingDutyNotification && <DutyLine label={antiDumpingLabel} notification={joinNotification(item.antiDumpingDutyNotification, item.antiDumpingDutySerialNumber)} rate={parseJsonObject(screen.addData).rate} amount={duty.add} />}
      {item.safeguardDutyNotn && <DutyLine label="Safeguard Duty" notification={joinNotification(item.safeguardDutyNotn, item.safeguardDutyNotnSrNo)} rate={0} amount={0} />}
      {item.saptaNotn && <DutyLine label="SAPTA / Preferential" notification={joinNotification(item.saptaNotn, item.saptaSerialNumber)} rate={screen.saptaRate} amount={screen.saptaAmount} />}
      {item.additionalCvdNotn && <DutyLine label="Additional CVD" notification={joinNotification(item.additionalCvdNotn, item.additionalCvdSrNo)} rate={screen.adlCvdRate} amount={screen.adlCvdAmount} />}
      {item.ncdNotn && <DutyLine label="NCD" notification={joinNotification(item.ncdNotn, item.ncdNotnSrNo)} rate={ncd.ncdRate} amount={ncd.ncdAmount} />}
      {item.additionalNotification1 && <DutyLine label="Additional Notn 1" notification={joinNotification(item.additionalNotification1, item.additionalNotification1SrNo)} rate={0} amount={0} />}
      {item.additionalNotification2 && <DutyLine label="Additional Notn 2" notification={joinNotification(item.additionalNotification2, item.additionalNotification2SrNo)} rate={0} amount={0} />}
      {item.otherNotification && <DutyLine label="Other Notn" notification={joinNotification(item.otherNotification, item.otherNotificationSrNo)} rate={0} amount={0} />}
      {item.cusEducessNotfnNumber && <DutyLine label="Customs Edu. Cess" notification={joinNotification(item.cusEducessNotfnNumber, item.cusEducessNotfnSrNo)} rate={0} amount={0} />}
      {item.tariffValueNotn && <TextLine label="Tariff Val Notn" text={`${joinNotification(item.tariffValueNotn, item.tariffValueItemSerialNumber)}${item.quantityAsPerTariffValueNotn ? ' / Qty ' + item.quantityAsPerTariffValueNotn : ''}`} />}
      {item.aggregateDutyNotn && <DutyLine label="Aggregate Duty Notn" notification={joinNotification(item.aggregateDutyNotn, item.aggregateDutyNotnSrNo)} rate={0} amount={0} />}
      {(item.discountRate || item.discountAmount) && <TextLine label="Item Discount" text={`${item.discountRate ? fixed(item.discountRate) + ' %' : ''} ${item.discountAmount ? fixed(item.discountAmount) : ''}`.trim()} />}
      {(item.quantityAsPerCth || item.cthQty) && <TextLine label="Qty as per CTH" text={`${item.quantityAsPerCth || ''} ${item.cthQty || ''}`.trim()} />}
      <ReportRow>
        <Cell className="tw:font-bold">Manufacturer</Cell>
        <Cell colSpan={3}>{String(item.manufacturerName || '').toUpperCase()}</Cell>
        <Cell><b>Acc. Status :</b> {item.accessoryStatus}</Cell>
        <Cell colSpan={2}><b>Country of Origin :</b> {country(item.countryOfOrigin)}</Cell>
      </ReportRow>
      <ReportRow>
        <Cell className="tw:font-bold">End Use</Cell>
        <Cell>{item.endUseOfItem}</Cell>
        <Cell colSpan={2}><b>Brand :</b> {item.brandName}</Cell>
        <Cell colSpan={3}><b>Model :</b> {item.model}</Cell>
      </ReportRow>
      {(item.itemManufacturerAddress1 || item.itemManufacturerCity || item.itemManufacturerCntry || item.itemManufacturerCode) && <TextLine label="Mfr. Address" text={manufacturerAddress} />}
      {(item.sourceCountry || item.transitCountry) && <TextLine label="Src/Transit" text={sourceTransit} />}
      {(item.accessoriesForTheItem || item.itemCategory) && <TextLine label="Accessories" text={[item.accessoriesForTheItem, item.itemCategory ? `Category ${item.itemCategory}` : ''].filter(Boolean).join(' / ')} />}
      {(item.policyParaNo || item.policyYear) && <TextLine label="Policy Para" text={`${item.policyParaNo || ''} ${item.policyYear ? '(' + item.policyYear + ')' : ''}`.trim()} />}
      {item.previousBeNo && <TextLine label="Previous BE" text={previousBe} />}
      {(item.svbReferenceNumber || item.svbLoadAssessableValue || item.svbLoadOnDuty) && <TextLine label="SVB" text={svbText(item)} />}
      {reimports.map((row, index) => (
        <TextLine key={'re' + index} label="Re-import"
          text={`SB ${row.shippingBillNo} Dt. ${toDmy(row.shippingBillDate)} ${row.portOfExport || ''}${row.invoiceNoSb ? ' Inv ' + row.invoiceNoSb : ''}${row.itemNoSb ? ' Item ' + row.itemNoSb : ''}${row.notificationNo ? ' Notn ' + joinNotification(row.notificationNo, row.notificationSrNo) : ''} | Export freight ${fixed(row.exportFreight)} Insurance ${fixed(row.exportInsurance)} Customs duty ${fixed(row.customsDuty)} Excise ${fixed(row.exciseDuty)}`} />
      ))}
      {rsps.map((row, index) => (
        <TextLine key={'rsp' + index} label="RSP / MRP"
          text={`Rs. ${fixed(row.rsp)} x ${row.quantity}${row.rspNotification ? ' Notn ' + joinNotification(row.rspNotification, row.rspNotificationSrNo) : ''} (RSP applicability ${item.rspApplicability})`} />
      ))}
      {depbs.map((row, index) => (
        <TextLine key={'dp' + index} label="Scheme Exmp." text={`Exemption ${row.whetherExemption} - Notn ${joinNotification(row.bcdNotification, row.bcdNotificationSrNo)}`} />
      ))}
    </ReportBody>
  );
}
