import { AsyncLocalStorage } from 'node:async_hooks';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { col, fn, Op, where } from 'sequelize';
import {
  Currency,
  ExportJob,
  ImportJob,
  TariffComponent,
  TariffDutyComponent,
  TariffHeader,
} from '../../../models/index.js';
import * as settingsStore from '../../../utils/common/settingsStore.js';
import { unpackExtra } from '../../../utils/db/extraFields.js';

// The chat answers from our own tables: import / export jobs, job counts by status, the Tariff master and the Currency
// master. A question that matches none of these goes to Gemini (chat text only, never job data) unless CHATBOT_GEMINI is
// "off"; without a key the bot lists what it can answer.
const JOBS_READ = 3000;
const JOBS_READ_FOR_SUMMARY = 5000;
const LINES_LISTED = 8;
const JOBS_SHOWN = 3;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_HISTORY_MESSAGES = 10;
const GEMINI_ANSWER_LENGTH = 4000;
const NOT_CURRENCY_CODES = ['THE', 'FOR', 'AND', 'KYA', 'HAI', 'EXP', 'IMP', 'KAR'];
const BOE_TYPES = { HOME_CONSUMPTION: 'Home consumption (H)', WAREHOUSE: 'Warehouse (W)', EX_BOND: 'Ex-Bond (X)' };
const GEMINI_INSTRUCTIONS =
  'You are EagleView AI, the assistant inside EagleView 360, a customs and freight software used by an Indian customs broker ' +
  '(Bill of Entry / Shipping Bill filing on ICEGATE, invoices, duty, e-Sanchit, warehouse and ex-bond). Answer briefly and practically, ' +
  "in the language the user writes (English or Hinglish). You cannot see the user's jobs: for a job, BE, SB, importer, duty or exchange " +
  'rate tell them to type the job no / BE no / CTH / currency so the app can look it up. Do not invent notification numbers or rates.';

export const HELP = [
  'I can look these up in EagleView for you:',
  '• Job status - type a job no, e.g. "DEL/AI/0012/26"',
  '• BE / SB - "BE 4716067" or "SB 1234567"',
  '• Importer jobs - "jobs of <importer name>" or a 10-digit IEC',
  '• Summary - "today", "pending jobs", "how many drafts"',
  '• Duty rate - "duty 85171300" (BCD / IGST from the Tariff master)',
  '• Exchange rate - "rate USD"',
].join('\n');

// job look-ups only in the branches the user may see (admin: all), like the job lists; the branches of the request
// ride along with the question
export const branchScopeStore = new AsyncLocalStorage();

function branchWhere() {
  const scope = branchScopeStore.getStore();
  if (!scope || !scope.branches) return {};
  return where(fn('coalesce', fn('nullif', fn('upper', fn('trim', col('branchCode'))), ''), scope.def), {
    [Op.in]: scope.branches,
  });
}

const withExtraFields = (row) => unpackExtra(row, 'extendedData');
const upper = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

const displayDate = (value) => {
  const text = String(value || '').trim();
  const match = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(text);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text;
};

async function importJobs(limit = JOBS_READ) {
  return (await ImportJob.findAll({ where: branchWhere(), order: [['createdAt', 'DESC']], limit })).map(
    withExtraFields,
  );
}

async function exportJobs(limit = JOBS_READ) {
  return (await ExportJob.findAll({ where: branchWhere(), order: [['createdAt', 'DESC']], limit })).map(
    withExtraFields,
  );
}

const importerName = (job) => job.autoField_4 || job.nameOfImporter || '';

