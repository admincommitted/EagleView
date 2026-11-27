import { findOne as findLedgerByGstinOrName } from '../../../../utils/common/ledgerGuard.js';
import { selectRows, selectRowsOrEmpty } from '../shared/hubQuery.service.js';
import { GST_SLABS, nearestOf, round2 } from '../shared/hubFormat.service.js';
import { ensureLedgerColumns } from '../shared/ledgerColumns.service.js';
import { ensureMasterTable } from '../shared/masterDefinitions.service.js';
import { badRequest, hubError } from '../shared/hubHttp.js';
import { amountOf, billByPatterns, isoDateOf } from './billText.service.js';

// OCR of a vendor bill (iCAFFE "OCR" on Trade Invoice). The bill (PDF or image) is read by Gemini, the same way the
// AWB and invoice screens read documents; a PDF that carries text is read locally first (pdf-parse) and only that text
// is sent. If Gemini is not reachable the text is scanned with patterns (GSTIN, invoice no, date, GST amounts) so the
// form still gets what can be found. Nothing is saved here - the screen fills the Trade Invoice and the user checks it.

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 60000;
const MIN_TEXT_CHARACTERS = 200;
const MAX_TEXT_SENT = 15000;
const DEFAULT_GST_SLAB = 18;
const READABLE_BILL_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp))$/i;

const OCR_PROMPT = `You read Indian vendor bills (GST tax invoices) for a freight forwarder / customs broker that is the BUYER.
Return ONLY a JSON object, no markdown:
{"vendorName":"seller name","vendorGstin":"seller 15-char GSTIN","buyerGstin":"buyer GSTIN","invoiceNo":"","invoiceDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD or empty",
"placeOfSupply":"state name or code","currency":"INR or other","hblNo":"HAWB/HBL no if any","mblNo":"MAWB/MBL no if any","jobNo":"job / docket / reference no of the buyer if any",
"lines":[{"description":"charge name","sac":"SAC/HSN","qty":1,"rate":0,"amount":0,"gstRate":18}],
"taxable":0,"cgst":0,"sgst":0,"igst":0,"total":0}
Rules: amounts are numbers without commas; "amount" on a line is the taxable value before GST; gstRate is the total GST % (CGST+SGST or IGST) of that line; leave a field empty or 0 when it is not on the bill. Do not invent values.`;

// the text of a PDF that carries text; '' for a scanned or unreadable one (Gemini then reads the file itself)
async function pdfText(buffer) {
  try {
    const pdfParse = await import('pdf-parse');
    if (typeof pdfParse === 'function') return (await pdfParse(buffer)).text || '';
    if (pdfParse && typeof pdfParse.default === 'function') return (await pdfParse.default(buffer)).text || '';
    if (pdfParse && pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: buffer });
      const result = await parser.getText();
      try {
        await parser.destroy();
      } catch {
        // the text is already read
      }
      return (result && result.text) || '';
    }
  } catch {
    // scanned PDF or unreadable - Gemini reads the file itself
  }
  return '';
}

const timeoutAfter = (milliseconds) =>
  new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('took more than 60 seconds')), milliseconds);
  });

async function readBillWithGemini(file, text) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contents =
    text.replace(/\s+/g, '').length > MIN_TEXT_CHARACTERS
      ? OCR_PROMPT + '\n\nBill text:\n' + text.slice(0, MAX_TEXT_SENT)
      : [
          {
            role: 'user',
            parts: [
              { text: OCR_PROMPT },
              { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } },
            ],
          },
        ];
  const answer = await Promise.race([
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
    timeoutAfter(GEMINI_TIMEOUT_MS),
  ]);
  return JSON.parse(
    String(answer.text || '')
      .replace(/```json|```/g, '')
      .trim(),
  );
}

/** Gemini's reading, else the patterns over the PDF text (with a warning); a bill with neither cannot be read. */
async function readBill(file, warnings) {
  const text = /pdf/i.test(file.mimetype) ? await pdfText(file.buffer) : '';
  try {
    return { data: await readBillWithGemini(file, text), source: 'gemini' };
  } catch (error) {
    warnings.push(
      'AI reading not available (' + error.message + ') - filled from the bill text only, check every field',
    );
    if (!text.trim()) {
      throw hubError(
        422,
        'Could not read this bill: it has no text (scanned) and AI reading failed - ' + error.message,
        { warnings },
      );
    }
    return { data: billByPatterns(text), source: 'text' };
  }
}

