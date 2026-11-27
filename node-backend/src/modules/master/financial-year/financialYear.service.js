import { Op } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { NotFoundError } from '../../../core/http/index.js';
import { ExportJob, FinancialPeriod, FinancialYear, ImportJob } from '../../../models/index.js';
import { companyMasterBadRequest as badRequest } from '../shared/errorAnswers.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MS_PER_DAY = 86400000;
const MAX_YEAR_DAYS = 366;
const MAX_PERIODS = 12;
const DEFAULT_YEAR_TYPE = 'FINANCIAL';
const YEAR_CODE_PATTERN = /^[A-Z0-9/-]{2,12}$/;
const ISO_DAY_START = /^(\d{4})-(\d{2})-(\d{2})/;
const TEXT_FIELDS = ['code', 'name', 'startDate', 'endDate', 'yearType'];
const FLAG_FIELDS = ['isActive', 'isDefault', 'isClosed'];

const yearNotFound = () =>
  new NotFoundError('Financial year not found', { body: { success: false, error: 'Financial year not found' } });

// periods are built from plain local dates: toISOString moved every period one day back on an IST server
const ymdOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const localDayOf = (text) => {
  const match = ISO_DAY_START.exec(String(text || ''));
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : null;
};

const periodNameOf = (date) => `${MONTH_NAMES[date.getMonth()]}-${date.getFullYear()}`;

/** End after start, at most 12 months, no overlap with another year of the same type. */
async function checkYearDates(values, selfId) {
  const start = localDayOf(values.startDate);
  const end = localDayOf(values.endDate);
  if (!start || !end) throw badRequest('Start and end date are required');
  if (end <= start) throw badRequest('End date must be after the start date');
  if ((end - start) / MS_PER_DAY > MAX_YEAR_DAYS) throw badRequest('A year cannot be longer than 12 months');
  const clash = await FinancialYear.findOne({
    where: {
      isDeleted: false,
      yearType: values.yearType || DEFAULT_YEAR_TYPE,
      id: { [Op.ne]: selfId || 0 },
      startDate: { [Op.lte]: ymdOf(end) },
      endDate: { [Op.gte]: ymdOf(start) },
    },
  });
  if (clash) throw badRequest(`Dates overlap year ${clash.code} (${clash.startDate} to ${clash.endDate})`);
}

/** The month periods of a year, built again from its dates; months that were closed stay closed. */
async function buildPeriods(year, transaction) {
  const closedPeriods = await FinancialPeriod.findAll({
    where: { financialYearId: year.id, isClosed: true },
    transaction,
  });
  const closedNames = new Set(closedPeriods.map((period) => period.periodName));
  await FinancialPeriod.destroy({ where: { financialYearId: year.id }, transaction });

  const start = localDayOf(year.startDate);
  const end = localDayOf(year.endDate);
  let monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  for (let periodNo = 1; monthStart <= end && periodNo <= MAX_PERIODS; periodNo++) {
    const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const periodStart = monthStart < start ? start : monthStart;
    const monthEnd = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), 0);
    const periodEnd = monthEnd > end ? end : monthEnd;
    await FinancialPeriod.create(
      {
        financialYearId: year.id,
        periodName: periodNameOf(periodStart),
        periodNo,
        startDate: ymdOf(periodStart),
        endDate: ymdOf(periodEnd),
        isClosed: closedNames.has(periodNameOf(periodStart)),
      },
      { transaction },
    );
    monthStart = nextMonthStart;
  }
}

/** The year fields sent (only those), cleaned and checked. */
function yearValuesOf(body) {
  const values = {};
  for (const field of TEXT_FIELDS) if (body[field] !== undefined) values[field] = String(body[field] || '').trim();
  for (const field of FLAG_FIELDS) if (body[field] !== undefined) values[field] = !!body[field];
  if (values.code !== undefined) {
    values.code = values.code.toUpperCase();
    if (!YEAR_CODE_PATTERN.test(values.code)) throw badRequest('Code: 2-12 letters / numbers, e.g. 26-27');
  }
  if (values.name !== undefined && !values.name) throw badRequest('Name is required');
  if (values.yearType !== undefined && !values.yearType) values.yearType = DEFAULT_YEAR_TYPE;
  if (values.isDefault && values.isClosed) throw badRequest('A closed year cannot be the default');
  if (values.isDefault) values.isActive = true;
  return values;
}

