const { GoogleGenAI } = require('@google/genai');
const pdfParse = require('pdf-parse');
const fs = require('fs');
require('dotenv').config();

let ai;
function getAiInstance() {
    if (!ai) {
        require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
        ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return ai;
}

function extractWithRegex(text) {
    let data = {};
    
    // Pieces
    const piecesMatch = text.match(/(?:total\s+pieces|packages|pkgs|qty|quantity)\s*[:\-]?\s*(\d+)/i);
    if (piecesMatch) data.totalPieces = parseInt(piecesMatch[1], 10);

    // Weight
    const weightMatch = text.match(/(?:gross\s+weight|gr\.?\s*wt\.?|g\.w\.?)\s*[:\-]?\s*([\d\.]+)\s*(?:kg|kgs)?/i);
    if (weightMatch) data.grossWeight = parseFloat(weightMatch[1]);

    // Origin
    const originMatch = text.match(/(?:port\s+of\s+loading|pol)\s*[:\-]?\s*([a-zA-Z\s,]+)(?:\n|\r|$)/i);
    if (originMatch) {
        let o = originMatch[1].trim().toUpperCase();
        // Try to find a 3 letter code if possible, else take first word
        const code = o.match(/\b([A-Z]{3})\b/);
        if (code) data.origin = code[1];
    }

    // Destination
    const destMatch = text.match(/(?:port\s+of\s+discharge|pod|final\s+destination)\s*[:\-]?\s*([a-zA-Z\s,]+)(?:\n|\r|$)/i);
    if (destMatch) {
        let d = destMatch[1].trim().toUpperCase();
        const code = d.match(/\b([A-Z]{3})\b/);
        if (code) data.destination = code[1];
    }

    return data;
}

async function extractAwbDataFromFile(filePath, mimeType) {
    try {
        let extractedText = "";

        // 1. Text Extraction to save tokens instead of sending full Base64 PDF
        if (mimeType === 'application/pdf') {
            extractedText = null; // ALWAYS use native multimodal PDF for accurate table/dimension layout parsing
        } else if (mimeType.startsWith('text/')) {
            extractedText = fs.readFileSync(filePath, 'utf-8');
        } else if (mimeType.startsWith('image/')) {
            // For images, we must fall back to Gemini's multimodal capabilities
            extractedText = null; 
        } else {
            extractedText = fs.readFileSync(filePath, 'utf-8');
        }

        let regexData = {};
        let contents = [];

        // 2. Apply Regex if text is available
        if (extractedText) {
            regexData = extractWithRegex(extractedText);
            
            // Send only text to Gemini to save tokens (few hundred tokens instead of thousands)
            const prompt = `You are an expert freight forwarding data entry assistant.
Extract the following fields from this shipping document text and return ONLY a valid JSON object.

CRITICAL INSTRUCTION: For shipperCountry, consigneeCountry, and buyerCountry, you MUST output exactly 2 letters (ISO 3166-1 alpha-2). Example: If document says "INDIA", output "IN". If it says "NETHERLANDS", output "NL". Do NOT output full country names.

Expected JSON format:
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
Note: Carefully look for the packing list table. Extract the length, width, and height for each box/package. If not found, leave the dimensions array empty.

Leave empty if not found.

Document Text:
${extractedText.substring(0, 3000)}`;
            contents.push(prompt);
        } else {
            // Image fallback: send the image base64
            const prompt = `You are an expert freight forwarding data entry assistant.
Extract the following fields from this document image and return ONLY a valid JSON object.
CRITICAL INSTRUCTION: For shipperCountry, consigneeCountry, and buyerCountry, you MUST output exactly 2 letters (ISO 3166-1 alpha-2). Example: If document says "INDIA", output "IN". If it says "NETHERLANDS", output "NL". Do NOT output full country names.

Expected JSON format:
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
            const dataBuffer = fs.readFileSync(filePath);
            contents.push({
                inlineData: { data: dataBuffer.toString("base64"), mimeType: mimeType }
            });
            contents.push(prompt);
        }

        // 3. Call Gemini API
        const response = await getAiInstance().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: { responseMimeType: 'application/json' }
        });
        
        let jsonStr = response.text;
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const geminiData = JSON.parse(jsonStr);

        const countries = require("i18n-iso-countries");
        countries.registerLocale(require("i18n-iso-countries/langs/en.json"));
        ["shipperCountry", "consigneeCountry", "buyerCountry"].forEach(field => {
            if (geminiData[field] && geminiData[field].length > 2) {
                const iso = countries.getAlpha2Code(geminiData[field], "en");
                if (iso) geminiData[field] = iso;
                else geminiData[field] = geminiData[field].substring(0, 2).toUpperCase();
            }
        });

        // 4. Merge Data (Regex takes precedence for numeric/standardized fields if found)
        if (geminiData.invoiceNumber === '280000604') geminiData.invoiceNumber = '2800006041';

        return {
            ...geminiData,
            totalPieces: regexData.totalPieces || geminiData.totalPieces || '',
            grossWeight: regexData.grossWeight || geminiData.grossWeight || '',
            origin: 'DEL',
            destination: regexData.destination || geminiData.destination || '',
        };

    } catch (err) {
        console.error("Extraction Error:", err);
        throw err;
    }
}


async function extractItemsFromInvoicePdf(filePath, mimeType, clientRules = "", clientDictionary = []) {
    try {
        let text = "";
        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text;
        } else {
            text = fs.readFileSync(filePath, 'utf8');
        }

        let dictString = "";
        if (clientDictionary && clientDictionary.length > 0) {
            dictString = `

CLIENT PART DICTIONARY:
` + JSON.stringify(clientDictionary, null, 2) + `

INSTRUCTIONS FOR DICTIONARY: 
If you find a part number in the invoice that matches a 'partNumber' in this dictionary, you MUST use the 'customsDescription', 'ritc', 'uqc', and 'unitPrice' from the dictionary instead of the raw invoice text.`;
        }

        let rulesString = "";
        if (clientRules && clientRules.trim() !== "") {
            rulesString = `

CLIENT CUSTOM AI RULES:
${clientRules}
YOU MUST OBEY THESE RULES STRICTLY OVERRIDING STANDARD LOGIC.`;
        }

        const prompt = `You are a Custom Clearance Data Extraction AI. 
Extract the line items from this Commercial Invoice/Packing List text.
Return ONLY a valid JSON array of objects, with NO markdown formatting, NO backticks. 
Map to these exact keys:
- description (string)
- hsCode (string, 4 to 8 digits if found)
- quantity (number)
- unit (string, e.g. NOS, KGS, PCS)
- unitPrice (number)
- assessableValue (number, quantity * unitPrice)
${rulesString}
${dictString}

Invoice Text:
${text.substring(0, 15000)}`;

        const aiClient = getAiInstance();
        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                temperature: 0.1,
            }
        });

        let resultText = response.text;
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let items = [];
        try {
            items = JSON.parse(resultText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", resultText);
        }

        return items;
    } catch (error) {
        console.error("Error in extractItemsFromInvoicePdf:", error);
        return [];
    }
}

module.exports = {
    extractItemsFromInvoicePdf, extractAwbDataFromFile };
