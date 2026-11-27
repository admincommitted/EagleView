// One place to read / write the Settings screens.
//
// The screens talk in their key names (SMTP_HOST, sftp_username, whatsapp_mode ...), so /api/settings keeps the same
// shape, but each key lives in a column of its own table (models/SettingsTables.js):
//   key            -> table . column
// Keys that are not listed here (icegate_*, PO_DIRECTOR_PHONE ...) stay in the key/value table AppSetting.
//
// Secrets (passwords, keys) are never sent to the browser: GET gives '***' when set, and '***' / empty from the
// browser means "keep the saved one".
import { sequelize } from '../../config/database.js';
import {
  AppSetting,
  CompanyProfile,
  SftpConfig,
  UlipConfig,
  UlipApi,
  AiConfig,
  AiModuleConfig,
  WhatsappConfig,
  WhatsappModuleNumber,
  EmailConfig,
  EmailTemplate,
} from '../../models/index.js';

// the settings tables, by model name (same order as models/SettingsTables.js: ready() syncs them in this order)
const M = {
  CompanyProfile,
  SftpConfig,
  UlipConfig,
  UlipApi,
  AiConfig,
  AiModuleConfig,
  WhatsappConfig,
  WhatsappModuleNumber,
  EmailConfig,
  EmailTemplate,
};

const SINGLE_ROW_ID = 1;
const SECRET_MASK = '***';
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_NOTIFY_MODE = 'instant';
const DEFAULT_NOTIFY_TIME = '09:00';
const NOTIFY_MODES = ['instant', 'scheduled'];
const TEMPLATE_SUBJECT_MAX = 300;

const keyText = (value) => (value == null ? '' : String(value));

const bool = {
  toDb: (value) => value === true || ['true', '1', 'yes', 'on', 'y'].includes(String(value).toLowerCase()),
  toKey: (value) => (value ? 'true' : 'false'),
};

const int = (low, high) => ({
  toDb: (value) => {
    const number = parseInt(value, 10);
    if (!Number.isFinite(number) || number < low || number > high)
      throw new Error(`must be a number from ${low} to ${high}`);
    return number;
  },
  toKey: keyText,
});

const oneOf = (...allowed) => ({
  toDb: (value) => {
    const text = String(value).trim();
    if (!allowed.includes(text)) throw new Error('must be one of ' + allowed.join(', '));
    return text;
  },
  toKey: keyText,
});

const hhmm = {
  toDb: (value) => {
    const text = String(value).trim();
    if (!HHMM.test(text)) throw new Error('must be a time HH:MM');
    return text;
  },
  toKey: (value) => value || '',
};

// a trimmed text that must match pattern, else Error(message)
const matching = (pattern, message) => ({
  toDb: (value) => {
    const text = String(value).trim();
    if (!pattern.test(text)) throw new Error(message);
    return text;
  },
});

const onOff = {
  toDb: (value) => !['off', 'false', '0', 'no'].includes(String(value).trim().toLowerCase()),
  toKey: (value) => (value ? 'on' : 'off'),
};

const secret = { secret: true };

