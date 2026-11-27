// Moves beNo / beDate (and the clearance dates) from the extendedData JSON into their own columns.
// Safe to run on every start: only rows whose column is empty and whose JSON has the value are touched.
import { Op } from '../../config/database.js';
import { ImportJob } from '../../models/index.js';

const FIELDS = ['beNo', 'beDate', 'assessmentDate', 'dutyPaidDate', 'challanNo', 'oocDate'];

const isEmpty = (value) => value === null || value === undefined || value === '';
const hasValue = (value) => value !== null && value !== undefined && String(value) !== '';

const UNREADABLE = Symbol('unreadable');

function parseExtendedData(text) {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return UNREADABLE;
  }
}

// Returns the update for one job, or null when its JSON holds none of the fields
function buildUpdate(job, extended) {
  const update = {};
  let touched = false;
  for (const field of FIELDS) {
    if (!(field in extended)) continue;
    const value = extended[field];
    if (isEmpty(job[field]) && hasValue(value)) update[field] = String(value);
    delete extended[field];
    touched = true;
  }
  if (!touched) return null;
  update.extendedData = Object.keys(extended).length ? JSON.stringify(extended) : null;
  return update;
}

async function migrateBeFields() {
  try {
    const jobs = await ImportJob.findAll({
      where: { extendedData: { [Op.or]: FIELDS.map((field) => ({ [Op.like]: `%"${field}"%` })) } },
      attributes: ['id', 'extendedData', ...FIELDS],
    });
    let moved = 0;
    for (const job of jobs) {
      const extended = parseExtendedData(job.extendedData);
      if (extended === UNREADABLE || !extended || typeof extended !== 'object') continue;
      const update = buildUpdate(job, extended);
      if (!update) continue;
      await ImportJob.update(update, { where: { id: job.id } });
      moved++;
    }
    if (moved) console.log(`[DB] BE No / dates moved from extendedData into columns on ${moved} import job(s)`);
  } catch (error) {
    console.warn('[DB] BE fields migrate:', error.message);
  }
}

export { migrateBeFields };
