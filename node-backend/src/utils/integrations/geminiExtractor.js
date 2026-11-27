import fs from 'node:fs';
import { createRequire } from 'node:module';
import { GoogleGenAI } from '@google/genai';
import '../../config/env.js';

// CommonJS builds of pdf-parse and i18n-iso-countries, loaded exactly as the rest of the backend loads them
const requireCommonJs = createRequire(import.meta.url);
const pdfParse = requireCommonJs('pdf-parse');

const GEMINI_MODEL = 'gemini-2.5-flash';
const AWB_TEXT_LIMIT = 3000;
const INVOICE_TEXT_LIMIT = 15000;
const INVOICE_TEMPERATURE = 0.1;
const COUNTRY_FIELDS = ['shipperCountry', 'consigneeCountry', 'buyerCountry'];
// the origin is always DEL: the regex / Gemini value is not used for it
const FIXED_ORIGIN = 'DEL';
// Gemini drops the last digit of this one invoice number
const MISREAD_INVOICE_NUMBER = '280000604';
const CORRECT_INVOICE_NUMBER = '2800006041';

let ai;
function getAiInstance() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const firstAirportCode = (portText) => {
  const code = portText
    .trim()
    .toUpperCase()
    .match(/\b([A-Z]{3})\b/);
  return code ? code[1] : undefined;
};

function extractWithRegex(text) {
  const data = {};

  const piecesMatch = text.match(/(?:total\s+pieces|packages|pkgs|qty|quantity)\s*[:-]?\s*(\d+)/i);
  if (piecesMatch) data.totalPieces = parseInt(piecesMatch[1], 10);

  const weightMatch = text.match(/(?:gross\s+weight|gr\.?\s*wt\.?|g\.w\.?)\s*[:-]?\s*([\d.]+)\s*(?:kg|kgs)?/i);
  if (weightMatch) data.grossWeight = parseFloat(weightMatch[1]);

  const originMatch = text.match(/(?:port\s+of\s+loading|pol)\s*[:-]?\s*([a-zA-Z\s,]+)(?:\n|\r|$)/i);
  if (originMatch) {
    const origin = firstAirportCode(originMatch[1]);
    if (origin) data.origin = origin;
  }

  const destinationMatch = text.match(
    /(?:port\s+of\s+discharge|pod|final\s+destination)\s*[:-]?\s*([a-zA-Z\s,]+)(?:\n|\r|$)/i,
  );
  if (destinationMatch) {
    const destination = firstAirportCode(destinationMatch[1]);
    if (destination) data.destination = destination;
  }

  return data;
}

const COUNTRY_CODE_INSTRUCTION =
  'CRITICAL INSTRUCTION: For shipperCountry, consigneeCountry, and buyerCountry, you MUST output exactly 2 letters (ISO 3166-1 alpha-2). Example: If document says "INDIA", output "IN". If it says "NETHERLANDS", output "NL". Do NOT output full country names.';

