// GSTR-2B reconciliation: the GSTR-2B JSON downloaded from the GST portal, matched against the Purchase vouchers in
// the books. Nothing is assumed: a row the matcher cannot pair is reported as unmatched, never dropped. Accepts the
// portal's own shape (data.docdata.b2b[].inv[] / cdnr[].nt[]) and the bare docdata variant.
import { BadRequestError } from '../../../core/http/index.js';
import { q as readOnlyQuery } from '../../../utils/db/readDb.js';

const MAX_WRAPPER_DEPTH = 5;
const DEFAULT_TOLERANCE_RUPEES = 1;
const DIFFERENCE_EPSILON = 0.009;
const SHOWN_KEYS = 8;

const failure = (message) => new BadRequestError(message, { body: { success: false, error: message } });
const asObject = (value) => (value && typeof value === 'object' ? value : {});
const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round2 = (value) => Math.round(value * 100) / 100;

const sumItems = (items) =>
  (Array.isArray(items) ? items : []).reduce(
    (sum, item) => ({
      taxable: sum.taxable + toNumber(item.txval),
      igst: sum.igst + toNumber(item.igst),
      cgst: sum.cgst + toNumber(item.cgst),
      sgst: sum.sgst + toNumber(item.sgst),
      cess: sum.cess + toNumber(item.cess),
    }),
    {
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
      cess: 0,
    },
  );

// field names differ between the portal download, the GSTN API and GSP wrappers
const documentNumber = (doc, numberKey) =>
  String(doc[numberKey] || doc.inum || doc.ntnum || doc.nt_num || doc.boenum || doc.bnum || doc.num || '').trim();
const documentDate = (doc) => String(doc.dt || doc.ntdt || doc.nt_dt || doc.boedt || doc.bdt || doc.date || '').trim();

function portalDocument(doc, supplier, kind, numberKey, sign) {
  const items = sumItems(doc.items);
  // when a document carries no item breakup, the header total is all there is
  const tax = items.igst + items.cgst + items.sgst + items.cess;
  const value = toNumber(doc.val) || items.taxable + tax;
  const signed = (amount) => Math.round(amount * sign * 100) / 100;
  return {
    kind,
    ctin: supplier.ctin,
    supplier: supplier.tradeName,
    docNo: documentNumber(doc, numberKey),
    docDate: documentDate(doc),
    portalValue: signed(value),
    taxable: signed(items.taxable),
    igst: signed(items.igst),
    cgst: signed(items.cgst),
    sgst: signed(items.sgst),
    cess: signed(items.cess),
    itcAvailable: String(doc.itcavl || doc.itc_avl || '').toUpperCase() !== 'N',
  };
}

function portalDocuments(suppliers, listKey, numberKey, kind, sign) {
  const rows = [];
  for (const supplierRow of Array.isArray(suppliers) ? suppliers : []) {
    const supplier = {
      ctin: String(supplierRow.ctin || supplierRow.gstin || '').toUpperCase(),
      tradeName: String(supplierRow.trdnm || supplierRow.tradeName || supplierRow.name || ''),
    };
    const docs = Array.isArray(supplierRow[listKey]) ? supplierRow[listKey] : [];
    for (const doc of docs) rows.push(portalDocument(doc, supplier, kind, numberKey, sign));
  }
  return rows;
}

/**
 * The documents of a GSTR-2B file. The portal's own download is {gstin, rtnprd, docdata}; the GSTN API nests it
 * twice ({status, data:{chksum, data:{...}}}) and some GSPs once, so .data is followed (max 5 levels) until the body
 * with docdata / rtnprd shows up.
 */
function parseGstr2b(root) {
  let body = asObject(root);
  let depth = 0;
  while (depth++ < MAX_WRAPPER_DEPTH && !body.docdata && !body.doc_data && !body.rtnprd && asObject(body).data) {
    body = asObject(body.data);
  }
  const docdata = asObject(body.docdata || body.doc_data || body);
  const rows = [
    ...portalDocuments(docdata.b2b, 'inv', 'inum', 'B2B invoice', 1),
    ...portalDocuments(docdata.b2ba, 'inv', 'inum', 'B2B amendment', 1),
    ...portalDocuments(docdata.cdnr, 'nt', 'ntnum', 'Credit / debit note', -1),
    ...portalDocuments(docdata.cdnra, 'nt', 'ntnum', 'CDN amendment', -1),
    ...portalDocuments(docdata.impg, 'boe', 'boenum', 'Import BoE', 1),
  ];
  return {
    period: String(body.rtnprd || body.retperiod || asObject(root).rtnprd || ''),
    gstin: String(body.gstin || asObject(root).gstin || ''),
    rows,
    shape: rows.length ? 'ok' : 'empty',
  };
}

