// One place to read / write the Settings screens. 28-Oct-2026.
//
// The screens still talk in their old key names (SMTP_HOST, sftp_username, whatsapp_mode ...), so /api/settings keeps
// working as before, but each key now lives in a column of its own table (models/SettingsTables.js):
//   key            -> table . column
// Keys that are not listed here (icegate_*, PO_DIRECTOR_PHONE ...) stay in the key/value table AppSetting.
//
// Secrets (passwords, keys) are never sent to the browser: GET gives '***' when set, and '***' / empty from the
// browser means "keep the saved one".
const AppSetting = require('../models/AppSetting');
const M = require('../models/SettingsTables');

const bool = { toDb: (v) => v === true || ['true', '1', 'yes', 'on', 'y'].includes(String(v).toLowerCase()), toKey: (v) => (v ? 'true' : 'false') };
const int = (lo, hi) => ({ toDb: (v) => { const n = parseInt(v, 10); if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`must be a number from ${lo} to ${hi}`); return n; }, toKey: (v) => (v == null ? '' : String(v)) });
const oneOf = (...vals) => ({ toDb: (v) => { const s = String(v).trim(); if (!vals.includes(s)) throw new Error('must be one of ' + vals.join(', ')); return s; }, toKey: (v) => (v == null ? '' : String(v)) });
const hhmm = { toDb: (v) => { const s = String(v).trim(); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new Error('must be a time HH:MM'); return s; }, toKey: (v) => v || '' };

// key -> [model, column, options]
const KEYS = {
  // Network / SFTP
  sftp_active_env: ['SftpConfig', 'activeEnv', oneOf('test', 'production')], sftp_host: ['SftpConfig', 'host'], sftp_test_host: ['SftpConfig', 'testHost'],
  sftp_prod_host: ['SftpConfig', 'prodHost'], sftp_port: ['SftpConfig', 'port', int(1, 65535)], sftp_username: ['SftpConfig', 'username'],
  sftp_password: ['SftpConfig', 'password', { secret: true }], sftp_private_key: ['SftpConfig', 'privateKey', { secret: true }],
  sftp_passphrase: ['SftpConfig', 'passphrase', { secret: true }], van_sender_pima: ['SftpConfig', 'vanSenderPima'], van_recipient_id: ['SftpConfig', 'vanRecipientId'],
  company_name: ['SftpConfig', 'vanCompanyName'], default_currency: ['SftpConfig', 'defaultCurrency'], default_charge_code: ['SftpConfig', 'defaultChargeCode'],
  // ULIP
  ULIP_USERNAME: ['UlipConfig', 'username'], ULIP_PASSWORD: ['UlipConfig', 'password', { secret: true }], ULIP_BASE_URL: ['UlipConfig', 'baseUrl'],
  // AI
  GEMINI_API_KEY: ['AiConfig', 'geminiApiKey', { secret: true }], CHATBOT_GEMINI: ['AiConfig', 'chatbotUseAi', { toDb: (v) => !['off', 'false', '0', 'no'].includes(String(v).trim().toLowerCase()), toKey: (v) => (v ? 'on' : 'off') }],
  // WhatsApp
  whatsapp_enabled: ['WhatsappConfig', 'enabled', bool], whatsapp_mode: ['WhatsappConfig', 'mode', oneOf('qr', 'api')], whatsapp_provider: ['WhatsappConfig', 'provider'],
  whatsapp_api_key: ['WhatsappConfig', 'apiKey', { secret: true }], whatsapp_from_number: ['WhatsappConfig', 'fromNumber'], whatsapp_sender_id: ['WhatsappConfig', 'senderId'],
  whatsapp_notify_mode: ['WhatsappConfig', 'notifyMode', oneOf('instant', 'scheduled')], whatsapp_notify_time: ['WhatsappConfig', 'notifyTime', hhmm],
  whatsapp_status_template: ['WhatsappConfig', 'statusTemplate'],
  whatsapp_template_name: ['WhatsappConfig', 'templateName', { toDb: (v) => { const s = String(v).trim(); if (!/^[a-z0-9_]{1,100}$/.test(s)) throw new Error('template name: small letters, numbers and _ only (as approved by Meta)'); return s; } }],
  whatsapp_template_lang: ['WhatsappConfig', 'templateLang', { toDb: (v) => { const s = String(v).trim(); if (!/^[a-z]{2,3}(_[A-Z]{2})?$/.test(s)) throw new Error('template language: e.g. en, en_US, hi'); return s; } }],
  whatsapp_template_namespace: ['WhatsappConfig', 'templateNamespace'],
  whatsapp_api_version: ['WhatsappConfig', 'apiVersion', { toDb: (v) => { const s = String(v).trim(); if (!/^v\d{2}\.\d$/.test(s)) throw new Error('API version: like v21.0'); return s; } }],
  // Email (SMTP)
  SMTP_HOST: ['EmailConfig', 'smtpHost'], SMTP_PORT: ['EmailConfig', 'smtpPort', int(1, 65535)], SMTP_USER: ['EmailConfig', 'smtpUser'],
  SMTP_PASS: ['EmailConfig', 'smtpPass', { secret: true }], SMTP_SECURE: ['EmailConfig', 'smtpSecure', bool], SMTP_FROM_NAME: ['EmailConfig', 'fromName'],
};
// dynamic keys: AI_MODEL_<MODULE>, AI_PROMPT_<MODULE>, email_tpl_<type> (JSON of the template)
const AI_RE = /^AI_(MODEL|PROMPT)_([A-Z0-9_]{1,30})$/;
const TPL_RE = /^email_tpl_([a-z0-9_]{1,40})$/;
const isMapped = (k) => !!KEYS[k] || AI_RE.test(k) || TPL_RE.test(k) || k === 'whatsapp_module_numbers';
const isSecretKey = (k) => {
  if (KEYS[k]) return !!(KEYS[k][2] && KEYS[k][2].secret);
  if (AI_RE.test(k) || TPL_RE.test(k)) return false; // email_tpl_password_reset is a template, not a password
  return /pass|secret|private_key|api_key|apikey|token/i.test(k);
};

