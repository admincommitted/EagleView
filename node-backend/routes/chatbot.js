/**
 * routes/chatbot.js - EagleView AI assistant (the robot chat at the bottom right). Added 28-Oct-2026.
 *
 *   GET    /api/chatbot/history?limit=60&before=<id>  - this user's saved chat (oldest first)
 *   POST   /api/chatbot/message { text, page }        - saves the question, answers it from the database, saves the answer
 *   DELETE /api/chatbot/history                       - clears this user's chat
 *
 * Answers come from our own tables: import / export jobs (job no, BE no, SB no, importer / IEC), job counts by status,
 * the Tariff master (BCD / IGST for an 8-digit CTH) and the Currency master (exchange rates). A question that matches
 * none of these goes to Gemini (the key already used by the PDF extractor, Settings > GEMINI_API_KEY) unless the setting
 * CHATBOT_GEMINI is "off"; only the chat text is sent, never job data. Without a key the bot lists what it can answer.
 */
const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const AppSetting = require('../models/AppSetting');
const { unpackExtra } = require('../utils/extraFields');

let ready = null;
const ensureTable = () => (ready = ready || ChatMessage.sync().catch(e => { ready = null; throw e; }));

const uid = (req) => String((req.user && (req.user.id || req.user.username)) || 'anon');
const uname = (req) => String((req.user && req.user.username) || '');
const fmtD = (v) => { const t = String(v || '').trim(); let m; if ((m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(t))) return `${m[3]}/${m[2]}/${m[1]}`; return t; };
const up = (r) => unpackExtra(r, 'extendedData');
const U = (v) => String(v || '').trim().toUpperCase();

const HELP = [
  'I can look these up in EagleView for you:',
  '• Job status - type a job no, e.g. "DEL/AI/0012/26"',
  '• BE / SB - "BE 4716067" or "SB 1234567"',
  '• Importer jobs - "jobs of <importer name>" or a 10-digit IEC',
  '• Summary - "today", "pending jobs", "how many drafts"',
  '• Duty rate - "duty 85171300" (BCD / IGST from the Tariff master)',
  '• Exchange rate - "rate USD"',
].join('\n');

// ---------- data helpers ----------
// 14-Nov-2026 (security check): job look-ups only in the branches the user may see (admin: all), like the job lists;
// the branches of the request ride along with AsyncLocalStorage (set in POST /message)
const { AsyncLocalStorage } = require('async_hooks');
const scopeStore = new AsyncLocalStorage();
function branchWhere() {
  const sc = scopeStore.getStore();
  if (!sc || !sc.branches) return {};
  const { fn, col, where } = require('sequelize');
  return where(fn('coalesce', fn('nullif', fn('upper', fn('trim', col('branchCode'))), ''), sc.def), { [Op.in]: sc.branches });
}
async function importJobs(limit = 3000) {
  const ImportJob = require('../models/ImportJob');
  return (await ImportJob.findAll({ where: branchWhere(), order: [['createdAt', 'DESC']], limit })).map(up);
}
async function exportJobs(limit = 3000) {
  const ExportJob = require('../models/ExportJob');
  return (await ExportJob.findAll({ where: branchWhere(), order: [['createdAt', 'DESC']], limit })).map(up);
}
const BOE = { HOME_CONSUMPTION: 'Home consumption (H)', WAREHOUSE: 'Warehouse (W)', EX_BOND: 'Ex-Bond (X)' };
const impName = (j) => j.autoField_4 || j.nameOfImporter || '';
const impLine = (j) => {
  const bits = [`Import job ${j.jobNo}`, j.jobDate ? `dated ${fmtD(j.jobDate)}` : ''].filter(Boolean).join(' ');
  return [
    bits,
    `• Status: ${j.status || 'DRAFT'}${j.icegateStatus ? ` | ICEGATE: ${j.icegateStatus}` : ''}`,
    `• Type: ${BOE[j.boeType] || j.boeType || '-'} | Mode: ${j.shipmentMode || '-'}`,
    impName(j) ? `• Importer: ${impName(j)}${j.autoField_5 || j.iecCode ? ` (IEC ${j.autoField_5 || j.iecCode})` : ''}` : '',
    j.beNo ? `• BE No: ${j.beNo}${j.beDate ? ' dt ' + fmtD(j.beDate) : ''}` : '• BE No: not filed yet',
    (j.invoices || []).length ? `• Invoices: ${(j.invoices || []).length}` : '',
  ].filter(Boolean).join('\n');
};
const expLine = (j) => [
  `Export job ${j.jobNo}${j.jobDate ? ' dated ' + fmtD(j.jobDate) : ''}`,
  `• Status: ${j.status || 'DRAFT'}${j.icegateStatus ? ` | ICEGATE: ${j.icegateStatus}` : ''}`,
  j.shipperName || j.exporterName ? `• Exporter: ${j.shipperName || j.exporterName}` : '',
  j.consigneeName ? `• Consignee: ${j.consigneeName}` : '',
  j.sbNo ? `• SB No: ${j.sbNo}${j.sbDate ? ' dt ' + fmtD(j.sbDate) : ''}` : '• SB No: not filed yet',
].filter(Boolean).join('\n');
const listLines = (rows, kind) => rows.slice(0, 8).map(j => `• ${j.jobNo} - ${j.status || 'DRAFT'}${kind === 'imp' ? (j.beNo ? ` - BE ${j.beNo}` : '') : (j.sbNo ? ` - SB ${j.sbNo}` : '')}${j.jobDate ? ' - ' + fmtD(j.jobDate) : ''}`).join('\n');

