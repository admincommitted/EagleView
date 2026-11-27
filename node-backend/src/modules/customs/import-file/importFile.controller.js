import { detectInputFormat, extractPdfItems, parseBeInput, parseSbInput } from './importFile.service.js';

export async function parseBe(req, res) {
  res.json(parseBeInput(req.file, req.body));
}

export async function parseSb(req, res) {
  res.json(parseSbInput(req.file, req.body));
}

export async function detect(req, res) {
  res.json(detectInputFormat(req.body));
}

export async function extractItems(req, res) {
  res.json({ success: true, items: await extractPdfItems(req.file, req.body) });
}
