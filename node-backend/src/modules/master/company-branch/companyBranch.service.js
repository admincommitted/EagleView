import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { NotFoundError } from '../../../core/http/index.js';
import { CompanyBranch, ExportJob, ImportJob, JobSequence } from '../../../models/index.js';
import { companyMasterBadRequest as badRequest } from '../shared/errorAnswers.js';

// GST state code (first two digits of a GSTIN) -> state short code used on the branches
const GST_STATE = {
  '01': 'JK',
  '02': 'HP',
  '03': 'PB',
  '04': 'CH',
  '05': 'UK',
  '06': 'HR',
  '07': 'DL',
  '08': 'RJ',
  '09': 'UP',
  10: 'BR',
  11: 'SK',
  12: 'AR',
  13: 'NL',
  14: 'MN',
  15: 'MZ',
  16: 'TR',
  17: 'ML',
  18: 'AS',
  19: 'WB',
  20: 'JH',
  21: 'OR',
  22: 'CG',
  23: 'MP',
  24: 'GJ',
  26: 'DN',
  27: 'MH',
  28: 'AP',
  29: 'KA',
  30: 'GA',
  31: 'LD',
  32: 'KL',
  33: 'TN',
  34: 'PY',
  35: 'AN',
  36: 'TS',
  37: 'AP',
  38: 'LA',
  97: 'OT',
};
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const PHONE_PATTERN = /^[0-9+()\-\s,/]{6,60}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/;
const BRANCH_CODE_PATTERN = /^[A-Z0-9]{2,10}$/;
const EMAIL_SEPARATOR = ', ';

const branchNotFound = () =>
  new NotFoundError('Branch not found', { body: { success: false, error: 'Branch not found' } });
const upperTrimmed = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

/** The branch GSTIN's first two digits give the branch's GST state. */
function gstinFields(body) {
  const gstin = String(body.gstin || '')
    .toUpperCase()
    .replace(/\s/g, '');
  if (gstin && !GSTIN_PATTERN.test(gstin)) throw badRequest('GSTIN must be 15 characters, e.g. 07AAACC1234D1Z5');
  if (!gstin) return { gstin: null };
  const stateCode = GST_STATE[gstin.slice(0, 2)];
  if (!stateCode) throw badRequest(`GSTIN state code ${gstin.slice(0, 2)} is not a valid GST state`);
  const wantedState = String(body.stateCode || '')
    .trim()
    .toUpperCase();
  if (wantedState && wantedState !== stateCode)
    throw badRequest(`GSTIN ${gstin} is of state ${stateCode} but the branch state is ${wantedState}`);
  return { gstin, stateCode };
}

function phoneOf(value) {
  const phone = String(value || '').trim();
  if (phone && !PHONE_PATTERN.test(phone)) {
    throw badRequest('Phone: digits, + - ( ) and commas only (several numbers can be given, comma separated)');
  }
  return phone || null;
}

function emailOf(value) {
  const email = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s*[,;]\s*/g, EMAIL_SEPARATOR);
  if (email && !email.split(EMAIL_SEPARATOR).every((address) => EMAIL_PATTERN.test(address))) {
    throw badRequest('E-mail is not valid (several addresses can be given, comma separated)');
  }
  return email || null;
}

function websiteOf(value) {
  const website = String(value || '')
    .trim()
    .toLowerCase();
  if (website && !WEBSITE_PATTERN.test(website)) throw badRequest('Website is not valid, e.g. www.company.com');
  return website || null;
}

/** The branch fields sent (only those), cleaned and checked. */
function branchValuesOf(body) {
  const values = {};
  if (body.branchCode !== undefined) values.branchCode = upperTrimmed(body.branchCode);
  if (body.branchName !== undefined) values.branchName = upperTrimmed(body.branchName);
  if (body.address !== undefined) values.address = String(body.address || '').trim();
  if (body.status !== undefined) values.status = body.status === 'Inactive' ? 'Inactive' : 'Active';
  if (body.isDefault !== undefined) values.isDefault = !!body.isDefault;
  if (body.gstin !== undefined) Object.assign(values, gstinFields(body));
  if (body.phone !== undefined) values.phone = phoneOf(body.phone);
  if (body.email !== undefined) values.email = emailOf(body.email);
  if (body.website !== undefined) values.website = websiteOf(body.website);
  if (values.branchCode !== undefined && !BRANCH_CODE_PATTERN.test(values.branchCode)) {
    throw badRequest('Branch code: 2-10 letters / numbers (e.g. DEL)');
  }
  if (values.branchName !== undefined && !values.branchName) throw badRequest('Branch name is required');
  if (values.isDefault && values.status === 'Inactive') throw badRequest('An inactive branch cannot be the default');
  return values;
}