function importJobText(job) {
  const heading = [`Import job ${job.jobNo}`, job.jobDate ? `dated ${displayDate(job.jobDate)}` : '']
    .filter(Boolean)
    .join(' ');
  const iec = job.autoField_5 || job.iecCode;
  return [
    heading,
    `• Status: ${job.status || 'DRAFT'}${job.icegateStatus ? ` | ICEGATE: ${job.icegateStatus}` : ''}`,
    `• Type: ${BOE_TYPES[job.boeType] || job.boeType || '-'} | Mode: ${job.shipmentMode || '-'}`,
    importerName(job) ? `• Importer: ${importerName(job)}${iec ? ` (IEC ${iec})` : ''}` : '',
    job.beNo ? `• BE No: ${job.beNo}${job.beDate ? ' dt ' + displayDate(job.beDate) : ''}` : '• BE No: not filed yet',
    (job.invoices || []).length ? `• Invoices: ${(job.invoices || []).length}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const exportJobText = (job) =>
  [
    `Export job ${job.jobNo}${job.jobDate ? ' dated ' + displayDate(job.jobDate) : ''}`,
    `• Status: ${job.status || 'DRAFT'}${job.icegateStatus ? ` | ICEGATE: ${job.icegateStatus}` : ''}`,
    job.shipperName || job.exporterName ? `• Exporter: ${job.shipperName || job.exporterName}` : '',
    job.consigneeName ? `• Consignee: ${job.consigneeName}` : '',
    job.sbNo ? `• SB No: ${job.sbNo}${job.sbDate ? ' dt ' + displayDate(job.sbDate) : ''}` : '• SB No: not filed yet',
  ]
    .filter(Boolean)
    .join('\n');

function jobListLines(jobs, kind) {
  return jobs
    .slice(0, LINES_LISTED)
    .map((job) => {
      const filedNo = kind === 'imp' ? (job.beNo ? ` - BE ${job.beNo}` : '') : job.sbNo ? ` - SB ${job.sbNo}` : '';
      return `• ${job.jobNo} - ${job.status || 'DRAFT'}${filedNo}${job.jobDate ? ' - ' + displayDate(job.jobDate) : ''}`;
    })
    .join('\n');
}

function ensureTariffComponentsLink() {
  if (!TariffHeader.associations.components)
    TariffHeader.hasMany(TariffComponent, { foreignKey: 'tariffHeaderId', as: 'components' });
}

async function tariffAnswer(text) {
  const cth = text.match(/\b\d{8}\b/)[0];
  ensureTariffComponentsLink();
  const header = await TariffHeader.findOne({
    where: { hsnCode: cth },
    include: [{ model: TariffComponent, as: 'components' }],
  });
  let components = header ? header.components : [];
  if (!components || !components.length) components = await TariffDutyComponent.findAll({ where: { hsnCode: cth } });
  if (!header && !components.length) return { text: `CTH ${cth} is not in the Tariff master.` };
  const rate = (pattern) => {
    const component = components.find((entry) => pattern.test(String(entry.dutyCategory || '')));
    return component && component.rate != null && component.rate !== '' ? `${Number(component.rate)}%` : 'not given';
  };
  return {
    text: [
      `CTH ${cth}${header && header.description ? ' - ' + header.description : ''}`,
      `• BCD: ${rate(/BCD|BASIC/i)}`,
      `• IGST: ${rate(/IGST/i)}`,
      header && header.uqc ? `• UQC: ${header.uqc}` : '',
      'Tariff rate only: an exemption notification on the item can lower it.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

async function exchangeRateAnswer(text) {
  const codes = (text.match(/\b[A-Za-z]{3}\b/g) || []).map(upper).filter((code) => !NOT_CURRENCY_CODES.includes(code));
  const currencies = codes.length ? await Currency.findAll({ where: { currencyCode: { [Op.in]: codes } } }) : [];
  // not a currency question after all
  if (!currencies.length) return null;
  const lines = currencies.map(
    (currency) =>
      `${currency.currencyCode}: import ${currency.importRate} | export ${currency.exportRate} INR` +
      `${currency.currencyName ? ' (' + currency.currencyName + ')' : ''}`,
  );
  return { text: lines.join('\n') + '\nFrom the Currency master - update it when CBIC notifies new rates.' };
}

async function shippingBillAnswer(text) {
  const number = text.match(/\b\d{6,8}\b/)[0];
  const jobs = (await exportJobs()).filter((job) => String(job.sbNo || '') === number);
  return { text: jobs.length ? jobs.map(exportJobText).join('\n\n') : `No export job has SB No ${number}.` };
}

async function billOfEntryAnswer(text) {
  const number = text.match(/\b\d{6,8}\b/)[0];
  const jobs = await importJobs();
  const filedJobs = jobs.filter((job) => String(job.beNo || '') === number);
  const exBondJobs = jobs.filter((job) => String(job.warehouseBENo || '') === number);
  if (!filedJobs.length && !exBondJobs.length) return { text: `No import job has BE No ${number}.` };
  return {
    text: [
      ...filedJobs.map(importJobText),
      ...exBondJobs.map(
        (job) => `Ex-Bond job ${job.jobNo} clears warehouse BE ${number} (status ${job.status || 'DRAFT'})`,
      ),
    ].join('\n\n'),
  };
}

async function iecAnswer(text) {
  const iec = upper((text.match(/\b\d{10}\b/) || upper(text).match(/\b[A-Z]{5}\d{4}[A-Z]\b/))[0]);
  const jobs = (await importJobs()).filter((job) => upper(job.autoField_5 || job.iecCode) === iec);
  if (!jobs.length) return { text: `No import job for IEC ${iec}.` };
  return {
    text: `${jobs.length} import job(s) for IEC ${iec} (${importerName(jobs[0])}), latest first:\n${jobListLines(jobs, 'imp')}`,
  };
}

async function jobAnswer(text) {
  const match =
    text.match(/[A-Za-z]{2,}[/-][A-Za-z0-9/-]*\d[A-Za-z0-9/-]*/) ||
    text.match(/\bjob\s*(?:no\.?|number|#)?\s*[:-]?\s*([A-Za-z0-9/-]*\d[A-Za-z0-9/-]*)/i);
  const key = upper(match[1] || match[0]).replace(/[.,;]$/, '');
  const matches = (job) => upper(job.jobNo) === key || upper(job.jobNo).includes(key);
  const importMatches = (await importJobs()).filter(matches);
  const exportMatches = (await exportJobs()).filter(matches);
  const found = [
    ...importMatches.map((job) => ({ job, kind: 'imp' })),
    ...exportMatches.map((job) => ({ job, kind: 'exp' })),
  ];
  if (!found.length) return { text: `I could not find job "${key}". Check the job no, or search it in 1. Job Query.` };
  const exact = found.filter((entry) => upper(entry.job.jobNo) === key);
  const shown = exact.length ? exact : found;
  if (shown.length > 1 && !exact.length) {
    return {
      text:
        `${shown.length} jobs match "${key}":\n` +
        shown
          .slice(0, LINES_LISTED)
          .map(
            (entry) =>
              `• ${entry.job.jobNo} (${entry.kind === 'imp' ? 'import' : 'export'}) - ${entry.job.status || 'DRAFT'}`,
          )
          .join('\n'),
    };
  }
  return {
    text: shown
      .slice(0, JOBS_SHOWN)
      .map((entry) => (entry.kind === 'imp' ? importJobText(entry.job) : exportJobText(entry.job)))
      .join('\n\n'),
  };
}

async function importerAnswer(text) {
  const name = text
    .replace(/.*\b(jobs?\s+(of|for)|importer|party|client)\b\s*(name)?\s*[:-]?/i, '')
    .replace(/\b(ke|ki|ka|jobs?|status|batao|dikhao)\b/gi, '')
    .trim();
  if (name.length < 3) return { text: 'Give at least 3 letters of the importer name, e.g. "jobs of OPTIMUS".' };
  const jobs = (await importJobs()).filter((job) => upper(importerName(job)).includes(upper(name)));
  if (!jobs.length) return { text: `No import job for an importer like "${name}".` };
  return { text: `${jobs.length} import job(s) for "${name}", latest first:\n${jobListLines(jobs, 'imp')}` };
}

const countByStatus = (jobs) =>
  jobs.reduce((counts, job) => {
    const status = upper(job.status) || 'DRAFT';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

const statusCountsText = (counts) =>
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => `${status} ${count}`)
    .join(', ') || 'none';

async function summaryAnswer(text) {
  const importList = await importJobs(JOBS_READ_FOR_SUMMARY);
  const exportList = await exportJobs(JOBS_READ_FOR_SUMMARY);
  const todayText = new Date().toISOString().slice(0, 10);
  const createdToday = (job) =>
    String(job.jobDate || (job.createdAt && new Date(job.createdAt).toISOString()) || '').slice(0, 10) === todayText;
  const lines = [
    `Import jobs: ${importList.length} (${statusCountsText(countByStatus(importList))})`,
    `Export jobs: ${exportList.length} (${statusCountsText(countByStatus(exportList))})`,
    `Created today: import ${importList.filter(createdToday).length}, export ${exportList.filter(createdToday).length}`,
  ];
  if (/pending|draft/i.test(text)) {
    const pending = importList.filter((job) => !job.beNo && upper(job.status) !== 'CANCELLED');
    lines.push(
      `Import jobs without BE No: ${pending.length}${pending.length ? '\n' + jobListLines(pending, 'imp') : ''}`,
    );
  }
  return { text: lines.join('\n') };
}

/** The questions the bot answers from the database; the first one that matches answers. */
export const INTENTS = [
  {
    name: 'help',
    test: (text) => /^(help|\?|hi+|hello|hey|namaste|namaskar|menu|kya kar sakte|what can you do)\b/i.test(text.trim()),
    run: async () => ({ text: `Hello! ${HELP}` }),
  },
  {
    name: 'tariff',
    test: (text) =>
      /\b\d{8}\b/.test(text) &&
      (/duty|rate|tariff|ritc|cth|hs\b|hsn|bcd|igst|dut/i.test(text) || /^\s*\d{8}\s*$/.test(text)),
    run: tariffAnswer,
  },
  {
    name: 'rate',
    test: (text) => /(rate|exchange|ex\.? ?rate|currency)/i.test(text) && /\b[A-Za-z]{3}\b/.test(text),
    run: exchangeRateAnswer,
  },
  {
    name: 'sb',
    test: (text) => /\b(sb|shipping bill)\b/i.test(text) && /\b\d{6,8}\b/.test(text),
    run: shippingBillAnswer,
  },
  {
    name: 'be',
    test: (text) =>
      (/\b(be|bill of entry|b\/e)\b/i.test(text) && /\b\d{6,8}\b/.test(text)) || /^\s*\d{7}\s*$/.test(text),
    run: billOfEntryAnswer,
  },
  {
    name: 'iec',
    test: (text) => /\b\d{10}\b/.test(text) || /\b[A-Z]{5}\d{4}[A-Z]\b/.test(upper(text)),
    run: iecAnswer,
  },
  {
    name: 'job',
    test: (text) =>
      /[A-Za-z]{2,}[/-][A-Za-z0-9/-]*\d/.test(text) ||
      /\bjob\s*(no\.?|number|#)?\s*[:-]?\s*[A-Za-z0-9/-]*\d/i.test(text),
    run: jobAnswer,
  },
  {
    name: 'importer',
    test: (text) => /\b(jobs?\s+(of|for)|importer|party|client)\b/i.test(text),
    run: importerAnswer,
  },
  {
    name: 'summary',
    test: (text) =>
      /(summary|status|kitne|kitni|how many|count|pending|draft|today|aaj|filed|dashboard|report)/i.test(text),
    run: summaryAnswer,
  },
];

/** Gemini's answer to a question no intent matched (only the chat text is sent), or null. */
export async function geminiAnswer(history, text) {
  const settings = await settingsStore.getMany(['CHATBOT_GEMINI', 'GEMINI_API_KEY']);
  if (String(settings.CHATBOT_GEMINI || '').toLowerCase() === 'off') return null;
  const apiKey = settings.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: GEMINI_MODEL });
  const conversation = history
    .slice(-GEMINI_HISTORY_MESSAGES)
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.text}`)
    .join('\n');
  const result = await model.generateContent(`${GEMINI_INSTRUCTIONS}\n\n${conversation}\nUser: ${text}\nAssistant:`);
  const answerText = String((result && result.response && result.response.text && result.response.text()) || '').trim();
  return answerText ? answerText.slice(0, GEMINI_ANSWER_LENGTH) : null;
}
