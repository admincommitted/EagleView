const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const AppSetting = require('../models/AppSetting');

// 14-Nov-2026: 20 MB, PDF or picture (was any size in memory)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(/\.(pdf|jpe?g|png|webp)$/i.test(file.originalname || '') || /^(application\/pdf|image\/)/.test(file.mimetype || '') ? null : Object.assign(new Error('Only a PDF or a picture can be read'), { status: 400 }), true) });

// Default safe fallback models
// Gemini API model codes (ai.google.dev/models, Oct-2026); the 1.5 / 2.0 / 3.0 codes listed here before were shut down. 28-Oct-2026
const FALLBACK_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro"
];

// Shared extraction logic
async function extractDataWithGemini(pdfBuffer, modelName, promptStr, fallback = false) {
    // Check DB for API Key first, fallback to .env
    const dbKeySetting = { value: await require('../utils/settingsStore').get('GEMINI_API_KEY') }; // table AiConfig (28-Oct-2026)
    const activeApiKey = (dbKeySetting && dbKeySetting.value && dbKeySetting.value !== '***') 
        ? dbKeySetting.value 
        : process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
        throw new Error('GEMINI_API_KEY is not configured in Settings or .env');
    }

    const genAI = new GoogleGenerativeAI(activeApiKey);
    const pdfPart = {
        inlineData: {
            data: pdfBuffer.toString("base64"),
            mimeType: "application/pdf"
        }
    };

    let result = null;
    let lastError = null;

    // the chosen model first, then the others (a model Google has switched off no longer stops the extraction)
    const modelsToTry = [...new Set([...(fallback ? [] : [modelName]), ...FALLBACK_MODELS])];

    for (const mName of modelsToTry) {
        if (!mName) continue;
        try {
            const model = genAI.getGenerativeModel({ model: mName });
            result = await model.generateContent([promptStr, pdfPart]);
            if (result) break;
        } catch (e) {
            console.log(`Model ${mName} failed:`, e.message);
            lastError = e;
        }
    }

    if (!result) {
        throw new Error(`All configured AI models failed. Last error: ${lastError.message}`);
    }

    const response = await result.response;
    let text = response.text().trim();
    
    // Clean markdown
    if (text.startsWith("```json")) text = text.substring(7);
    if (text.startsWith("```")) text = text.substring(3);
    if (text.endsWith("```")) text = text.substring(0, text.length - 3);
    text = text.trim();

    return JSON.parse(text);
}

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

router.post('/extract-invoice', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
        }
        
        // Check module context
        const moduleType = req.body.module || 'IMPORT'; 
        
        // Fetch DB configs
        const aiCfg = await require('../utils/settingsStore').getMany([`AI_MODEL_${moduleType}`, `AI_PROMPT_${moduleType}`]); // table AiModuleConfig
        const modelSetting = { value: aiCfg[`AI_MODEL_${moduleType}`] };
        const promptSetting = { value: aiCfg[`AI_PROMPT_${moduleType}`] };

        const modelName = modelSetting && modelSetting.value ? modelSetting.value : "gemini-3.8-flash";
        const promptStr = promptSetting && promptSetting.value ? promptSetting.value : (moduleType === 'EXPORT' ? DEFAULT_EXPORT_PROMPT : DEFAULT_IMPORT_PROMPT);

        const extractedData = await extractDataWithGemini(req.file.buffer, modelName, promptStr, !modelSetting?.value);

        res.json({ success: true, data: extractedData });
    } catch (err) {
        console.error("AI Extraction Error:", err);
        res.status(500).json({ success: false, error: 'Failed to extract data using AI: ' + err.message });
    }
});

router.post('/test', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No PDF file uploaded' });
        
        const { model, prompt } = req.body;
        if (!model || !prompt) {
            return res.status(400).json({ success: false, error: 'Model and prompt are required for testing' });
        }

        const extractedData = await extractDataWithGemini(req.file.buffer, model, prompt, false);
        res.json({ success: true, data: extractedData });
    } catch (err) {
        console.error("AI Test Error:", err);
        res.status(500).json({ success: false, error: 'AI Test Failed: ' + err.message });
    }
});

module.exports = router;