/** Two branches with the same name showed as two same entries (e.g. JAIPUR twice in Purchase > Branch). */
async function branchWithSameName(name, exceptId, transaction) {
  const wantedName = String(name || '')
    .trim()
    .toUpperCase();
  if (!wantedName) return null;
  const branches = await CompanyBranch.findAll({ attributes: ['id', 'branchCode', 'branchName'], transaction });
  return (
    branches.find(
      (branch) =>
        String(branch.id) !== String(exceptId || '') &&
        String(branch.branchName || '')
          .trim()
          .toUpperCase() === wantedName,
    ) || null
  );
}

async function refuseSameName(name, exceptId, transaction) {
  const twin = await branchWithSameName(name, exceptId, transaction);
  if (twin) throw badRequest(`Branch name ${name} is already used by branch ${twin.branchCode}`);
}

const clearDefaultBranch = (transaction) => CompanyBranch.update({ isDefault: false }, { where: {}, transaction });

export const listCompanyBranches = () =>
  CompanyBranch.findAll({
    order: [
      ['isDefault', 'DESC'],
      ['branchCode', 'ASC'],
    ],
  });

/** The first branch is always the default; a new default replaces the old one in the same transaction. */
export async function createCompanyBranch(body) {
  const values = branchValuesOf({
    status: 'Active',
    ...body,
    branchCode: body.branchCode || '',
    branchName: body.branchName || '',
  });
  return sequelize.transaction(async (transaction) => {
    await refuseSameName(values.branchName, null, transaction);
    const isFirstBranch = !(await CompanyBranch.count({ transaction }));
    if (values.isDefault || isFirstBranch) {
      values.isDefault = true;
      await clearDefaultBranch(transaction);
    }
    return CompanyBranch.create(values, { transaction });
  });
}

/** Job numbers and counters use the branch code: renaming it would split them. */
async function refuseCodeChangeInUse(branch, transaction) {
  const sequencesUsingCode = await JobSequence.count({ where: { branchCode: branch.branchCode }, transaction });
  if (sequencesUsingCode)
    throw badRequest(`Branch code ${branch.branchCode} is used by the job sequences - it cannot be changed`);
}

export async function updateCompanyBranch(id, body) {
  const values = branchValuesOf(body);
  return sequelize.transaction(async (transaction) => {
    const branch = await CompanyBranch.findByPk(id, { transaction });
    if (!branch) throw branchNotFound();
    const nameChanged =
      values.branchName &&
      String(values.branchName).trim().toUpperCase() !==
        String(branch.branchName || '')
          .trim()
          .toUpperCase();
    if (nameChanged) await refuseSameName(values.branchName, branch.id, transaction);
    if (values.branchCode && values.branchCode !== branch.branchCode) await refuseCodeChangeInUse(branch, transaction);
    if (values.isDefault) await clearDefaultBranch(transaction);
    if (branch.isDefault && values.isDefault === false) throw badRequest('Make another branch the default first');
    if (branch.isDefault && values.status === 'Inactive')
      throw badRequest('The default branch cannot be made inactive');
    await branch.update(values, { transaction });
    return branch;
  });
}

async function countOrZero(Model, where) {
  try {
    return await Model.count({ where });
  } catch {
    return 0;
  }
}

/** Jobs of the branch, by branchId and / or branch code (whichever columns the job table has). */
async function jobCountOfBranch(Model, branch) {
  const conditions = [
    ...(Model.rawAttributes.branchId ? [{ branchId: branch.id }] : []),
    ...(Model.rawAttributes.branchCode ? [{ branchCode: branch.branchCode }] : []),
  ];
  if (!conditions.length) return 0;
  return countOrZero(Model, { [Op.or]: conditions });
}

async function usageOfBranch(branch) {
  const used = [];
  try {
    const jobCount = (await jobCountOfBranch(ImportJob, branch)) + (await jobCountOfBranch(ExportJob, branch));
    if (jobCount) used.push(`${jobCount} job(s)`);
  } catch {
    // job tables not there
  }
  return used;
}

/** A branch that jobs use is made Inactive instead; the default branch cannot be deleted. */
export async function deleteCompanyBranch(id) {
  const branch = await CompanyBranch.findByPk(id);
  if (!branch) throw branchNotFound();
  if (branch.isDefault)
    throw badRequest('The default branch cannot be deleted - make another branch the default first');
  const used = await usageOfBranch(branch);
  if (used.length)
    throw badRequest(`Branch ${branch.branchCode} is used by ${used.join(', ')} - make it Inactive instead`);
  await branch.destroy();
}