function cleanBillData(rawData) {
  const data = rawData || {};
  data.lines = Array.isArray(data.lines) ? data.lines : [];
  data.invoiceDate = isoDateOf(data.invoiceDate) || data.invoiceDate || '';
  data.dueDate = isoDateOf(data.dueDate) || '';
  data.vendorGstin = String(data.vendorGstin || '')
    .toUpperCase()
    .replace(/\s/g, '');
  ['taxable', 'cgst', 'sgst', 'igst', 'total'].forEach((key) => {
    data[key] = amountOf(data[key]);
  });
  data.lines = data.lines
    .map((line) => ({
      description: String(line.description || '').trim(),
      sac: String(line.sac || '').replace(/\D/g, ''),
      qty: amountOf(line.qty) || 1,
      rate: amountOf(line.rate),
      amount: amountOf(line.amount) || amountOf(line.rate) * (amountOf(line.qty) || 1),
      gstRate: amountOf(line.gstRate),
    }))
    .filter((line) => line.amount);
  return data;
}

// only an account that fits on its own (GSTIN + name, or the exact name, or the one ledger with that GSTIN on an
// address) - look-alikes are never guessed
async function findVendor(data, warnings) {
  let vendor = null;
  try {
    const vendorId = await findLedgerByGstinOrName({ gstin: data.vendorGstin, name: data.vendorName });
    if (vendorId)
      vendor = (await selectRows('SELECT id, name FROM AccountLedgers WHERE id = ?', [vendorId]))[0] || null;
    if (!vendor && data.vendorGstin) {
      const viaAddress = await selectRows(
        `SELECT DISTINCT l.id, l.name FROM AccLedgerAddresses a JOIN AccountLedgers l ON l.id = a.ledgerId WHERE upper(replace(a.gstin, ' ', '')) = ?`,
        [data.vendorGstin],
      );
      if (viaAddress.length === 1) vendor = viaAddress[0];
      else if (viaAddress.length > 1) {
        warnings.push(
          'GSTIN ' +
            data.vendorGstin +
            ' is on more than one account (' +
            viaAddress.map((ledger) => ledger.name).join(' / ') +
            ') - choose the party by hand',
        );
      }
    }
  } catch (error) {
    warnings.push(error.message);
  }
  if (!vendor) {
    warnings.push(
      'Vendor ' +
        (data.vendorName || '') +
        (data.vendorGstin ? ' (' + data.vendorGstin + ')' : '') +
        ' is not in the ledgers - choose the party by hand or create the ledger',
    );
  }
  return vendor;
}

const compactName = (text) =>
  String(text || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

// each line is matched to GST Charges by name for its SAC / expense ledger
async function matchCharges(lines) {
  try {
    await ensureMasterTable('gstcharges');
  } catch {
    // no GST Charges yet: the lines keep their own description
  }
  const charges = await selectRowsOrEmpty('SELECT chargeName, sacCode, gstRate, expenseLedgerId FROM AccGstCharges');
  return lines.map((line) => {
    const charge = charges.find(
      (candidate) =>
        compactName(candidate.chargeName) &&
        (compactName(line.description).includes(compactName(candidate.chargeName)) ||
          compactName(candidate.chargeName).includes(compactName(line.description))),
    );
    return charge
      ? {
          ...line,
          charge: charge.chargeName,
          sac: line.sac || charge.sacCode || '',
          expenseLedgerId: charge.expenseLedgerId || null,
        }
      : { ...line, charge: line.description };
  });
}

// a line without its own GST % takes the bill's rate (GST total / taxable), rounded to a slab
function fillLineGstRates(data) {
  const gstTotal = data.igst || data.cgst + data.sgst;
  const base = data.taxable || data.lines.reduce((sum, line) => sum + line.amount, 0);
  if (!gstTotal || !base) return;
  const slab = nearestOf(GST_SLABS, (gstTotal / base) * 100, DEFAULT_GST_SLAB);
  data.lines = data.lines.map((line) => (line.gstRate ? line : { ...line, gstRate: slab }));
}

/** Reads an uploaded vendor bill into the Trade Invoice fields; answers { source, data, vendor, warnings }. */
export async function readVendorBill(file) {
  if (!file) throw badRequest('Choose the bill - PDF or image, up to 10 MB');
  if (!READABLE_BILL_TYPES.test(file.mimetype)) throw badRequest('Only PDF, PNG, JPG or WEBP bills can be read');
  const warnings = [];
  const { data: rawData, source } = await readBill(file, warnings);
  const data = cleanBillData(rawData);
  await ensureLedgerColumns();
  const vendor = await findVendor(data, warnings);
  data.lines = await matchCharges(data.lines);
  fillLineGstRates(data);
  const linesTotal = data.lines.reduce((sum, line) => sum + line.amount, 0);
  if (data.taxable && Math.abs(linesTotal - data.taxable) > 1) {
    warnings.push(
      'Lines add up to ' + round2(linesTotal) + ' but the bill says taxable ' + data.taxable + ' - check the charges',
    );
  }
  return { source, data, vendor, warnings };
}