// 11/09/2026, 11-09-2026 and 2026-09-11 all appear in portal files and ERP exports
function isoDateOf(text) {
  const value = String(text || '').trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return match[1] + '-' + match[2] + '-' + match[3];
  match = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(value);
  if (match) return match[3] + '-' + String(match[2]).padStart(2, '0') + '-' + String(match[1]).padStart(2, '0');
  return '';
}

// invoice numbers are compared without the punctuation and leading zeros that differ between portal and books
const billKey = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^0+/, '');

/** The JSON from the uploaded file, a `json` field, or the body itself. */
function readGstr2bJson(file, body) {
  if (file && file.buffer) {
    try {
      return JSON.parse(file.buffer.toString('utf8'));
    } catch (error) {
      throw failure(
        'That file is not valid JSON: ' +
          error.message +
          '. Download the GSTR-2B JSON from the GST portal (not the Excel).',
      );
    }
  }
  if (body && body.json) return typeof body.json === 'string' ? JSON.parse(body.json) : body.json;
  if (body && (body.data || body.docdata)) return body;
  return null;
}

/**
 * Every Purchase voucher with its party GSTIN and bill number, in SQL: the party is the first line on a ledger with
 * a GSTIN, else the largest Cr line.
 */
async function purchaseBooks() {
  const vouchers = await readOnlyQuery(`SELECT v.id, v.date, v.voucherNumber, v.refNo, v.totalAmount FROM Vouchers v
    JOIN VoucherTypes t ON t.id = v.voucherTypeId WHERE t.baseType = 'Purchase' ORDER BY v.id`);
  const gstParties = new Map(
    (
      await readOnlyQuery(`SELECT voucherId, name, gstin FROM (SELECT d.voucherId, l.name, l.gstin,
      row_number() OVER (PARTITION BY d.voucherId ORDER BY d.id) rn
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE t.baseType = 'Purchase' AND coalesce(l.gstin, '') <> '') x WHERE rn = 1`)
    ).map((row) => [row.voucherId, row]),
  );
  const largestCredit = new Map(
    (
      await readOnlyQuery(`SELECT voucherId, name FROM (SELECT d.voucherId, l.name,
      row_number() OVER (PARTITION BY d.voucherId ORDER BY CAST(d.amount AS REAL) DESC, d.id) rn
      FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId JOIN VoucherTypes t ON t.id = v.voucherTypeId
      LEFT JOIN AccountLedgers l ON l.id = d.ledgerId
      WHERE t.baseType = 'Purchase' AND d.dc = 'Cr') x WHERE rn = 1`)
    ).map((row) => [row.voucherId, row.name]),
  );
  return vouchers.map((voucher) => {
    const party = gstParties.get(voucher.id);
    return {
      id: voucher.id,
      date: String(voucher.date || '').slice(0, 10),
      voucherNumber: voucher.voucherNumber,
      billNo: voucher.refNo || '',
      gstin: party && party.gstin ? String(party.gstin).toUpperCase() : '',
      vendor: (party && party.name) || largestCredit.get(voucher.id) || '',
      amount: Math.round((parseFloat(voucher.totalAmount) || 0) * 100) / 100,
      used: false,
    };
  });
}

// first choice: same GSTIN and bill no; then same GSTIN and the amount inside tolerance; then bill no and amount
function findBookEntry(books, portalRow, tolerance) {
  const portalKey = billKey(portalRow.docNo);
  const sameGstin = (book) => !book.used && book.gstin && book.gstin === portalRow.ctin;
  const amountClose = (book) => Math.abs(book.amount - portalRow.portalValue) <= tolerance;
  let book = books.find((entry) => sameGstin(entry) && portalKey && billKey(entry.billNo) === portalKey);
  if (book) return { book, matchedOn: 'GSTIN + bill no' };
  book = books.find((entry) => sameGstin(entry) && amountClose(entry));
  if (book) return { book, matchedOn: 'GSTIN + amount' };
  if (portalKey) {
    book = books.find((entry) => !entry.used && portalKey && billKey(entry.billNo) === portalKey && amountClose(entry));
    if (book) return { book, matchedOn: 'bill no + amount (GSTIN differs or missing in books)' };
  }
  return { book: null, matchedOn: '' };
}