// ---------- intents (first match answers) ----------
const INTENTS = [
  { name: 'help', test: (t) => /^(help|\?|hi+|hello|hey|namaste|namaskar|menu|kya kar sakte|what can you do)\b/i.test(t.trim()),
    run: async () => ({ text: `Hello! ${HELP}` }) },

  { name: 'tariff', test: (t) => /\b\d{8}\b/.test(t) && (/duty|rate|tariff|ritc|cth|hs\b|hsn|bcd|igst|dut/i.test(t) || /^\s*\d{8}\s*$/.test(t)),
    run: async (t) => {
      const ritc = t.match(/\b\d{8}\b/)[0];
      const TariffHeader = require('../models/TariffHeader');
      const TariffComponent = require('../models/TariffComponent');
      const TariffDutyComponent = require('../models/TariffDutyComponent');
      if (!TariffHeader.associations.components) TariffHeader.hasMany(TariffComponent, { foreignKey: 'tariffHeaderId', as: 'components' });
      const h = await TariffHeader.findOne({ where: { hsnCode: ritc }, include: [{ model: TariffComponent, as: 'components' }] });
      let comps = h ? h.components : [];
      if (!comps || !comps.length) comps = await TariffDutyComponent.findAll({ where: { hsnCode: ritc } });
      if (!h && !comps.length) return { text: `CTH ${ritc} is not in the Tariff master.` };
      const rate = (re) => { const c = comps.find(x => re.test(String(x.dutyCategory || ''))); return c && c.rate != null && c.rate !== '' ? `${Number(c.rate)}%` : 'not given'; };
      return { text: [`CTH ${ritc}${h && h.description ? ' - ' + h.description : ''}`, `• BCD: ${rate(/BCD|BASIC/i)}`, `• IGST: ${rate(/IGST/i)}`, h && h.uqc ? `• UQC: ${h.uqc}` : '',
        'Tariff rate only: an exemption notification on the item can lower it.'].filter(Boolean).join('\n') };
    } },

  { name: 'rate', test: (t) => /(rate|exchange|ex\.? ?rate|currency)/i.test(t) && /\b[A-Za-z]{3}\b/.test(t),
    run: async (t) => {
      const Currency = require('../models/Currency');
      const codes = (t.match(/\b[A-Za-z]{3}\b/g) || []).map(U).filter(c => !['THE', 'FOR', 'AND', 'KYA', 'HAI', 'EXP', 'IMP', 'KAR'].includes(c));
      const rows = codes.length ? await Currency.findAll({ where: { currencyCode: { [Op.in]: codes } } }) : [];
      if (!rows.length) return null; // not a currency question after all
      return { text: rows.map(c => `${c.currencyCode}: import ${c.importRate} | export ${c.exportRate} INR${c.currencyName ? ' (' + c.currencyName + ')' : ''}`).join('\n') + '\nFrom the Currency master - update it when CBIC notifies new rates.' };
    } },

  { name: 'sb', test: (t) => /\b(sb|shipping bill)\b/i.test(t) && /\b\d{6,8}\b/.test(t),
    run: async (t) => {
      const no = t.match(/\b\d{6,8}\b/)[0];
      const hit = (await exportJobs()).filter(j => String(j.sbNo || '') === no);
      return { text: hit.length ? hit.map(expLine).join('\n\n') : `No export job has SB No ${no}.` };
    } },

  { name: 'be', test: (t) => (/\b(be|bill of entry|b\/e)\b/i.test(t) && /\b\d{6,8}\b/.test(t)) || /^\s*\d{7}\s*$/.test(t),
    run: async (t) => {
      const no = t.match(/\b\d{6,8}\b/)[0];
      const jobs = await importJobs();
      const hit = jobs.filter(j => String(j.beNo || '') === no);
      const wh = jobs.filter(j => String(j.warehouseBENo || '') === no);
      if (!hit.length && !wh.length) return { text: `No import job has BE No ${no}.` };
      return { text: [...hit.map(impLine), ...wh.map(j => `Ex-Bond job ${j.jobNo} clears warehouse BE ${no} (status ${j.status || 'DRAFT'})`)].join('\n\n') };
    } },

  { name: 'iec', test: (t) => /\b\d{10}\b/.test(t) || /\b[A-Z]{5}\d{4}[A-Z]\b/.test(U(t)),
    run: async (t) => {
      const iec = U((t.match(/\b\d{10}\b/) || U(t).match(/\b[A-Z]{5}\d{4}[A-Z]\b/))[0]);
      const rows = (await importJobs()).filter(j => U(j.autoField_5 || j.iecCode) === iec);
      if (!rows.length) return { text: `No import job for IEC ${iec}.` };
      return { text: `${rows.length} import job(s) for IEC ${iec} (${impName(rows[0])}), latest first:\n${listLines(rows, 'imp')}` };
    } },

  { name: 'job', test: (t) => /[A-Za-z]{2,}[\/-][A-Za-z0-9\/-]*\d/.test(t) || /\bjob\s*(no\.?|number|#)?\s*[:\-]?\s*[A-Za-z0-9\/-]*\d/i.test(t),
    run: async (t) => {
      const m = t.match(/[A-Za-z]{2,}[\/-][A-Za-z0-9\/-]*\d[A-Za-z0-9\/-]*/) || t.match(/\bjob\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Za-z0-9\/-]*\d[A-Za-z0-9\/-]*)/i);
      const key = U(m[1] || m[0]).replace(/[.,;]$/, '');
      const imp = (await importJobs()).filter(j => U(j.jobNo) === key || U(j.jobNo).includes(key));
      const exp = (await exportJobs()).filter(j => U(j.jobNo) === key || U(j.jobNo).includes(key));
      const all = [...imp.map(j => ({ j, k: 'imp' })), ...exp.map(j => ({ j, k: 'exp' }))];
      if (!all.length) return { text: `I could not find job "${key}". Check the job no, or search it in 1. Job Query.` };
      const exact = all.filter(x => U(x.j.jobNo) === key);
      const show = exact.length ? exact : all;
      if (show.length > 1 && !exact.length) return { text: `${show.length} jobs match "${key}":\n` + show.slice(0, 8).map(x => `• ${x.j.jobNo} (${x.k === 'imp' ? 'import' : 'export'}) - ${x.j.status || 'DRAFT'}`).join('\n') };
      return { text: show.slice(0, 3).map(x => (x.k === 'imp' ? impLine(x.j) : expLine(x.j))).join('\n\n') };
    } },

  { name: 'importer', test: (t) => /\b(jobs?\s+(of|for)|importer|party|client)\b/i.test(t),
    run: async (t) => {
      const name = t.replace(/.*\b(jobs?\s+(of|for)|importer|party|client)\b\s*(name)?\s*[:\-]?/i, '').replace(/\b(ke|ki|ka|jobs?|status|batao|dikhao)\b/gi, '').trim();
      if (name.length < 3) return { text: 'Give at least 3 letters of the importer name, e.g. "jobs of OPTIMUS".' };
      const rows = (await importJobs()).filter(j => U(impName(j)).includes(U(name)));
      if (!rows.length) return { text: `No import job for an importer like "${name}".` };
      return { text: `${rows.length} import job(s) for "${name}", latest first:\n${listLines(rows, 'imp')}` };
    } },

  { name: 'summary', test: (t) => /(summary|status|kitne|kitni|how many|count|pending|draft|today|aaj|filed|dashboard|report)/i.test(t),
    run: async (t) => {
      const [imp, exp] = [await importJobs(5000), await exportJobs(5000)];
      const today = new Date().toISOString().slice(0, 10);
      const isToday = (j) => String(j.jobDate || j.createdAt && new Date(j.createdAt).toISOString() || '').slice(0, 10) === today;
      const by = (rows) => rows.reduce((a, j) => { const s = U(j.status) || 'DRAFT'; a[s] = (a[s] || 0) + 1; return a; }, {});
      const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
      const lines = [`Import jobs: ${imp.length} (${fmt(by(imp))})`, `Export jobs: ${exp.length} (${fmt(by(exp))})`,
        `Created today: import ${imp.filter(isToday).length}, export ${exp.filter(isToday).length}`];
      if (/pending|draft/i.test(t)) {
        const pend = imp.filter(j => !j.beNo && U(j.status) !== 'CANCELLED');
        lines.push(`Import jobs without BE No: ${pend.length}${pend.length ? '\n' + listLines(pend, 'imp') : ''}`);
      }
      return { text: lines.join('\n') };
    } },
];

