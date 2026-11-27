import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { ApiError } from '../../../core/http/index.js';
import { ExportJob, ImportJob, JobSequence } from '../../../models/index.js';
import * as jobSequence from '../../../utils/common/jobSequence.js';

const DEFAULT_START_NUMBER = 1001;
const MAX_PREFIX_LENGTH = 20;
const MAX_START_NUMBER = 99999999;
const PREFIX_PATTERN = /^[A-Za-z0-9/\-_.{}]+$/;

const sequenceProblems = (status, errors) =>
  new ApiError(status, errors.join('; '), {
    body: { success: false, message: errors.join('; '), errors },
  });

export const listJobSequences = () => JobSequence.findAll();

async function lastJobWithPrefix(jobMode, prefix) {
  if (!prefix) return null;
  const JobModel = jobMode.endsWith('EXPORT') ? ExportJob : ImportJob;
  return JobModel.findOne({
    where: { jobNo: { [Op.like]: `${prefix}%` } },
    order: [['id', 'DESC']],
    attributes: ['jobNo', 'createdAt'],
  });
}

/**
 * GET /job-sequences/status?branchCode=DEL&financialYearId=3 - per job mode: the counter, the next job no (numbers
 * already used are skipped) and the last job no given with this prefix. Used by Settings > Sequence Config.
 */
export async function jobSequenceStatus({ branchCode: requestedBranch, financialYearId }) {
  const branchCode = await jobSequence.branchCodeOf({ branchCode: requestedBranch });
  const fy = await jobSequence.fyOf(financialYearId);
  const modes = [];
  for (const jobMode of jobSequence.MODES) {
    const row = await jobSequence.findRow(branchCode, jobMode, financialYearId);
    const preview = await jobSequence.peek({ branchCode, jobMode, financialYearId });
    const renderedPrefix = jobSequence.render(preview.prefix, '', { branchCode, fy });
    const lastJob = await lastJobWithPrefix(jobMode, renderedPrefix);
    modes.push({
      jobMode,
      configured: !!row,
      legacy: !!(row && row.jobMode !== jobMode),
      prefix: preview.prefix,
      startNumber: row ? row.startNumber : DEFAULT_START_NUMBER,
      nextNumber: preview.nextNumber,
      nextJobNo: preview.nextJobNo,
      lastJobNo: lastJob ? lastJob.jobNo : null,
      lastAt: lastJob ? lastJob.createdAt : null,
    });
  }
  return { success: true, branchCode, fyCode: fy ? fy.code : null, data: modes };
}

/** One row of the form, cleaned; its problems are added to `errors`. Null when it cannot be used at all. */
function cleanSequenceRow(row, errors) {
  const branchCode = String(row.branchCode || '')
    .trim()
    .toUpperCase();
  const jobMode = String(row.jobMode || '')
    .trim()
    .toUpperCase();
  const prefix = String(row.prefix || '').trim();
  const startNumber = Number(row.startNumber);
  if (!branchCode) {
    errors.push('Branch is missing');
    return null;
  }
  if (!jobSequence.MODES.includes(jobMode)) {
    errors.push(`${jobMode || '?'}: unknown job mode`);
    return null;
  }
  if (!prefix) errors.push(`${jobMode}: prefix is empty`);
  else if (prefix.length > MAX_PREFIX_LENGTH) errors.push(`${jobMode}: prefix is longer than 20 characters`);
  else if (!PREFIX_PATTERN.test(prefix))
    errors.push(`${jobMode}: prefix can have only letters, numbers, / - _ . and {BR} {FY} {YY}`);
  if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber > MAX_START_NUMBER) {
    errors.push(`${jobMode}: start number must be a whole number from 1 to 99999999`);
  }
  return { branchCode, jobMode, prefix, startNumber };
}

/** The same prefix on two modes would give the same job numbers. */
function sameRenderedPrefixes(sequences, fy, errors) {
  const modeByPrefix = {};
  for (const sequence of sequences) {
    const rendered = jobSequence.render(sequence.prefix, '', { branchCode: sequence.branchCode, fy }).toUpperCase();
    const key = `${sequence.branchCode}|${rendered}`;
    if (modeByPrefix[key]) errors.push(`${sequence.jobMode} and ${modeByPrefix[key]} have the same prefix`);
    else modeByPrefix[key] = sequence.jobMode;
  }
}

/** A start number whose job no is already used would give duplicate job numbers. */
async function startNumbersAlreadyUsed(sequences, fy, errors) {
  for (const sequence of sequences) {
    const context = { branchCode: sequence.branchCode, fy };
    const current = await jobSequence.findRow(sequence.branchCode, sequence.jobMode, null);
    const unchanged =
      current &&
      current.jobMode === sequence.jobMode &&
      current.prefix === sequence.prefix &&
      Number(current.startNumber) === sequence.startNumber;
    // not changed: used numbers are skipped anyway
    if (unchanged) continue;
    const firstJobNo = jobSequence.render(sequence.prefix, sequence.startNumber, context);
    if (await jobSequence.jobNoTaken(firstJobNo)) {
      const nextFree = await jobSequence.firstFree(sequence.prefix, sequence.startNumber, context);
      errors.push(`${sequence.jobMode}: job no ${firstJobNo} is already used - next free number is ${nextFree}`);
    }
  }
}

/**
 * POST /job-sequences [{ branchCode, jobMode, prefix, startNumber }] (or { sequences: [...] }): every row is checked
 * first, then all are saved together.
 */
export async function saveJobSequences(list, financialYearId) {
  if (!list || !list.length)
    throw new ApiError(400, 'Nothing to save', { body: { success: false, message: 'Nothing to save' } });
  const fy = await jobSequence.fyOf(financialYearId);

  const errors = [];
  const sequences = [];
  for (const row of list) {
    const sequence = cleanSequenceRow(row, errors);
    if (sequence) sequences.push(sequence);
  }
  if (errors.length) throw sequenceProblems(400, errors);

  sameRenderedPrefixes(sequences, fy, errors);
  await startNumbersAlreadyUsed(sequences, fy, errors);
  if (errors.length) throw sequenceProblems(409, errors);

  await sequelize.transaction(async (transaction) => {
    for (const sequence of sequences) {
      const row = await jobSequence.findRow(sequence.branchCode, sequence.jobMode, null, { transaction });
      if (row && row.jobMode === sequence.jobMode) {
        await row.update({ prefix: sequence.prefix, startNumber: sequence.startNumber }, { transaction });
      } else {
        await JobSequence.create(sequence, { transaction });
      }
    }
  });
  return { success: true, saved: sequences.length };
}
