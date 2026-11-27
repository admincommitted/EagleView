import { Op } from 'sequelize';
import { ApiError, BadRequestError, ConflictError, NotFoundError } from '../../../core/http/index.js';
import { CompanyBranch, DocumentSeries, FinancialYear } from '../../../models/index.js';

// Job numbers are not numbered here: they come from Settings > Sequence Config (utils/common/jobSequence.js).
export const DOC_TYPES = [
  'Tax Invoice',
  'Proforma Invoice',
  'Payment Voucher',
  'Receipt Voucher',
  'Journal Voucher',
  'Credit Note',
  'Debit Note',
  'Consolidated Bill',
];
const DEPARTMENT_CODES = {
  ALL: 'GEN',
  'Air Export': 'AE',
  'Air Import': 'AI',
  'Sea Export': 'SE',
  'Sea Import': 'SI',
  Customs: 'CUS',
  Accounts: 'ACC',
  HR: 'HR',
};
const FORMAT_TOKEN = /\{(BRANCH|DEPT|FY|YY|MM|DD)\}/g;
const KNOWN_TOKEN = /^\{(BRANCH|DEPT|FY|YY|MM|DD)\}$/;
const FORBIDDEN_FORMAT_CHARACTERS = /[\\?#%"'<>|*\s]/;
const MAX_FORMAT_LENGTH = 60;
const MAX_PAD = 8;
const MAX_NEXT_NUMBER = 99999999;
const TAKE_ATTEMPTS = 5;
const DEFAULT_BRANCH_IN_NUMBER = 'HO';
const DEFAULT_DEPARTMENT_CODE = 'GEN';
const ALL = 'ALL';

let tableReady = null;
const ensureTable = () => {
  tableReady =
    tableReady ||
    DocumentSeries.sync().catch((error) => {
      tableReady = null;
      throw error;
    });
  return tableReady;
};

const failure = (ErrorClass, message) => new ErrorClass(message, { body: { success: false, error: message } });

const twoDigits = (value) => String(value).padStart(2, '0');

/** The document number a rule gives for `number`: the format's tokens filled in, then the zero-padded number. */
export function render(row, number, date = new Date(), branchCode, dept) {
  const documentDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const branch = branchCode || (row.branchCode !== ALL ? row.branchCode : DEFAULT_BRANCH_IN_NUMBER);
  const tokenValues = {
    BRANCH: branch,
    DEPT: DEPARTMENT_CODES[dept || row.dept] || DEFAULT_DEPARTMENT_CODE,
    FY: row.fyCode,
    YY: String(documentDate.getFullYear()).slice(2),
    MM: twoDigits(documentDate.getMonth() + 1),
    DD: twoDigits(documentDate.getDate()),
  };
  const prefix = String(row.format || '').replace(FORMAT_TOKEN, (match, token) => tokenValues[token]);
  return prefix + String(number).padStart(Number(row.pad) || 1, '0');
}

const cleanRule = (body) => ({
  docType: String(body.docType || '').trim(),
  branchCode:
    String(body.branchCode || ALL)
      .trim()
      .toUpperCase() || ALL,
  dept: String(body.dept || ALL).trim() || ALL,
  fyCode: String(body.fyCode || '').trim(),
  format: String(body.format || '').trim(),
  pad: parseInt(body.pad, 10),
  nextNumber: parseInt(body.nextNumber, 10),
  isActive: body.isActive !== false,
});

function checkDocTypeAndDept(rule) {
  if (!DOC_TYPES.includes(rule.docType)) {
    throw new Error(
      /job/i.test(rule.docType) ? 'Job numbers are set in Settings > Sequence Config' : 'Choose a document type',
    );
  }
  if (!(rule.dept in DEPARTMENT_CODES)) throw new Error('Unknown department');
}

async function checkBranchAndYear(rule) {
  if (rule.branchCode !== ALL && !(await CompanyBranch.findOne({ where: { branchCode: rule.branchCode } }))) {
    throw new Error(`Branch ${rule.branchCode} not found in Company Branches`);
  }
  if (!rule.fyCode || !(await FinancialYear.findOne({ where: { code: rule.fyCode } }))) {
    throw new Error('Choose a financial year from the FY master');
  }
}

function checkFormatAndNumbers(rule) {
  if (!rule.format || rule.format.length > MAX_FORMAT_LENGTH) throw new Error('Format is required (max 60 characters)');
  const unknownTags = (rule.format.match(/\{[^}]*\}/g) || []).filter((tag) => !tag.match(KNOWN_TOKEN));
  if (unknownTags.length) throw new Error('Unknown tag in format: ' + unknownTags.join(', '));
  if (FORBIDDEN_FORMAT_CHARACTERS.test(rule.format.replace(FORMAT_TOKEN, ''))) {
    throw new Error('Format may contain letters, digits, / - _ . and tags only');
  }
  if (!Number.isInteger(rule.pad) || rule.pad < 1 || rule.pad > MAX_PAD) throw new Error('Padding must be 1 - 8');
  if (!Number.isInteger(rule.nextNumber) || rule.nextNumber < 1 || rule.nextNumber > MAX_NEXT_NUMBER) {
    throw new Error('Next number must be 1 or more');
  }
}

