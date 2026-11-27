import { GoogleGenerativeAI } from '@google/generative-ai';
import { BadRequestError, InternalServerError } from '../../../core/http/index.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';

// Gemini API model codes (ai.google.dev/models); the chosen model is tried first, then these, so a model Google has
// switched off does not stop the extraction
const FALLBACK_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];
const DEFAULT_MODEL = 'gemini-3.8-flash';
const MASKED_KEY = '***';

const DEFAULT_IMPORT_PROMPT = `You are an expert Indian Customs Clearance AI.
Extract data from the provided IMPORT Commercial Invoice or Packing List.
Return ONLY a valid JSON object matching this structure:
{
  "invoiceNo": "Invoice Number",
  "invoiceDate": "YYYY-MM-DD",
  "supplierName": "Name of the Supplier/Shipper",
  "currency": "3-letter Currency Code (e.g., USD, EUR, JPY)",
  "items": [
    {
      "desc": "Detailed Item Description",
      "ritc": "8-digit HSN/RITC Code if available",
      "qty": 100,
      "unit": "UOM (KGS, NOS, PCS)",
      "unitPrice": 50.00,
      "amount": 5000.00
    }
  ]
}
Rule: Do not include markdown blocks like \`\`\`json. Return raw JSON.`;

const DEFAULT_EXPORT_PROMPT = `You are an expert Indian Customs Clearance AI.
Extract data from the provided EXPORT Commercial Invoice or Packing List.
Return ONLY a valid JSON object matching this structure:
{
  "invoiceNo": "Export Invoice Number",
  "invoiceDate": "YYYY-MM-DD",
  "buyerName": "Name of the Buyer/Consignee",
  "currency": "3-letter Currency Code (e.g., USD, EUR, INR)",
  "items": [
    {
      "desc": "Detailed Item Description",
      "ritc": "8-digit HSN/RITC Code if available",
      "qty": 100,
      "unit": "UOM (KGS, NOS, PCS)",
      "unitPrice": 50.00,
      "amount": 5000.00
    }
  ]
}
Rule: Do not include markdown blocks like \`\`\`json. Return raw JSON.`;

/** The Gemini key of Settings (table AiConfig), else .env. */
async function geminiApiKey() {
  const savedKey = await settingsStore.get('GEMINI_API_KEY');
  return savedKey && savedKey !== MASKED_KEY ? savedKey : process.env.GEMINI_API_KEY;
}

async function firstModelAnswer(genAI, modelNames, prompt, pdfPart) {
  let lastError = null;
  for (const modelName of modelNames) {
    if (!modelName) continue;
    try {
      const result = await genAI.getGenerativeModel({ model: modelName }).generateContent([prompt, pdfPart]);
      if (result) return result;
    } catch (error) {
      console.log(`Model ${modelName} failed:`, error.message);
      lastError = error;
    }
  }
  throw new Error(`All configured AI models failed. Last error: ${lastError.message}`);
}

/** The model's text without a markdown code fence. */
function withoutCodeFence(answerText) {
  let text = answerText.trim();
  if (text.startsWith('```json')) text = text.substring(7);
  if (text.startsWith('```')) text = text.substring(3);
  if (text.endsWith('```')) text = text.substring(0, text.length - 3);
  return text.trim();
}

async function extractDataWithGemini(pdfBuffer, modelName, prompt, onlyFallbackModels = false) {
  const apiKey = await geminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in Settings or .env');
  const genAI = new GoogleGenerativeAI(apiKey);
  const pdfPart = { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } };
  const modelNames = [...new Set([...(onlyFallbackModels ? [] : [modelName]), ...FALLBACK_MODELS])];
  const result = await firstModelAnswer(genAI, modelNames, prompt, pdfPart);
  const response = await result.response;
  return JSON.parse(withoutCodeFence(response.text()));
}

const extractionFailure = (prefix, error) => {
  const message = prefix + error.message;
  return new InternalServerError(message, { body: { success: false, error: message } });
};

/** POST /extract-invoice: the invoice / packing list read with the model and prompt of the module (Settings). */
export async function extractInvoice(uploadedFile, formFields) {
  if (!uploadedFile) throw new BadRequestError('No PDF file uploaded');
  try {
    const moduleType = formFields.module || 'IMPORT';
    const modelKey = `AI_MODEL_${moduleType}`;
    const promptKey = `AI_PROMPT_${moduleType}`;
    const settings = await settingsStore.getMany([modelKey, promptKey]);
    const savedModel = settings[modelKey];
    const savedPrompt = settings[promptKey];
    const modelName = savedModel || DEFAULT_MODEL;
    const prompt = savedPrompt || (moduleType === 'EXPORT' ? DEFAULT_EXPORT_PROMPT : DEFAULT_IMPORT_PROMPT);
    const data = await extractDataWithGemini(uploadedFile.buffer, modelName, prompt, !savedModel);
    return { success: true, data };
  } catch (error) {
    console.error('AI Extraction Error:', error);
    throw extractionFailure('Failed to extract data using AI: ', error);
  }
}

/** POST /test: a model / prompt tried on a PDF from the settings screen. */
export async function testExtraction(uploadedFile, formFields) {
  if (!uploadedFile) throw new BadRequestError('No PDF file uploaded');
  const { model, prompt } = formFields;
  if (!model || !prompt) throw new BadRequestError('Model and prompt are required for testing');
  try {
    return { success: true, data: await extractDataWithGemini(uploadedFile.buffer, model, prompt, false) };
  } catch (error) {
    console.error('AI Test Error:', error);
    throw extractionFailure('AI Test Failed: ', error);
  }
}
