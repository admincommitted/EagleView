import toast from 'react-hot-toast';
import { toDisplayDate } from '@/lib/dates';
import { getMaster } from '@/utils/masterCache';
import { toNotation } from '@/utils/cbicExchange';
import { sbNoOf, STAGE_TEXT } from './exportJobList';

// "Create Job from Excel": sheet "Job" = one row per invoice with the columns below; sheet "Items" = item rows
const JOB_COLUMNS = ['Mode', 'Shipper Name', 'Shipper IEC', 'Consignee Name', 'Consignee Address', 'Consignee Country', 'Port of Loading', 'Port of Discharge', 'Country of Discharge', 'Port of Destination', 'Destination Country', 'Invoice No', 'Invoice Date', 'Currency', 'Invoice Value', 'Terms', 'Exchange Rate', 'Freight', 'Insurance'];
const ITEM_COLUMNS = ['InvSr', 'Scheme', 'RITC', 'Description', 'Qty', 'Unit', 'Rate'];
const SAMPLE_JOB_ROWS = [
  ['AIR', 'EXPORTER NAME', 'ABCDE1234F', 'BUYER NAME', 'BUYER ADDRESS', 'US', 'INDEL4', 'USJFK', 'US', 'USJFK', 'US', 'EXP/001', '2026-10-01', 'USD', 1000, 'FOB', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', '', 'EXP/002', '2026-10-01', 'USD', 500, 'FOB', '', '', ''],
];
const SAMPLE_ITEM_ROW = [1, '00', '85171300', 'MOBILE PHONES', 10, 'NOS', 100];
const ADD_FREIGHT_BY_TERMS = { CIF: 'B', CI: 'I', CF: 'F', FOB: 'N' };
const EXCEL_DAY_ZERO = Date.UTC(1899, 11, 30);
const DAY_MS = 864e5;

export const SAMPLE_FILES = [
  { kind: 'job', title: 'Export Job Excel', note: 'For "Create Job from Excel": sheet Job (exporter, consignee, ports, invoice) + sheet Items' },
  { kind: 'items', title: 'Item Excel', note: 'For "Import Excel" in 3. Items: one row per item' },
];

export async function downloadExportSample(sample) {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    if (sample.kind === 'job') XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([JOB_COLUMNS, ...SAMPLE_JOB_ROWS]), 'Job');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([ITEM_COLUMNS, SAMPLE_ITEM_ROW]), 'Items');
    XLSX.writeFile(workbook, sample.kind === 'job' ? 'Export_Job_Sample.xlsx' : 'Export_Item_Sample.xlsx');
  } catch (error) {
    toast.error(`Could not create the sample: ${error.message}`);
  }
}

const upper = (value) => String(value || '').trim().toUpperCase();
const plainKeys = (row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/[^a-z]/gi, '').toLowerCase(), String(value).trim()]));

// amounts may carry commas ("1,250.00")
const amount = (value) => {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (text === '') return '';
  const number = parseFloat(text);
  return Number.isFinite(number) ? String(number) : '';
};

// a numeric RITC cell loses its leading zero
const ritcOf = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 7 ? `0${digits}` : digits;
};

// Excel keeps dates as day numbers (46296) or as text 01-10-2026 / 2026-10-01: the screen wants YYYY-MM-DD
const excelDate = (value) => {
  const text = String(value || '').trim();
  if (/^\d{5}(\.\d+)?$/.test(text)) return new Date(EXCEL_DAY_ZERO + Math.round(parseFloat(text)) * DAY_MS).toISOString().slice(0, 10);
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : text;
};

// a numeric IEC cell loses its leading 0
const iecOf = (value) => (/^\d{1,9}$/.test(value || '') ? value.padStart(10, '0') : value || '');

async function exchangeRateLookup() {
  let currencies = [];
  try {
    const answer = await getMaster('/masters/currencies');
    currencies = Array.isArray(answer) ? answer : answer?.data || [];
  } catch {
    currencies = [];
  }
  return (currency) => {
    const master = currencies.find((row) => String(row.currencyCode || '').toUpperCase() === currency);
    return master && parseFloat(master.exportRate) > 0 ? toNotation(currency, master.exportRate) : null;
  };
}

const exporterAndPorts = (job) => ({
  shipmentMode: String(job.mode || 'AIR').toUpperCase().startsWith('S') ? 'SEA' : 'AIR',
  shipperName: job.shippername || '',
  shipperIec: iecOf(job.shipperiec),
  consigneeName: job.consigneename || '',
  consigneeAddress1: job.consigneeaddress || '',
  consigneeCountryCode: upper(job.consigneecountry),
  loadingPortCode: upper(job.portofloading),
  customsPortCode: upper(job.portofloading),
  discPortCode: upper(job.portofdischarge),
  discCountryCode: upper(job.countryofdischarge),
  destPortCode: upper(job.portofdestination),
  destCountryCode: upper(job.destinationcountry),
});