function portalRecord(portalRow, books, tolerance) {
  const { book, matchedOn } = findBookEntry(books, portalRow, tolerance);
  if (book) book.used = true;
  const bookAmount = book ? book.amount : 0;
  const difference = Math.round((portalRow.portalValue - bookAmount) * 100) / 100;
  let status = 'Mismatched';
  if (!book) status = 'Missing in Books';
  else if (Math.abs(difference) <= tolerance) status = 'Matched';
  return {
    id: book ? book.voucherNumber : 'N/A',
    voucherId: book ? book.id : null,
    vendor: portalRow.supplier || (book && book.vendor) || portalRow.ctin || 'Unknown supplier',
    gstin: portalRow.ctin,
    invoice: portalRow.docNo,
    docKind: portalRow.kind,
    date: isoDateOf(portalRow.docDate),
    bookDate: book ? book.date : '',
    portalAmt: portalRow.portalValue,
    bookAmt: bookAmount,
    taxable: portalRow.taxable,
    igst: portalRow.igst,
    cgst: portalRow.cgst,
    sgst: portalRow.sgst,
    cess: portalRow.cess,
    itcAvailable: portalRow.itcAvailable,
    diff: Math.abs(difference) > DIFFERENCE_EPSILON ? difference : 0,
    matchedOn: matchedOn || '',
    status,
  };
}

// purchases in the books that the portal does not show at all - the vendor has not filed
const booksOnlyRecord = (book) => ({
  id: book.voucherNumber,
  voucherId: book.id,
  vendor: book.vendor || 'Unknown vendor',
  gstin: book.gstin,
  invoice: book.billNo || '(no bill no on the voucher)',
  docKind: 'Books only',
  date: book.date,
  bookDate: book.date,
  portalAmt: 0,
  bookAmt: book.amount,
  taxable: 0,
  igst: 0,
  cgst: 0,
  sgst: 0,
  cess: 0,
  itcAvailable: false,
  diff: Math.round(-book.amount * 100) / 100,
  matchedOn: '',
  status: 'Missing on Portal',
});

const sumOf = (rows, key) => round2(rows.reduce((sum, row) => sum + (row[key] || 0), 0));
const taxOf = (rows) => sumOf(rows, 'igst') + sumOf(rows, 'cgst') + sumOf(rows, 'sgst');

function matchSummary(records, portalDocumentCount, purchaseVoucherCount) {
  const count = (status) => records.filter((record) => record.status === status).length;
  const matched = records.filter((record) => record.status === 'Matched');
  return {
    matched: count('Matched'),
    mismatched: count('Mismatched'),
    missingInBooks: count('Missing in Books'),
    missingOnPortal: count('Missing on Portal'),
    portalDocuments: portalDocumentCount,
    purchaseVouchers: purchaseVoucherCount,
    // ITC you can actually claim: only what matched and is flagged available on the portal
    itcSafe: taxOf(matched.filter((record) => record.itcAvailable)),
    portalTaxTotal: taxOf(records.filter((record) => record.docKind !== 'Books only')),
  };
}

export async function matchGstr2b(file, body, queryTolerance) {
  const json = readGstr2bJson(file, body);
  if (!json) throw failure('No GSTR-2B JSON came through. Attach the JSON file downloaded from the GST portal.');
  const parsed = parseGstr2b(json);
  if (!parsed.rows.length) {
    throw failure(
      'No documents found in that file. A GSTR-2B JSON has data.docdata.b2b (and optionally cdnr / impg) inside it - this file has ' +
        Object.keys(json || {})
          .slice(0, SHOWN_KEYS)
          .join(', ') +
        '. Make sure it is the GSTR-2B JSON and not GSTR-1 or an ITC summary.',
    );
  }
  const books = await purchaseBooks();
  const tolerance = Math.max(0, parseFloat(queryTolerance || body?.tolerance || DEFAULT_TOLERANCE_RUPEES));
  const records = parsed.rows.map((portalRow) => portalRecord(portalRow, books, tolerance));
  records.push(...books.filter((book) => !book.used).map(booksOnlyRecord));
  return {
    success: true,
    period: parsed.period,
    portalGstin: parsed.gstin,
    summary: matchSummary(records, parsed.rows.length, books.length),
    records,
    note:
      'Matched on GSTIN + bill number first, then GSTIN + amount within ' +
      tolerance +
      ' rupee(s). Only "Matched" rows with ITC available on the portal are safe to claim; a voucher with no Reference / Bill No. can only match on amount.',
  };
}