let readyP = null; // one start-up run, shared by everyone who asks at the same time
function ready() {
  if (!readyP) readyP = (async () => { await AppSetting.sync(); for (const m of Object.values(M)) await m.sync(); await migrate(); })().catch(e => { readyP = null; throw e; });
  return readyP;
}
async function single(name, t) {
  const Mod = M[name];
  const r = await Mod.findByPk(1, { transaction: t });
  if (r) return r;
  try { return await Mod.create({ id: 1 }, { transaction: t }); }
  catch (e) { const again = await Mod.findByPk(1, { transaction: t }); if (again) return again; throw e; }
}

// copy the old AppSetting rows in, once (only into empty tables)
async function migrate() {
  const rows = await AppSetting.findAll().catch(() => []);
  const old = {}; rows.forEach(r => { old[r.key] = r.value; });
  for (const name of ['SftpConfig', 'UlipConfig', 'AiConfig', 'WhatsappConfig', 'EmailConfig']) {
    if (await M[name].count()) continue;
    const vals = {};
    for (const [k, [m, col, o]] of Object.entries(KEYS)) {
      if (m !== name || old[k] == null || old[k] === '' || old[k] === '***') continue;
      try { vals[col] = o && o.toDb ? o.toDb(old[k]) : old[k]; } catch (e) { /* bad old value: default */ }
    }
    await M[name].create({ id: 1, ...vals });
  }
  // the one ULIP API the software already used (Party Master > IEC lookup); later ones are added on the screen
  if (!(await M.UlipApi.count()) && !old.ulip_api_seeded) {
    await M.UlipApi.create({ apiCode: 'DGFT/01', apiName: 'IEC details (DGFT)', category: 'DGFT', method: 'POST', path: '/DGFT/01', requestTemplate: '{\n  "iecnumber": "{iec}"\n}', description: 'Importer-Exporter Code details. Used by Party Master > IEC lookup.' });
    await AppSetting.create({ key: 'ulip_api_seeded', value: '1', group: 'ulip', label: 'ulip_api_seeded' }).catch(() => {});
  }
  if (!(await M.AiModuleConfig.count())) {
    const mods = new Set(Object.keys(old).map(k => (AI_RE.exec(k) || [])[2]).filter(Boolean));
    for (const mt of mods) await M.AiModuleConfig.create({ moduleType: mt, model: old['AI_MODEL_' + mt] || null, prompt: old['AI_PROMPT_' + mt] || null });
  }
  if (!(await M.EmailTemplate.count())) {
    for (const k of Object.keys(old)) {
      const m = TPL_RE.exec(k); if (!m) continue;
      try { const j = JSON.parse(old[k] || '{}'); await M.EmailTemplate.create({ emailType: m[1], enabled: j.enabled !== false, subject: j.subject || null, body: j.body || null, notifyMode: j.notifyMode || 'instant', notifyTime: j.notifyTime || '09:00' }); } catch (e) { /* skip */ }
    }
  }
  if (!(await M.WhatsappModuleNumber.count()) && old.whatsapp_module_numbers) {
    try { for (const r of JSON.parse(old.whatsapp_module_numbers)) if (r && r.moduleName && r.phoneNumber) await M.WhatsappModuleNumber.create({ moduleName: r.moduleName, phoneNumber: r.phoneNumber }); } catch (e) { /* skip */ }
  }
}

const tplToKey = (r) => JSON.stringify({ enabled: !!r.enabled, subject: r.subject || '', body: r.body || '', notifyMode: r.notifyMode || 'instant', notifyTime: r.notifyTime || '09:00' });