async function checkNoClash(rule, id) {
  const clash = await DocumentSeries.findOne({
    where: {
      docType: rule.docType,
      branchCode: rule.branchCode,
      dept: rule.dept,
      fyCode: rule.fyCode,
      ...(id ? { id: { [Op.ne]: id } } : {}),
    },
  });
  if (clash) throw failure(ConflictError, 'A rule for this document type, branch, department and year already exists');
}

/** Every problem of a rule (and any failure while checking it) answers 400; a duplicate rule answers 409. */
async function validRule(body, id) {
  try {
    const rule = cleanRule(body);
    checkDocTypeAndDept(rule);
    await checkBranchAndYear(rule);
    checkFormatAndNumbers(rule);
    await checkNoClash(rule, id);
    return rule;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw failure(BadRequestError, error.message);
  }
}

export async function listRules(query) {
  await ensureTable();
  const where = {};
  for (const key of ['docType', 'branchCode', 'fyCode', 'dept']) if (query[key]) where[key] = String(query[key]);
  const rows = await DocumentSeries.findAll({
    where,
    order: [
      ['fyCode', 'DESC'],
      ['docType', 'ASC'],
      ['branchCode', 'ASC'],
      ['dept', 'ASC'],
    ],
  });
  return {
    success: true,
    data: rows.map((row) => ({ ...row.toJSON(), example: render(row, row.nextNumber) })),
    docTypes: DOC_TYPES,
    depts: Object.keys(DEPARTMENT_CODES),
  };
}

export async function createRule(body) {
  await ensureTable();
  const rule = await validRule(body || {});
  const row = await DocumentSeries.create(rule);
  return { success: true, data: row };
}

export async function updateRule(id, body) {
  await ensureTable();
  const row = await DocumentSeries.findByPk(id);
  if (!row) throw failure(NotFoundError, 'Rule not found');
  const rule = await validRule({ ...row.toJSON(), ...body }, row.id);
  // moving the counter back can give numbers that were already used
  if (rule.nextNumber < row.nextNumber && !body.allowBack) {
    throw failure(
      BadRequestError,
      `Next number cannot go back from ${row.nextNumber} (numbers already given would repeat). Send allowBack to force.`,
    );
  }
  await row.update(rule);
  return { success: true, data: row };
}

export async function deleteRule(id) {
  await ensureTable();
  const removed = await DocumentSeries.destroy({ where: { id } });
  if (!removed) throw failure(NotFoundError, 'Rule not found');
  return { success: true };
}

// best rule for a document: exact branch + dept, then branch + ALL, then ALL + dept, then ALL + ALL
async function findRule({ docType, branchCode, dept, fyCode }) {
  const candidates = [
    [branchCode, dept],
    [branchCode, ALL],
    [ALL, dept],
    [ALL, ALL],
  ];
  for (const [branch, department] of candidates) {
    if (!branch || !department) continue;
    const row = await DocumentSeries.findOne({
      where: { docType, fyCode, branchCode: String(branch).toUpperCase(), dept: department, isActive: true },
    });
    if (row) return row;
  }
  return null;
}

const renderTakenNumber = (row, number, date, request) =>
  render(
    row,
    number,
    date,
    request.branchCode && row.branchCode === ALL ? String(request.branchCode).toUpperCase() : undefined,
    request.dept && row.dept === ALL ? request.dept : undefined,
  );

/** Gives the next number of the best rule and moves its counter by one in one conditional update. */
export async function takeNumber(body) {
  await ensureTable();
  const request = body || {};
  if (!request.docType || !request.fyCode) throw failure(BadRequestError, 'docType and fyCode are required');
  const date = request.date ? new Date(request.date) : new Date();
  for (let attempt = 0; attempt < TAKE_ATTEMPTS; attempt++) {
    const row = await findRule(request);
    if (!row) {
      throw failure(
        NotFoundError,
        `No active numbering rule for ${request.docType} (${request.branchCode || ALL} / ${request.dept || ALL} / ${request.fyCode})`,
      );
    }
    const number = row.nextNumber;
    const [updated] = await DocumentSeries.update(
      { nextNumber: number + 1 },
      { where: { id: row.id, nextNumber: number } },
    );
    if (updated === 1) return { success: true, number: renderTakenNumber(row, number, date, request), ruleId: row.id };
  }
  throw failure(ConflictError, 'Numbering is busy, please try again');
}