// key -> [model, column, options]
const KEYS = {
  // Network / SFTP
  sftp_active_env: ['SftpConfig', 'activeEnv', oneOf('test', 'production')],
  sftp_host: ['SftpConfig', 'host'],
  sftp_test_host: ['SftpConfig', 'testHost'],
  sftp_prod_host: ['SftpConfig', 'prodHost'],
  sftp_port: ['SftpConfig', 'port', int(1, 65535)],
  sftp_username: ['SftpConfig', 'username'],
  sftp_password: ['SftpConfig', 'password', secret],
  sftp_private_key: ['SftpConfig', 'privateKey', secret],
  sftp_passphrase: ['SftpConfig', 'passphrase', secret],
  van_sender_pima: ['SftpConfig', 'vanSenderPima'],
  van_recipient_id: ['SftpConfig', 'vanRecipientId'],
  company_name: ['SftpConfig', 'vanCompanyName'],
  default_currency: ['SftpConfig', 'defaultCurrency'],
  default_charge_code: ['SftpConfig', 'defaultChargeCode'],
  // ULIP
  ULIP_USERNAME: ['UlipConfig', 'username'],
  ULIP_PASSWORD: ['UlipConfig', 'password', secret],
  ULIP_BASE_URL: ['UlipConfig', 'baseUrl'],
  // AI
  GEMINI_API_KEY: ['AiConfig', 'geminiApiKey', secret],
  CHATBOT_GEMINI: ['AiConfig', 'chatbotUseAi', onOff],
  // WhatsApp
  whatsapp_enabled: ['WhatsappConfig', 'enabled', bool],
  whatsapp_mode: ['WhatsappConfig', 'mode', oneOf('qr', 'api')],
  whatsapp_provider: ['WhatsappConfig', 'provider'],
  whatsapp_api_key: ['WhatsappConfig', 'apiKey', secret],
  whatsapp_from_number: ['WhatsappConfig', 'fromNumber'],
  whatsapp_sender_id: ['WhatsappConfig', 'senderId'],
  whatsapp_notify_mode: ['WhatsappConfig', 'notifyMode', oneOf('instant', 'scheduled')],
  whatsapp_notify_time: ['WhatsappConfig', 'notifyTime', hhmm],
  whatsapp_status_template: ['WhatsappConfig', 'statusTemplate'],
  whatsapp_template_name: [
    'WhatsappConfig',
    'templateName',
    matching(/^[a-z0-9_]{1,100}$/, 'template name: small letters, numbers and _ only (as approved by Meta)'),
  ],
  whatsapp_template_lang: [
    'WhatsappConfig',
    'templateLang',
    matching(/^[a-z]{2,3}(_[A-Z]{2})?$/, 'template language: e.g. en, en_US, hi'),
  ],
  whatsapp_template_namespace: ['WhatsappConfig', 'templateNamespace'],
  whatsapp_api_version: ['WhatsappConfig', 'apiVersion', matching(/^v\d{2}\.\d$/, 'API version: like v21.0')],
  // Email (SMTP)
  SMTP_HOST: ['EmailConfig', 'smtpHost'],
  SMTP_PORT: ['EmailConfig', 'smtpPort', int(1, 65535)],
  SMTP_USER: ['EmailConfig', 'smtpUser'],
  SMTP_PASS: ['EmailConfig', 'smtpPass', secret],
  SMTP_SECURE: ['EmailConfig', 'smtpSecure', bool],
  SMTP_FROM_NAME: ['EmailConfig', 'fromName'],
};

// dynamic keys: AI_MODEL_<MODULE>, AI_PROMPT_<MODULE>, email_tpl_<type> (JSON of the template)
const AI_KEY = /^AI_(MODEL|PROMPT)_([A-Z0-9_]{1,30})$/;
const TEMPLATE_KEY = /^email_tpl_([a-z0-9_]{1,40})$/;
const MODULE_NUMBERS_KEY = 'whatsapp_module_numbers';
const LOOSE_KEY_NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const PEM_PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_LOOKING_KEY = /pass|secret|private_key|api_key|apikey|token/i;
// tables seeded once from the old AppSetting rows
const MIGRATED_TABLES = ['SftpConfig', 'UlipConfig', 'AiConfig', 'WhatsappConfig', 'EmailConfig'];

const isMapped = (key) => !!KEYS[key] || AI_KEY.test(key) || TEMPLATE_KEY.test(key) || key === MODULE_NUMBERS_KEY;

const isSecretKey = (key) => {
  if (KEYS[key]) return !!(KEYS[key][2] && KEYS[key][2].secret);
  if (AI_KEY.test(key) || TEMPLATE_KEY.test(key)) return false; // email_tpl_password_reset is a template, not a password
  return SECRET_LOOKING_KEY.test(key);
};

let readyPromise = null; // one start-up run, shared by everyone who asks at the same time

async function prepareTables() {
  await AppSetting.sync();
  for (const model of Object.values(M)) await model.sync();
  await migrate();
}

function ready() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        await prepareTables();
      } catch (error) {
        readyPromise = null;
        throw error;
      }
    })();
  }
  return readyPromise;
}

// the one row (id 1) of a single-row settings table; created when missing
async function single(name, transaction) {
  const Model = M[name];
  const existing = await Model.findByPk(SINGLE_ROW_ID, { transaction });
  if (existing) return existing;
  try {
    return await Model.create({ id: SINGLE_ROW_ID }, { transaction });
  } catch (error) {
    const createdMeanwhile = await Model.findByPk(SINGLE_ROW_ID, { transaction });
    if (createdMeanwhile) return createdMeanwhile;
    throw error;
  }
}

async function readOldAppSettings() {
  let rows;
  try {
    rows = await AppSetting.findAll();
  } catch {
    rows = [];
  }
  const old = {};
  rows.forEach((row) => {
    old[row.key] = row.value;
  });
  return old;
}

async function migrateSingleRowTables(old) {
  for (const name of MIGRATED_TABLES) {
    if (await M[name].count()) continue;
    const values = {};
    for (const [key, [model, column, options]] of Object.entries(KEYS)) {
      if (model !== name || old[key] == null || old[key] === '' || old[key] === SECRET_MASK) continue;
      try {
        values[column] = options && options.toDb ? options.toDb(old[key]) : old[key];
      } catch {
        /* bad old value: default */
      }
    }
    await M[name].create({ id: SINGLE_ROW_ID, ...values });
  }
}

