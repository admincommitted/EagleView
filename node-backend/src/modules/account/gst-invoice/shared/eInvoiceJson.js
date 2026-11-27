import { badRequest, parseJsonList, round2, toNumber } from './invoiceDb.js';
import { CREDIT_NOTE, DEBIT_NOTE, REIMBURSABLE, VOID, eInvoiceSupplyType } from './invoiceKinds.js';

const IRP_SCHEMA_VERSION = '1.1';
const DEFAULT_SAC = '9967';
const UNKNOWN_PIN = 999999;
const EXPORT_STATE_CODE = '96';
const MAX_DOC_NO = 16;
const MAX_NAME = 100;
const MAX_LOCATION = 50;
const MAX_DESCRIPTION = 300;
const MAX_PHONE = 12;

const ddmmyyyy = (date) => {
  const [year, month, day] = String(date).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const clip = (value, length) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, length);
const pinOf = (text) => {
  const match = String(text || '').match(/\b(\d{6})\b/);
  return match ? Number(match[1]) : UNKNOWN_PIN;
};

function documentType(kind) {
  if (kind === CREDIT_NOTE) return 'CRN';
  if (kind === DEBIT_NOTE) return 'DBN';
  return 'INV';
}

const sellerDetails = (our) => ({
  Gstin: our.gstin,
  LglNm: clip(our.legalName, MAX_NAME),
  Addr1: clip(our.addr1 || our.legalName, MAX_NAME),
  ...(our.addr2 ? { Addr2: clip(our.addr2, MAX_NAME) } : {}),
  Loc: clip(our.city || our.name, MAX_LOCATION),
  Pin: Number(our.pin) || pinOf(our.addr1 + ' ' + our.addr2),
  Stcd: our.code,
  ...(our.phone ? { Ph: clip(String(our.phone).replace(/\D/g, ''), MAX_PHONE) } : {}),
  ...(our.email ? { Em: clip(our.email, MAX_NAME) } : {}),
});

function buyerDetails(invoice, supplyType) {
  const isExport = supplyType.startsWith('EXP');
  const buyerState = isExport
    ? EXPORT_STATE_CODE
    : String(invoice.gstin || '').slice(0, 2) || invoice.stateCode || invoice.pos;
  return {
    Gstin: isExport ? 'URP' : invoice.gstin,
    LglNm: clip(invoice.partyName, MAX_NAME),
    Pos: isExport ? EXPORT_STATE_CODE : String(invoice.pos),
    Addr1: clip(invoice.address || invoice.partyName, MAX_NAME),
    Loc: clip(invoice.stateName || invoice.countryCode || 'NA', MAX_LOCATION),
    ...(isExport ? {} : { Pin: pinOf(invoice.address) }),
    Stcd: buyerState,
  };
}

function itemOf(line, index, supplyType) {
  const assessable = round2(line.inrAmount);
  const lineRate = toNumber(line.exRate) || 1;
  const hasTaxRate = toNumber(line.gstRate) && (toNumber(line.igstPct) || toNumber(line.cgstPct));
  let gstRate = 0;
  if (hasTaxRate || supplyType.endsWith('WOP')) gstRate = toNumber(line.gstRate);
  return {
    SlNo: String(index + 1),
    PrdDesc: clip(line.charge + (line.narration ? ' - ' + line.narration : ''), MAX_DESCRIPTION),
    IsServc: 'Y',
    HsnCd: String(line.sac || DEFAULT_SAC).replace(/\D/g, '') || DEFAULT_SAC,
    Qty: toNumber(line.qty) || 1,
    Unit: 'OTH',
    UnitPrice: round2(toNumber(line.rate) * lineRate),
    TotAmt: round2(assessable + toNumber(line.discount) * lineRate),
    Discount: round2(toNumber(line.discount) * lineRate),
    AssAmt: assessable,
    GstRt: gstRate,
    IgstAmt: round2(line.igst),
    CgstAmt: round2(line.cgst),
    SgstAmt: round2(line.sgst),
    TotItemVal: round2(assessable + toNumber(line.igst) + toNumber(line.cgst) + toNumber(line.sgst)),
  };
}

const valueDetails = (invoice) => ({
  AssVal: round2(invoice.grossInr),
  CgstVal: round2(invoice.cgst),
  SgstVal: round2(invoice.sgst),
  IgstVal: round2(invoice.igst),
  RndOffAmt: round2(invoice.roundOffAmt),
  TotInvVal: round2(invoice.total),
  ...(invoice.currency && invoice.currency !== 'INR' && invoice.totalFcy
    ? { TotInvValFc: round2(invoice.totalFcy) }
    : {}),
});

function checkIsEInvoice(invoice, our, supplyType) {
  if (invoice.kind === REIMBURSABLE) throw badRequest(invoice.invoiceNo + ': a reimbursement bill is not an e-invoice');
  if (invoice.status === VOID) throw badRequest(invoice.invoiceNo + ' is void');
  if (supplyType === 'B2B' && !invoice.gstin) {
    throw badRequest(invoice.invoiceNo + ': party has no GSTIN - B2C bills are not e-invoices');
  }
  if (!our.gstin) throw badRequest('Our GSTIN is not set (Company Profile)');
}

/** The IRP e-invoice JSON (schema 1.1) of one saved invoice. Reimbursable and B2C bills are not e-invoices. */
export async function eInvoiceJson(invoice, our) {
  const supplyType = eInvoiceSupplyType(invoice);
  checkIsEInvoice(invoice, our, supplyType);
  const lines = parseJsonList(invoice.linesJson);
  const json = {
    Version: IRP_SCHEMA_VERSION,
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: supplyType,
      RegRev: toNumber(invoice.rcm) ? 'Y' : 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: { Typ: documentType(invoice.kind), No: clip(invoice.invoiceNo, MAX_DOC_NO), Dt: ddmmyyyy(invoice.date) },
    SellerDtls: sellerDetails(our),
    BuyerDtls: buyerDetails(invoice, supplyType),
    ItemList: lines.map((line, index) => itemOf(line, index, supplyType)),
    ValDtls: valueDetails(invoice),
  };
  if (supplyType.startsWith('EXP')) {
    json.ExpDtls = {
      CntCode: clip(invoice.countryCode || 'US', 2).toUpperCase(),
      ForCur: invoice.currency && invoice.currency !== 'INR' ? invoice.currency : 'INR',
    };
  }
  if (invoice.prevInvoiceNo) {
    json.RefDtls = {
      PrecDocDtls: [
        { InvNo: clip(invoice.prevInvoiceNo, MAX_DOC_NO), InvDt: ddmmyyyy(invoice.prevInvoiceDate || invoice.date) },
      ],
    };
  }
  return json;
}
