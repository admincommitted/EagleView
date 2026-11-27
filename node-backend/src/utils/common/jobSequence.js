// Job number generation (Settings > Sequence Config).
//
// One counter per branch + job mode (AIR IMPORT, SEA IMPORT, LAND IMPORT, AIR EXPORT, SEA EXPORT, LAND EXPORT).
// "startNumber" is the NEXT number to give; it moves on by one with every new job.
// The branch comes from the branchId the screens send; the job mode is the one the settings screen saves
// (AIR EXPORT / SEA EXPORT ...). A missing counter is created with the default prefix, and a number that is
// already a job no is skipped, so a start number set back to an old value never gives a duplicate.
//
// Prefix tokens: {BR} branch code, {FY} financial year code (e.g. 26-27), {YY} the year the FY starts (26).
import { Op } from '../../config/database.js';
import { CompanyBranch, ExportJob, FinancialYear, ImportJob, JobSequence } from '../../models/index.js';

const MODES = ['AIR IMPORT', 'SEA IMPORT', 'LAND IMPORT', 'AIR EXPORT', 'SEA EXPORT', 'LAND EXPORT'];
const SHORT = {
  'AIR IMPORT': 'AI',
  'SEA IMPORT': 'SI',
  'LAND IMPORT': 'LI',
  'AIR EXPORT': 'AE',
  'SEA EXPORT': 'SE',
  'LAND EXPORT': 'LE',
};
const FIRST_JOB_NUMBER = 1001;
const FALLBACK_BRANCH_CODE = 'DEL';
const MAX_TAKEN_NUMBERS_SKIPPED = 5000;
const APRIL_MONTH_INDEX = 3;

const defaultPrefix = (branchCode, jobMode) => `${branchCode}-${SHORT[jobMode] || 'JB'}-`;

function transportOf(shipmentMode) {
  const mode = String(shipmentMode || '').toUpperCase();
  if (mode.startsWith('A') || mode === 'COURIER') return 'AIR';
  if (mode.startsWith('L') || mode === 'ROAD' || mode === 'RAIL') return 'LAND';
  return 'SEA';
}

function modeOf(shipmentMode, side) {
  return `${transportOf(shipmentMode)} ${side}`;
}

const cleanBranchCode = (branchCode) => branchCode && String(branchCode).trim().toUpperCase();

// the branch picked at the top of the screen (branchId) wins: the export form keeps a fixed branchCode 'DEL'
async function branchCodeOf(payload = {}) {
  try {
    const branch = payload.branchId ? await CompanyBranch.findByPk(payload.branchId) : null;
    if (branch) return branch.branchCode;
    if (payload.branchCode && String(payload.branchCode).trim()) return String(payload.branchCode).trim().toUpperCase();
    const defaultBranch =
      (await CompanyBranch.findOne({ where: { isDefault: true } })) ||
      (await CompanyBranch.findOne({ order: [['id', 'ASC']] }));
    if (defaultBranch) return defaultBranch.branchCode;
  } catch {
    /* no branch table */
  }
  return cleanBranchCode(payload.branchCode) || FALLBACK_BRANCH_CODE;
}

async function fyOf(financialYearId) {
  if (!financialYearId) return null;
  try {
    return await FinancialYear.findByPk(financialYearId);
  } catch {
    return null;
  }
}

// two-digit year the current financial year (April - March) starts in
function currentFyStartYear() {
  const now = new Date();
  return String(now.getFullYear() - (now.getMonth() < APRIL_MONTH_INDEX ? 1 : 0)).slice(2);
}

function render(prefix, number, ctx = {}) {
  const fy = ctx.fy;
  const fyStartYear = fy && fy.startDate ? String(fy.startDate).slice(2, 4) : currentFyStartYear();
  const renderedPrefix = String(prefix || '')
    .replace(/\{BR\}/gi, ctx.branchCode || '')
    .replace(/\{FY\}/gi, (fy && fy.code) || '')
    .replace(/\{YY\}/gi, fyStartYear);
  return `${renderedPrefix}${number}`;
}

// the counter row for a branch + mode: the one for this FY if there is one, else the general one (no FY).
// Old export counters were saved as jobMode "EXPORT": used when no AIR/SEA EXPORT row is there.
async function findRow(branchCode, jobMode, financialYearId, opts = {}) {
  const findOne = (where) => JobSequence.findOne({ where, ...opts });
  let row = null;
  if (financialYearId) row = await findOne({ branchCode, jobMode, financialYearId });
  if (!row) row = await findOne({ branchCode, jobMode, financialYearId: { [Op.is]: null } });
  if (!row) row = await findOne({ branchCode, jobMode });
  if (!row && jobMode.endsWith('EXPORT')) row = await findOne({ branchCode, jobMode: 'EXPORT' });
  return row;
}

async function jobNoTaken(jobNo, transaction) {
  const importJob = await ImportJob.findOne({ where: { jobNo }, attributes: ['id'], transaction });
  if (importJob) return true;
  return !!(await ExportJob.findOne({ where: { jobNo }, attributes: ['id'], transaction }));
}

// first number from n that is not already a job no
async function firstFree(prefix, n, ctx, transaction) {
  let number = Number(n) > 0 ? Math.floor(Number(n)) : 1;
  for (
    let skipped = 0;
    skipped < MAX_TAKEN_NUMBERS_SKIPPED && (await jobNoTaken(render(prefix, number, ctx), transaction));
    skipped++
  ) {
    number++;
  }
  return number;
}

/** What the next job no will be (no change). */
async function peek({ branchCode, branchId, shipmentMode, side, jobMode, financialYearId } = {}) {
  const resolvedBranchCode = await branchCodeOf({ branchCode, branchId });
  const mode = jobMode || modeOf(shipmentMode, side || 'IMPORT');
  const fy = await fyOf(financialYearId);
  const row = await findRow(resolvedBranchCode, mode, financialYearId);
  const prefix = row ? row.prefix : defaultPrefix(resolvedBranchCode, mode);
  const ctx = { branchCode: resolvedBranchCode, fy };
  const nextNumber = await firstFree(prefix, row ? row.startNumber : FIRST_JOB_NUMBER, ctx);
  return {
    branchCode: resolvedBranchCode,
    jobMode: mode,
    prefix,
    configured: !!row,
    nextNumber,
    nextJobNo: render(prefix, nextNumber, ctx),
  };
}

/** Gives the next job no and moves the counter on (inside the job's save transaction). */
async function take({ branchCode, branchId, shipmentMode, side, financialYearId } = {}, transaction) {
  const resolvedBranchCode = await branchCodeOf({ branchCode, branchId });
  const mode = modeOf(shipmentMode, side);
  const fy = await fyOf(financialYearId);
  let row = await findRow(resolvedBranchCode, mode, financialYearId, { transaction });
  if (!row) {
    row = await JobSequence.create(
      {
        branchCode: resolvedBranchCode,
        jobMode: mode,
        prefix: defaultPrefix(resolvedBranchCode, mode),
        startNumber: FIRST_JOB_NUMBER,
      },
      { transaction },
    );
  }
  const ctx = { branchCode: resolvedBranchCode, fy };
  const number = await firstFree(row.prefix, row.startNumber, ctx, transaction);
  await row.update({ startNumber: number + 1 }, { transaction });
  return render(row.prefix, number, ctx);
}

export { MODES, SHORT, modeOf, branchCodeOf, fyOf, render, findRow, jobNoTaken, firstFree, peek, take };