// the one ULIP API the software already used (Party Master > IEC lookup); later ones are added on the screen
async function seedUlipApi(old) {
  if ((await M.UlipApi.count()) || old.ulip_api_seeded) return;
  await M.UlipApi.create({
    apiCode: 'DGFT/01',
    apiName: 'IEC details (DGFT)',
    category: 'DGFT',
    method: 'POST',
    path: '/DGFT/01',
    requestTemplate: '{\n  "iecnumber": "{iec}"\n}',
    description: 'Importer-Exporter Code details. Used by Party Master > IEC lookup.',
  });
  try {
    await AppSetting.create({ key: 'ulip_api_seeded', value: '1', group: 'ulip', label: 'ulip_api_seeded' });
  } catch {
    /* already marked */
  }
}

async function migrateAiModules(old) {
  if (await M.AiModuleConfig.count()) return;
  const moduleTypes = new Set(
    Object.keys(old)
      .map((key) => (AI_KEY.exec(key) || [])[2])
      .filter(Boolean),
  );
  for (const moduleType of moduleTypes) {
    await M.AiModuleConfig.create({
      moduleType,
      model: old['AI_MODEL_' + moduleType] || null,
      prompt: old['AI_PROMPT_' + moduleType] || null,
    });
  }
}

async function migrateEmailTemplates(old) {
  if (await M.EmailTemplate.count()) return;
  for (const key of Object.keys(old)) {
    const match = TEMPLATE_KEY.exec(key);
    if (!match) continue;
    try {
      const template = JSON.parse(old[key] || '{}');
      await M.EmailTemplate.create({
        emailType: match[1],
        enabled: template.enabled !== false,
        subject: template.subject || null,
        body: template.body || null,
        notifyMode: template.notifyMode || DEFAULT_NOTIFY_MODE,
        notifyTime: template.notifyTime || DEFAULT_NOTIFY_TIME,
      });
    } catch {
      /* skip */
    }
  }
}

async function migrateModuleNumbers(old) {
  if ((await M.WhatsappModuleNumber.count()) || !old[MODULE_NUMBERS_KEY]) return;
  try {
    for (const entry of JSON.parse(old[MODULE_NUMBERS_KEY])) {
      if (entry && entry.moduleName && entry.phoneNumber) {
        await M.WhatsappModuleNumber.create({ moduleName: entry.moduleName, phoneNumber: entry.phoneNumber });
      }
    }
  } catch {
    /* skip */
  }
}

// copy the old AppSetting rows in, once (only into empty tables)
async function migrate() {
  const old = await readOldAppSettings();
  await migrateSingleRowTables(old);
  await seedUlipApi(old);
  await migrateAiModules(old);
  await migrateEmailTemplates(old);
  await migrateModuleNumbers(old);
}

const templateToKey = (template) =>
  JSON.stringify({
    enabled: !!template.enabled,
    subject: template.subject || '',
    body: template.body || '',
    notifyMode: template.notifyMode || DEFAULT_NOTIFY_MODE,
    notifyTime: template.notifyTime || DEFAULT_NOTIFY_TIME,
  });

/** All settings as { key: value } (real values: for server use only). */
async function getAll() {
  await ready();
  const all = {};
  (await AppSetting.findAll()).forEach((setting) => {
    if (!isMapped(setting.key)) all[setting.key] = setting.value;
  });
  const rowsByModel = {};
  for (const [key, [model, column, options]] of Object.entries(KEYS)) {
    if (!rowsByModel[model]) rowsByModel[model] = await single(model);
    const value = rowsByModel[model][column];
    if (value == null || value === '') continue;
    all[key] = options && options.toKey ? options.toKey(value) : String(value);
  }
  (await M.AiModuleConfig.findAll()).forEach((aiModule) => {
    if (aiModule.model) all['AI_MODEL_' + aiModule.moduleType] = aiModule.model;
    if (aiModule.prompt) all['AI_PROMPT_' + aiModule.moduleType] = aiModule.prompt;
  });
  (await M.EmailTemplate.findAll()).forEach((template) => {
    all['email_tpl_' + template.emailType] = templateToKey(template);
  });
  return all;
}

async function get(key, fallback) {
  const all = await getAll();
  return all[key] != null && all[key] !== '' ? all[key] : fallback;
}

async function getMany(keys) {
  const all = await getAll();
  const picked = {};
  keys.forEach((key) => {
    if (all[key] != null) picked[key] = all[key];
  });
  return picked;
}

/** For the browser: secrets masked. */
async function getPublic() {
  const all = await getAll();
  const masked = {};
  for (const [key, value] of Object.entries(all)) masked[key] = isSecretKey(key) && value ? SECRET_MASK : value;
  return masked;
}

function normalisedInput(raw) {
  if (raw == null) return '';
  if (String(raw).trim() === '') return '';
  return typeof raw === 'string' ? raw : String(raw);
}

