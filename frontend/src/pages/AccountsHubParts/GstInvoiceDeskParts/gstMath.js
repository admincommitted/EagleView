import { todayIso } from '../ui';

export const PARTY_TYPES = {
  overseas: [['overseas', 'OverSeas Agent'], ['shipper', 'Shipper'], ['supplier', 'Supplier']],
  other: [['importer', 'Importer'], ['shipper', 'Shipper / Exporter'], ['subagent', 'Sub Agent'], ['overseas', 'OverSeas Agent']],
};
export const partyTypeOptions = (types) => types.map(([value, label]) => ({ value, label }));
export const TITLES = { creditnote: 'CREDIT NOTE', debitnote: 'DEBIT NOTE', reimbursable: 'REIMBURSEMENT INVOICE', can: 'CARGO ARRIVAL NOTICE CUM TAX INVOICE', overseas: 'INVOICE' };
export const DIVISIONS = [['AE', 'Export Air'], ['AI', 'Import Air'], ['SE', 'Export Sea'], ['SI', 'Import Sea']];
export const FOREIGN_POS = '97';

export const financialYearStart = () => {
  const today = new Date();
  return (today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear()) + '-04-01';
};
export const num = (value) => { const parsed = parseFloat(value); return isNaN(parsed) ? 0 : parsed; };
export const round2 = (value) => Math.round((num(value) + Number.EPSILON) * 100) / 100;
export const pdfFileName = (invoiceNo) => String(invoiceNo).replace(/[/\\]+/g, '-');
export const isForeignCurrency = (currency) => !!currency && currency !== 'INR';

export const emptyHead = (kind, branch) => {
  const overseas = kind === 'overseas';
  return {
    kind, date: todayIso(), branchCode: branch || '', division: '', partyType: overseas ? 'overseas' : '', partyName: '', partyId: null, partyBranchId: null, ledgerId: null,
    address: '', gstin: '', stateName: '', stateCode: '', pos: overseas ? FOREIGN_POS : '', posName: overseas ? 'Foreign Country' : '', sez: '', paymentOption: '', countryCode: '',
    currency: 'INR', exRate: 1, costCentre: '', roundOff: 1, gstExempt: false, hideExRate: false, rcm: false, withOut: false, prevInvoiceNo: '', prevInvoiceDate: '', reason: '',
    docketBy: overseas ? 'hawb' : 'docket', jobNo: '', hawbNo: '', mawbNo: '', quotationNo: '', email: '', advance: '', remarks: '', bulk: false, dockets: [],
  };
};
export const emptyLine = () => ({ jobNo: '', containerNo: '', charge: '', sac: '', gstRate: 18, currency: 'INR', exRate: 1, rate: '', unit: '', qty: 1, discount: 0, receiptNo: '', receiptDate: '', costCentre: '', narration: '' });

// the head fields of a saved invoice, with the flags as booleans
export function headFieldsOf(invoice, kind) {
  const blank = emptyHead(kind, '');
  const fields = {};
  for (const key of Object.keys(blank)) {
    if (invoice[key] !== undefined && invoice[key] !== null) fields[key] = typeof blank[key] === 'boolean' ? !!invoice[key] : invoice[key];
  }
  return fields;
}

// the invoice no series is per division; the division is read from the docket no (.../AE/...)
export const divisionOf = (docketNo) => {
  const match = /(?:^|\/|-)(AE|AI|SE|SI)(?:\/|-|$)/.exec(String(docketNo || '').toUpperCase());
  return match ? match[1] : '';
};

// same arithmetic as the server, for the live figures on screen (the server recomputes on Save)
export function calcInvoice(head, lines, our, kind) {
  const foreign = head.pos === FOREIGN_POS;
  const zero = (head.sez || foreign) && /without/i.test(head.paymentOption || '');
  const gstOn = kind.gst && !head.gstExempt && !zero && !head.rcm;
  const intra = !foreign && !head.sez && String(head.pos || '') === (our && our.code);
  const calcLines = lines.map((line) => {
    const amount = round2(num(line.rate) * (num(line.qty) || 1) - num(line.discount));
    const inrAmount = round2(amount * (num(line.exRate) || 1));
    const rate = gstOn ? num(line.gstRate) : 0;
    const igstPct = gstOn && !intra ? rate : 0;
    const cgstPct = gstOn && intra ? rate / 2 : 0;
    return { ...line, amount, inrAmount, igstPct, cgstPct, sgstPct: cgstPct, igst: round2(inrAmount * igstPct / 100), cgst: round2(inrAmount * cgstPct / 100), sgst: round2(inrAmount * cgstPct / 100) };
  });
  const sum = (key) => round2(calcLines.reduce((total, line) => total + line[key], 0));
  const gross = sum('inrAmount');
  const igst = sum('igst'); const cgst = sum('cgst'); const sgst = sum('sgst');
  const raw = round2(gross + igst + cgst + sgst);
  const total = head.roundOff === 0 || head.roundOff === '0' ? raw : Math.round(raw);
  return { lines: calcLines, charge: sum('amount'), gross, igst, cgst, sgst, roundOff: round2(total - raw), total, gstOn, intra, zero, foreign };
}

export const docketInrTotal = (lines, docketNo) => lines.filter((line) => line.jobNo === docketNo)
  .reduce((total, line) => total + round2(num(line.rate) * (num(line.qty) || 1) * (num(line.exRate) || 1) - num(line.discount) * (num(line.exRate) || 1)), 0);

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const twoDigitWords = (value) => (value < 20 ? ONES[value] : TENS[Math.floor(value / 10)] + (value % 10 ? ' ' + ONES[value % 10] : ''));
const threeDigitWords = (value) => (value >= 100 ? ONES[Math.floor(value / 100)] + ' Hundred' + (value % 100 ? ' ' + twoDigitWords(value % 100) : '') : twoDigitWords(value));

// amount in words, Indian system (crore / lakh)
export function inWords(value, currency = 'INR') {
  const negative = value < 0;
  const amount = Math.abs(round2(value));
  let rest = Math.floor(amount);
  const paise = Math.round((amount - rest) * 100);
  const crore = Math.floor(rest / 10000000); rest %= 10000000;
  const lakh = Math.floor(rest / 100000); rest %= 100000;
  const thousand = Math.floor(rest / 1000); rest %= 1000;
  const parts = [];
  if (crore) parts.push(threeDigitWords(crore) + ' Crore');
  if (lakh) parts.push(twoDigitWords(lakh) + ' Lakh');
  if (thousand) parts.push(twoDigitWords(thousand) + ' Thousand');
  if (rest) parts.push(threeDigitWords(rest));
  const main = currency === 'INR' ? 'Rupees ' : currency + ' ';
  const sub = currency === 'INR' ? ' Paise' : ' Cents';
  return (negative ? 'Minus ' : '') + main + (parts.join(' ') || 'Zero') + (paise ? ' and ' + twoDigitWords(paise) + sub : '') + ' Only';
}