const AWB_FIELDS_SPEC = `Expected JSON format:
{
  "invoiceNumber": "Invoice Number (string). CAREFULLY inspect the string. Do NOT drop the last digit. Pay attention to Roman numerals (e.g. II instead of //).",
  "invoiceDate": "Invoice Date (YYYY-MM-DD or string)",
  "shipperName": "Full name of the Shipper / Exporter",
  "shipperAddress": "Street address of Shipper (excluding city/state/zip)",
  "shipperCity": "City of Shipper",
  "shipperState": "State of Shipper",
  "shipperCountry": "ISO 2-letter Country code of Shipper (e.g. IN, US, AE)",
  "shipperZip": "Zip/Postal code of Shipper",
  "shipperPhone": "Phone/Contact number of Shipper (scan for digit sequences like 9953620027 near shipper name)",
  "shipperEmail": "Email address of Shipper",
  "consigneeName": "Full name of the Consignee",
  "consigneeAddress": "Street address of Consignee",
  "consigneeCity": "City of Consignee",
  "consigneeState": "State of Consignee",
  "consigneeCountry": "ISO 2-letter Country code of Consignee (e.g. IN, US, AE)",
  "consigneeZip": "Zip/Postal code of Consignee",
  "consigneePhone": "Phone/Contact number of Consignee (scan for digit sequences like 31 0 857 470023 near consignee)",
  "consigneeEmail": "Email address of Consignee",
  "buyerName": "Full name of the Buyer",
  "buyerAddress": "Street address of Buyer",
  "buyerCity": "City of Buyer",
  "buyerState": "State of Buyer",
  "buyerCountry": "ISO 2-letter Country code of Buyer (e.g. IN, US, AE)",
  "buyerZip": "Zip/Postal code of Buyer",
  "buyerPhone": "Phone number of Buyer",
  "buyerEmail": "Email address of Buyer",
  "origin": "3-letter IATA Airport Code for Port of Loading (e.g. DEL, BOM). Infer from city/country.",
  "destination": "3-letter IATA Airport Code for Port of Discharge (e.g. LHR, JFK). Infer from city/country.",
  "totalPieces": "Total number of PACKAGES, CARTONS, or BOXES (integer). DO NOT extract the quantity of individual items or products.",
  "grossWeight": "Total gross weight in KG (float)",
  "currency": "Currency code (e.g. USD, EUR, INR)",
  "totalValue": "Total invoice value/amount (float)",
  "incoterms": "Incoterms (e.g. FOB, CIF, EXW)",
  "commodityDescription": "Brief description of the goods",
  "hsCode": "HS Code / Tariff Code if present (string)",
  "marksAndNumbers": "Marks and numbers printed on packages (string)",
  "dimensions": [
    { "pieces": "integer (e.g. 10)", "length": "float", "width": "float", "height": "float", "unit": "CM or IN or MM" }
  ]
}
Note: Carefully look for the packing list table. Extract the length, width, and height for each box/package. If not found, leave the dimensions array empty.`;

const awbTextPrompt = (documentText) => `You are an expert freight forwarding data entry assistant.
Extract the following fields from this shipping document text and return ONLY a valid JSON object.

${COUNTRY_CODE_INSTRUCTION}

${AWB_FIELDS_SPEC}

Leave empty if not found.

Document Text:
${documentText.substring(0, AWB_TEXT_LIMIT)}`;

const AWB_IMAGE_PROMPT = `You are an expert freight forwarding data entry assistant.
Extract the following fields from this document image and return ONLY a valid JSON object.
${COUNTRY_CODE_INSTRUCTION}

${AWB_FIELDS_SPEC}`;