const clearDefaultYear = (transaction) => FinancialYear.update({ isDefault: false }, { where: {}, transaction });

export const listFinancialYears = () =>
  FinancialYear.findAll({
    where: { isDeleted: false },
    include: [{ model: FinancialPeriod, as: 'periods', where: { isDeleted: false }, required: false }],
    order: [['startDate', 'DESC']],
  });

/** The first year is the default; a deleted year with the same code is used again. */
export async function createFinancialYear(body) {
  const values = yearValuesOf({
    yearType: DEFAULT_YEAR_TYPE,
    isActive: true,
    ...body,
    code: body.code || '',
    name: body.name || '',
  });
  await checkYearDates(values);
  return sequelize.transaction(async (transaction) => {
    const sameCode = await FinancialYear.findOne({ where: { code: values.code }, transaction });
    if (sameCode && !sameCode.isDeleted) throw badRequest(`Year code ${values.code} already exists`);
    const isFirstYear = !(await FinancialYear.count({ where: { isDeleted: false }, transaction }));
    if (values.isDefault || isFirstYear) {
      values.isDefault = true;
      await clearDefaultYear(transaction);
    }
    let year;
    if (sameCode) {
      await sameCode.update({ ...values, isDeleted: false }, { transaction });
      year = sameCode;
    } else {
      year = await FinancialYear.create(values, { transaction });
    }
    await buildPeriods(year, transaction);
    return year;
  });
}

/** The month periods are built again when the dates change. */
export async function updateFinancialYear(id, body) {
  const year = await FinancialYear.findByPk(id);
  if (!year || year.isDeleted) throw yearNotFound();
  const values = yearValuesOf(body);
  const merged = { startDate: year.startDate, endDate: year.endDate, yearType: year.yearType, ...values };
  await checkYearDates(merged, year.id);
  if (year.isDefault && values.isDefault === false) throw badRequest('Make another year the default first');
  if (year.isDefault && values.isClosed)
    throw badRequest('The default year cannot be closed - make another year the default first');
  const datesChanged =
    String(merged.startDate) !== String(year.startDate) || String(merged.endDate) !== String(year.endDate);
  await sequelize.transaction(async (transaction) => {
    if (values.isDefault) await clearDefaultYear(transaction);
    await year.update(values, { transaction });
    if (datesChanged) await buildPeriods(year, transaction);
  });
  return year;
}

/** Jobs filed in the year (only job tables that have the financialYearId column). */
async function jobCountOfYear(year) {
  const exportJobs = ExportJob.rawAttributes.financialYearId
    ? await ExportJob.count({ where: { financialYearId: year.id } })
    : 0;
  const importJobs = ImportJob.rawAttributes.financialYearId
    ? await ImportJob.count({ where: { financialYearId: year.id } })
    : 0;
  return exportJobs + importJobs;
}

/** A year with jobs is closed instead; the default year cannot be deleted. Deleting only marks it (and its periods). */
export async function deleteFinancialYear(id) {
  const year = await FinancialYear.findByPk(id);
  if (!year || year.isDeleted) throw yearNotFound();
  if (year.isDefault) throw badRequest('The default year cannot be deleted - make another year the default first');
  let jobCount = 0;
  try {
    jobCount = await jobCountOfYear(year);
  } catch {
    // job tables not there
  }
  if (jobCount) throw badRequest(`${jobCount} job(s) are in year ${year.code} - close the year instead of deleting it`);

  await year.update({ isDeleted: true });
  await FinancialPeriod.update({ isDeleted: true }, { where: { financialYearId: year.id } });
}