// ---------- Gemini fallback (chat text only) ----------
async function geminiAnswer(history, text) {
  const cfg = await require('../utils/settingsStore').getMany(['CHATBOT_GEMINI', 'GEMINI_API_KEY']); // table AiConfig
  if (String(cfg.CHATBOT_GEMINI || '').toLowerCase() === 'off') return null;
  const key = cfg.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) return null;
  let GoogleGenerativeAI;
  try { ({ GoogleGenerativeAI } = require('@google/generative-ai')); } catch (e) { return null; }
  const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.5-flash' });
  const sys = 'You are EagleView AI, the assistant inside EagleView 360, a customs and freight software used by an Indian customs broker '
    + '(Bill of Entry / Shipping Bill filing on ICEGATE, invoices, duty, e-Sanchit, warehouse and ex-bond). Answer briefly and practically, '
    + 'in the language the user writes (English or Hinglish). You cannot see the user\'s jobs: for a job, BE, SB, importer, duty or exchange '
    + 'rate tell them to type the job no / BE no / CTH / currency so the app can look it up. Do not invent notification numbers or rates.';
  const convo = history.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const r = await model.generateContent(`${sys}\n\n${convo}\nUser: ${text}\nAssistant:`);
  const out = String((r && r.response && r.response.text && r.response.text()) || '').trim();
  return out ? out.slice(0, 4000) : null;
}