// all settings as { key: value } (real values: for server use only)
async function getAll() {
  await ready();
  const out = {};
  (await AppSetting.findAll()).forEach(r => { if (!isMapped(r.key)) out[r.key] = r.value; });
  const rows = {};
  for (const [k, [m, col, o]] of Object.entries(KEYS)) {
    if (!rows[m]) rows[m] = await single(m);
    const v = rows[m][col];
    if (v == null || v === '') continue;
    out[k] = o && o.toKey ? o.toKey(v) : String(v);
  }
  (await M.AiModuleConfig.findAll()).forEach(r => { if (r.model) out['AI_MODEL_' + r.moduleType] = r.model; if (r.prompt) out['AI_PROMPT_' + r.moduleType] = r.prompt; });
  (await M.EmailTemplate.findAll()).forEach(r => { out['email_tpl_' + r.emailType] = tplToKey(r); });
  return out;
}
async function get(key, fallback) { const all = await getAll(); return all[key] != null && all[key] !== '' ? all[key] : fallback; }
async function getMany(keys) { const all = await getAll(); const o = {}; keys.forEach(k => { if (all[k] != null) o[k] = all[k]; }); return o; }

// for the browser: secrets masked
async function getPublic() {
  const all = await getAll(); const o = {};
  for (const [k, v] of Object.entries(all)) o[k] = isSecretKey(k) && v ? '***' : v;
  return o;
}

// save { key: value }. Empty / '***' secret = keep. Empty non-secret = clear. Bad values -> Error with all problems.
async function setMany(obj) {
  await ready();
  const errors = [];
  const plan = {}; const ai = {}; const tpl = {}; const loose = [];
  for (const [k, raw] of Object.entries(obj || {})) {
    if (raw !== null && typeof raw === 'object') { errors.push(`${k}: not a text value`); continue; }
    const v = raw == null ? '' : String(raw).trim() === '' ? '' : (typeof raw === 'string' ? raw : String(raw));
    if (KEYS[k]) {
      const [m, col, o] = KEYS[k];
      if (o && o.secret && (v === '' || v.startsWith('***'))) continue;
      if (k === 'sftp_private_key' && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(v)) { errors.push('sftp_private_key: not a PEM private key'); continue; }
      let dbv = v;
      if (v === '') dbv = null;
      else if (o && o.toDb) { try { dbv = o.toDb(v); } catch (e) { errors.push(`${k}: ${e.message}`); continue; } }
      (plan[m] = plan[m] || {})[col] = dbv;
    } else if (AI_RE.test(k)) {
      const [, what, mt] = AI_RE.exec(k); (ai[mt] = ai[mt] || {})[what === 'MODEL' ? 'model' : 'prompt'] = v || null;
    } else if (TPL_RE.test(k)) {
      try { const j = JSON.parse(v || '{}'); tpl[TPL_RE.exec(k)[1]] = j; } catch (e) { errors.push(`${k}: bad template data`); }
    } else if (k === 'whatsapp_module_numbers') {
      errors.push('whatsapp_module_numbers: use /api/whatsapp/module-numbers');
    } else {
      if (!/^[A-Za-z0-9_.-]{1,100}$/.test(k)) { errors.push(`${k}: bad key name`); continue; }
      loose.push([k, v]);
    }
  }
  if (errors.length) { const e = new Error(errors.join('; ')); e.status = 400; e.errors = errors; throw e; }
  const { sequelize } = require('../db');
  await sequelize.transaction(async (t) => {
    for (const [m, vals] of Object.entries(plan)) { const row = await single(m, t); await row.update(vals, { transaction: t }); }
    for (const [mt, vals] of Object.entries(ai)) {
      const [row] = await M.AiModuleConfig.findOrCreate({ where: { moduleType: mt }, defaults: { moduleType: mt }, transaction: t });
      await row.update(vals, { transaction: t });
    }
    for (const [type, j] of Object.entries(tpl)) {
      const [row] = await M.EmailTemplate.findOrCreate({ where: { emailType: type }, defaults: { emailType: type }, transaction: t });
      const nm = ['instant', 'scheduled'].includes(j.notifyMode) ? j.notifyMode : 'instant';
      const nt = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(j.notifyTime || '')) ? j.notifyTime : '09:00';
      await row.update({ enabled: j.enabled !== false, subject: j.subject != null ? String(j.subject).slice(0, 300) : row.subject, body: j.body != null ? String(j.body) : row.body, notifyMode: nm, notifyTime: nt }, { transaction: t });
    }
    for (const [k, v] of loose) {
      let group = 'general';
      if (k.startsWith('icegate_')) group = 'icegate';
      if (k.startsWith('van_')) group = 'freight';
      const row = await AppSetting.findOne({ where: { key: k }, transaction: t });
      if (row) await row.update({ value: v }, { transaction: t }); else await AppSetting.create({ key: k, value: v, group, label: k }, { transaction: t });
    }
  });
  return { saved: Object.keys(obj || {}).length };
}

// typed rows for code that wants them
async function row(name) { await ready(); return single(name); }

module.exports = { KEYS, ready, migrate, getAll, get, getMany, getPublic, setMany, row, isSecretKey, models: M };
