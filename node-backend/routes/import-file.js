/**
 * import-file.js
 * Routes for importing BE/SB data from JSON or flat files
 * POST /api/import-file/be  — parse → jobData
 * POST /api/import-file/sb  — parse → exportData
 * POST /api/import-file/detect — detect format only
 */

const express = require("express");
const router  = express.Router();
const multer  = require("multer");
const { parseJsonToBE, parseJsonToSB, parseFlatFileToBE, parseFlatFileToSB, detectFormat } = require("../utils/ErpFileParser");

// Use memory storage — we just need the text content
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Helper: parse request body — accepts JSON body OR file upload
async function getInputText(req) {
  // If file uploaded
  if (req.file) return req.file.buffer.toString("utf8");
  // If JSON body with jsonText field
  if (req.body.jsonText) return req.body.jsonText;
  // If JSON body with jsonData object
  if (req.body.jsonData) return typeof req.body.jsonData === "string" ? req.body.jsonData : JSON.stringify(req.body.jsonData);
  throw new Error("No input provided. Send file or jsonText in body.");
}

// POST /api/import-file/be — Parse any file/JSON and return BE jobData
router.post("/be", upload.single("file"), async (req, res) => {
  try {
    const text     = await getInputText(req);
    const fileType = req.body.fileType || req.file?.originalname?.toLowerCase() || "json";
    const isFlatFile = fileType.includes(".be") || fileType.includes("flat") || req.body.format === "flat";

    let result;
    if (isFlatFile) {
      result = parseFlatFileToBE(text);
    } else {
      // Try JSON parse
      let jsonObj;
      try { jsonObj = JSON.parse(text); } catch (e) {
        // If JSON parse fails, try as flat file
        result = parseFlatFileToBE(text);
        return res.json({ success: true, ...result, hint: "Parsed as flat file (JSON parse failed)" });
      }
      result = parseJsonToBE(jsonObj);
    }

    const fieldCount = Object.keys(result.jobData).length;
    console.log(`[IMPORT-FILE] BE parse: ${result.detectedFormat}, ${fieldCount} fields, ${result.invoices.length} invoices, ${result.items.length} items`);
    res.json({ success: true, ...result, fieldCount, message: `${fieldCount} fields parsed from ${result.detectedFormat}` });
  } catch (err) {
    console.error("[IMPORT-FILE] BE error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/import-file/sb — Parse any file/JSON and return SB exportData
router.post("/sb", upload.single("file"), async (req, res) => {
  try {
    const text     = await getInputText(req);
    const fileType = req.body.fileType || req.file?.originalname?.toLowerCase() || "json";
    const head = String(text).replace(/^\uFEFF/, "").trimStart();
    // flat file: .sb name, format=flat, or the content itself (HREC line / ASCII 29 separators)
    const isFlatFile = fileType.includes(".sb") || fileType.includes("flat") || req.body.format === "flat" || head.startsWith("HREC") || head.includes("\x1d");

    let result;
    if (isFlatFile) {
      result = parseFlatFileToSB(text);
    } else {
      let jsonObj;
      try { jsonObj = JSON.parse(text); } catch (e) {
        result = parseFlatFileToSB(text);
        return res.json({ success: true, ...result, hint: "Parsed as flat file (JSON parse failed)" });
      }
      const fmt = detectFormat(jsonObj || {});
      if (fmt === "CACHI01") return res.status(400).json({ success: false, error: "This is a Bill of Entry JSON (CACHI01) - read it in Import (BE), not in Export" });
      result = parseJsonToSB(jsonObj);
    }

    const fieldCount = Object.keys(result.exportData).length;
    if (!fieldCount && !(result.items || []).length) return res.status(400).json({ success: false, error: "No shipping bill data found in this file" });
    console.log(`[IMPORT-FILE] SB parse: ${result.detectedFormat}, ${fieldCount} fields, ${result.invoices.length} invoices, ${result.items.length} items`);
    const c = (result.summary && result.summary.counts) || {};
    const parts = [`${result.invoices.length} invoice(s)`, `${result.items.length} item(s)`];
    if (c.drawback) parts.push(`${c.drawback} drawback`);
    if (c.swInfo) parts.push(`${c.swInfo} SW info`);
    if (c.documents) parts.push(`${c.documents} document(s)`);
    const label = result.detectedFormat === "FLAT_FILE_SB" ? "flat file" : result.detectedFormat === "CACHE01" ? "ICEGATE JSON" : result.detectedFormat;
    res.json({ success: true, ...result, fieldCount, message: `Shipping bill read from ${label}: ${parts.join(", ")}` });
  } catch (err) {
    console.error("[IMPORT-FILE] SB error:", err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/import-file/detect — Just detect the format without full parsing
router.post("/detect", express.json(), async (req, res) => {
  try {
    const text = req.body.text || "";
    let jsonObj;
    try { jsonObj = JSON.parse(text); } catch { return res.json({ format: "FLAT_FILE", success: true }); }
    const fmt = detectFormat(jsonObj);
    res.json({ success: true, format: fmt });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;


const { extractItemsFromInvoicePdf } = require('../utils/geminiExtractor');

// POST /api/import-file/extract-pdf-items
router.post('/extract-pdf-items', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const Party = require('../models/Party');
        const PartyItemMaster = require('../models/PartyItemMaster');

        const tempPath = path.join(os.tmpdir(), req.file.originalname || 'temp.pdf');
        fs.writeFileSync(tempPath, req.file.buffer);
        
        let clientRules = "";
        let clientDictionary = [];
        const partyId = req.body.partyId;
        const formType = req.body.formType || 'import';

        if (partyId) {
            const party = await Party.findByPk(partyId);
            if (party) {
                clientRules = (formType === 'export' ? party.aiExportRules : party.aiImportRules) || party.aiExtractionRules || "";
            }
            const items = await PartyItemMaster.findAll({ where: { partyId: partyId } }); // Filtering in memory or query
            if (items && items.length > 0) {
                clientDictionary = items.map(i => i.toJSON());
            }
        }
        
        const items = await extractItemsFromInvoicePdf(tempPath, req.file.mimetype, clientRules, clientDictionary);
        
        fs.unlinkSync(tempPath);
        
        res.json({ success: true, items });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