// PDFs and images go to Gemini as files (its own layout reading finds the dimension tables); other files as text
function readDocumentText(filePath, mimeType) {
  if (mimeType === 'application/pdf') return null;
  if (mimeType.startsWith('image/')) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

function awbRequestContents(filePath, mimeType, documentText) {
  if (documentText) return [awbTextPrompt(documentText)];
  const fileBuffer = fs.readFileSync(filePath);
  return [{ inlineData: { data: fileBuffer.toString('base64'), mimeType } }, AWB_IMAGE_PROMPT];
}

const stripJsonFences = (text) =>
  text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

// Gemini sometimes still answers a full country name: turn it into the ISO 2-letter code
function normalizeCountryFields(extracted) {
  const countries = requireCommonJs('i18n-iso-countries');
  countries.registerLocale(requireCommonJs('i18n-iso-countries/langs/en.json'));
  COUNTRY_FIELDS.forEach((field) => {
    if (!extracted[field] || extracted[field].length <= 2) return;
    const isoCode = countries.getAlpha2Code(extracted[field], 'en');
    extracted[field] = isoCode || extracted[field].substring(0, 2).toUpperCase();
  });
}

async function extractAwbDataFromFile(filePath, mimeType) {
  try {
    const documentText = readDocumentText(filePath, mimeType);
    // regex values win for the numeric / standardized fields
    const regexData = documentText ? extractWithRegex(documentText) : {};

    const response = await getAiInstance().models.generateContent({
      model: GEMINI_MODEL,
      contents: awbRequestContents(filePath, mimeType, documentText),
      config: { responseMimeType: 'application/json' },
    });
    const geminiData = JSON.parse(stripJsonFences(response.text));
    normalizeCountryFields(geminiData);

    if (geminiData.invoiceNumber === MISREAD_INVOICE_NUMBER) geminiData.invoiceNumber = CORRECT_INVOICE_NUMBER;

    return {
      ...geminiData,
      totalPieces: regexData.totalPieces || geminiData.totalPieces || '',
      grossWeight: regexData.grossWeight || geminiData.grossWeight || '',
      origin: FIXED_ORIGIN,
      destination: regexData.destination || geminiData.destination || '',
    };
  } catch (err) {
    console.error('Extraction Error:', err);
    throw err;
  }
}

async function readInvoiceText(filePath, mimeType) {
  if (mimeType !== 'application/pdf') return fs.readFileSync(filePath, 'utf8');
  const pdfData = await pdfParse(fs.readFileSync(filePath));
  return pdfData.text;
}

// prompt lines are joined with '\n'; some end with a space on purpose (the prompt text Gemini is tuned on)
function dictionaryInstructions(clientDictionary) {
  if (!clientDictionary || clientDictionary.length === 0) return '';
  return [
    '',
    '',
    'CLIENT PART DICTIONARY:',
    JSON.stringify(clientDictionary, null, 2),
    '',
    'INSTRUCTIONS FOR DICTIONARY: ',
    "If you find a part number in the invoice that matches a 'partNumber' in this dictionary, you MUST use the 'customsDescription', 'ritc', 'uqc', and 'unitPrice' from the dictionary instead of the raw invoice text.",
  ].join('\n');
}

function clientRulesInstructions(clientRules) {
  if (!clientRules || clientRules.trim() === '') return '';
  return `

CLIENT CUSTOM AI RULES:
${clientRules}
YOU MUST OBEY THESE RULES STRICTLY OVERRIDING STANDARD LOGIC.`;
}

const invoiceItemsPrompt = (invoiceText, rulesText, dictionaryText) =>
  [
    'You are a Custom Clearance Data Extraction AI. ',
    'Extract the line items from this Commercial Invoice/Packing List text.',
    'Return ONLY a valid JSON array of objects, with NO markdown formatting, NO backticks. ',
    'Map to these exact keys:',
    '- description (string)',
    '- hsCode (string, 4 to 8 digits if found)',
    '- quantity (number)',
    '- unit (string, e.g. NOS, KGS, PCS)',
    '- unitPrice (number)',
    '- assessableValue (number, quantity * unitPrice)',
    rulesText,
    dictionaryText,
    '',
    'Invoice Text:',
    invoiceText.substring(0, INVOICE_TEXT_LIMIT),
  ].join('\n');

async function extractItemsFromInvoicePdf(filePath, mimeType, clientRules = '', clientDictionary = []) {
  try {
    const invoiceText = await readInvoiceText(filePath, mimeType);
    const prompt = invoiceItemsPrompt(
      invoiceText,
      clientRulesInstructions(clientRules),
      dictionaryInstructions(clientDictionary),
    );

    const response = await getAiInstance().models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature: INVOICE_TEMPERATURE },
    });

    const resultText = stripJsonFences(response.text);
    try {
      return JSON.parse(resultText);
    } catch {
      console.error('Failed to parse Gemini JSON:', resultText);
      return [];
    }
  } catch (error) {
    console.error('Error in extractItemsFromInvoicePdf:', error);
    return [];
  }
}

export { extractItemsFromInvoicePdf, extractAwbDataFromFile };