async function answer(text, history) {
  for (const it of INTENTS) {
    if (!it.test(text)) continue;
    try {
      const r = await it.run(text);
      if (r) return { ...r, intent: it.name };
    } catch (e) {
      console.warn('[chatbot]', it.name, e.message);
      return { text: 'Sorry, I could not read that from the database just now. Please try again.', intent: it.name + ':error' };
    }
  }
  try {
    const g = await geminiAnswer(history, text);
    if (g) return { text: g, intent: 'ai' };
  } catch (e) { console.warn('[chatbot] gemini:', e.message); }
  return { text: `I did not understand that yet.\n${HELP}`, intent: 'unknown' };
}

// ---------- routes ----------
router.get('/history', async (req, res) => {
  try {
    await ensureTable();
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 60);
    const where = { userId: uid(req) };
    if (req.query.before) where.id = { [Op.lt]: parseInt(req.query.before, 10) };
    const rows = await ChatMessage.findAll({ where, order: [['id', 'DESC']], limit });
    res.json({ success: true, data: rows.reverse().map(r => ({ id: r.id, role: r.role, text: r.text, intent: r.intent, createdAt: r.createdAt })), more: rows.length === limit });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/message', async (req, res) => {
  try {
    await ensureTable();
    const text = String((req.body && req.body.text) || '').trim().slice(0, 2000);
    if (!text) return res.status(400).json({ success: false, error: 'Empty message' });
    const page = String((req.body && req.body.page) || '').slice(0, 120);
    const history = (await ChatMessage.findAll({ where: { userId: uid(req) }, order: [['id', 'DESC']], limit: 10 })).reverse();
    const q = await ChatMessage.create({ userId: uid(req), username: uname(req), role: 'user', text, page });
    const bs = require('../utils/branchScope');
    const branches = await bs.allowedFor(req.user);
    const def = branches ? ((await bs.allowedFor(null)) || ['DEL'])[0] : 'DEL';
    const a = await scopeStore.run({ branches, def }, () => answer(text, history));
    const b = await ChatMessage.create({ userId: uid(req), username: uname(req), role: 'bot', text: a.text, intent: a.intent, page });
    res.json({ success: true, data: [q, b].map(r => ({ id: r.id, role: r.role, text: r.text, intent: r.intent, createdAt: r.createdAt })) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.delete('/history', async (req, res) => {
  try {
    await ensureTable();
    const n = await ChatMessage.destroy({ where: { userId: uid(req) } });
    res.json({ success: true, deleted: n });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
module.exports.answer = answer;