// Sorts the incoming keys into what goes where; collects every problem instead of stopping at the first
function planChanges(input) {
  const errors = [];
  const tableChanges = {};
  const aiChanges = {};
  const templateChanges = {};
  const looseChanges = [];
  for (const [key, raw] of Object.entries(input || {})) {
    if (raw !== null && typeof raw === 'object') {
      errors.push(`${key}: not a text value`);
      continue;
    }
    const value = normalisedInput(raw);
    if (KEYS[key]) {
      const [model, column, options] = KEYS[key];
      if (options && options.secret && (value === '' || value.startsWith(SECRET_MASK))) continue;
      if (key === 'sftp_private_key' && !PEM_PRIVATE_KEY.test(value)) {
        errors.push('sftp_private_key: not a PEM private key');
        continue;
      }
      let dbValue = value;
      if (value === '') {
        dbValue = null;
      } else if (options && options.toDb) {
        try {
          dbValue = options.toDb(value);
        } catch (error) {
          errors.push(`${key}: ${error.message}`);
          continue;
        }
      }
      (tableChanges[model] = tableChanges[model] || {})[column] = dbValue;
    } else if (AI_KEY.test(key)) {
      const [, what, moduleType] = AI_KEY.exec(key);
      (aiChanges[moduleType] = aiChanges[moduleType] || {})[what === 'MODEL' ? 'model' : 'prompt'] = value || null;
    } else if (TEMPLATE_KEY.test(key)) {
      try {
        templateChanges[TEMPLATE_KEY.exec(key)[1]] = JSON.parse(value || '{}');
      } catch {
        errors.push(`${key}: bad template data`);
      }
    } else if (key === MODULE_NUMBERS_KEY) {
      errors.push('whatsapp_module_numbers: use /api/whatsapp/module-numbers');
    } else {
      if (!LOOSE_KEY_NAME.test(key)) {
        errors.push(`${key}: bad key name`);
        continue;
      }
      looseChanges.push([key, value]);
    }
  }
  return { errors, tableChanges, aiChanges, templateChanges, looseChanges };
}

function settingsValidationError(errors) {
  const error = new Error(errors.join('; '));
  error.status = 400;
  error.errors = errors;
  return error;
}

async function saveTemplate(type, template, transaction) {
  const [row] = await M.EmailTemplate.findOrCreate({
    where: { emailType: type },
    defaults: { emailType: type },
    transaction,
  });
  const notifyMode = NOTIFY_MODES.includes(template.notifyMode) ? template.notifyMode : DEFAULT_NOTIFY_MODE;
  const notifyTime = HHMM.test(String(template.notifyTime || '')) ? template.notifyTime : DEFAULT_NOTIFY_TIME;
  await row.update(
    {
      enabled: template.enabled !== false,
      subject: template.subject != null ? String(template.subject).slice(0, TEMPLATE_SUBJECT_MAX) : row.subject,
      body: template.body != null ? String(template.body) : row.body,
      notifyMode,
      notifyTime,
    },
    { transaction },
  );
}

function groupOfLooseKey(key) {
  let group = 'general';
  if (key.startsWith('icegate_')) group = 'icegate';
  if (key.startsWith('van_')) group = 'freight';
  return group;
}

async function saveLooseSetting(key, value, transaction) {
  const row = await AppSetting.findOne({ where: { key }, transaction });
  if (row) {
    await row.update({ value }, { transaction });
    return;
  }
  await AppSetting.create({ key, value, group: groupOfLooseKey(key), label: key }, { transaction });
}

/** Save { key: value }. Empty / '***' secret = keep. Empty non-secret = clear. Bad values -> Error with all problems. */
async function setMany(input) {
  await ready();
  const { errors, tableChanges, aiChanges, templateChanges, looseChanges } = planChanges(input);
  if (errors.length) throw settingsValidationError(errors);
  await sequelize.transaction(async (transaction) => {
    for (const [model, values] of Object.entries(tableChanges)) {
      const row = await single(model, transaction);
      await row.update(values, { transaction });
    }
    for (const [moduleType, values] of Object.entries(aiChanges)) {
      const [row] = await M.AiModuleConfig.findOrCreate({
        where: { moduleType },
        defaults: { moduleType },
        transaction,
      });
      await row.update(values, { transaction });
    }
    for (const [type, template] of Object.entries(templateChanges)) await saveTemplate(type, template, transaction);
    for (const [key, value] of looseChanges) await saveLooseSetting(key, value, transaction);
  });
  return { saved: Object.keys(input || {}).length };
}

/** Typed rows for code that wants them. */
async function row(name) {
  await ready();
  return single(name);
}

export { KEYS, ready, migrate, getAll, get, getMany, getPublic, setMany, row, M as models };