function invoiceFrom(row, index, firstRow, header, rateFor) {
  const currency = upper(row.currency || firstRow.currency);
  const terms = upper(row.terms || firstRow.terms || 'FOB').replace('C&F', 'CF');
  const typedRate = amount(row.exchangerate || row.exchrate || row.rate);
  const masterRate = typedRate ? null : rateFor(currency);
  const freight = amount(row.freight);
  const insurance = amount(row.insurance);
  return {
    id: index + 1, no: (row.invoiceno || '').toUpperCase(), date: excelDate(row.invoicedate), currency, value: amount(row.invoicevalue),
    contractType: terms, natureOfContract: terms, addFreight: ADD_FREIGHT_BY_TERMS[terms] || 'N',
    exchRate: typedRate || (masterRate ? String(masterRate.rate) : ''),
    unitInRs: masterRate ? masterRate.unitInRs : (['JPY', 'KRW'].includes(currency) ? 100 : 1),
    freightAmount: freight, freightCurr: freight ? currency : '', insuranceAmount: insurance, insuranceCurr: insurance ? currency : '',
    consigneeSame: 'Y', buyer: header.consigneeName, buyerName: header.consigneeName, buyerAddress1: header.consigneeAddress1,
  };
}

function itemsFrom(itemRows, invoiceCount) {
  const nextItemSr = {};
  const skipped = [];
  const items = itemRows.filter((row) => row.ritc || row.description).map((row, index) => {
    const invSr = parseInt(row.invsr || '1', 10) || 1;
    if (invSr > invoiceCount) { skipped.push(`row ${index + 2} (InvSr ${row.invsr})`); return null; }
    nextItemSr[invSr] = (nextItemSr[invSr] || 0) + 1;
    const qty = amount(row.qty || row.quantity);
    const rate = amount(row.rate || row.price);
    const unit = upper(row.unit || 'NOS').slice(0, 3);
    const total = (parseFloat(qty) || 0) && (parseFloat(rate) || 0) ? (parseFloat(qty) * parseFloat(rate)).toFixed(2) : '';
    return { id: Date.now() + index, invSr, itemSr: nextItemSr[invSr], scheme: row.scheme || '', ritc: ritcOf(row.ritc), desc: upper(row.description), qty, unit, per: '1', rate, rateUnit: unit, totalFc: total };
  }).filter(Boolean);
  return { items, skipped };
}

export async function readExportJobExcel(file) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
  const sheet = (name) => {
    const sheetName = workbook.SheetNames.find((candidate) => candidate.toLowerCase() === name);
    return sheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) : null;
  };
  const jobRows = sheet('job') || XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  const firstRow = plainKeys(jobRows[0] || {});
  if (!firstRow.shippername && !firstRow.consigneename) throw new Error('Sheet "Job" needs at least Shipper Name and Consignee Name (download "Export Job Excel" sample)');

  const header = exporterAndPorts(firstRow);
  const rateFor = await exchangeRateLookup();
  const invoiceRows = jobRows.map(plainKeys).filter((row, index) => index === 0 || row.invoiceno);
  const invoices = invoiceRows.map((row, index) => invoiceFrom(row, index, firstRow, header, rateFor));
  const { items, skipped } = itemsFrom((sheet('items') || []).map(plainKeys), invoices.length);

  if (skipped.length) toast.error(`${skipped.length} item row(s) left out - sheet "Job" has ${invoices.length} invoice(s): ${skipped.slice(0, 4).join(', ')}`, { duration: 8000 });
  const withoutRate = invoices.filter((invoice) => !invoice.exchRate).map((invoice) => invoice.currency || '?');
  if (withoutRate.length) toast(`No exchange rate for ${[...new Set(withoutRate)].join(', ')} - enter it on the Invoices tab`, { icon: '⚠️', duration: 7000 });
  return { exportData: { ...header, invoices }, items };
}

const LIST_HEADERS = ['Job No', 'Job Date', 'Stage', 'Exporter', 'Consignee', 'Origin', 'Destination', 'Inv No', 'Inv Date', 'Inv Value', 'FOB Value', 'DBK Value', 'SB No', 'SB Date', 'Entered By'];

const listLine = (job) => [
  job.jobNo || '', job.jobDate || '', STAGE_TEXT[job.stage] || job.stage || '', job.exporter || '', job.consignee || '', job.origin || '', job.destination || '',
  job.invNo || '', toDisplayDate(job.invDt), Number(job.invValue) || 0, Number(job.fobValue) || 0, Number(job.dbkValue) || 0,
  sbNoOf(job), toDisplayDate(job.sbDate || job.autoField_26), job.enteredBy || '',
];

export async function downloadJobListExcel(jobs) {
  if (!jobs.length) { toast.error('No jobs to download'); return; }
  try {
    const XLSX = await import('xlsx');
    const lines = jobs.map(listLine);
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([LIST_HEADERS, ...lines]);
    worksheet['!cols'] = LIST_HEADERS.map((header, column) => ({ wch: Math.max(header.length, ...lines.map((line) => String(line[column]).length)) + 2 }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export Jobs');
    XLSX.writeFile(workbook, `Export_Jobs_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (error) {
    toast.error(`Could not create the Excel file: ${error.message}`);
  }
}
