// Job number generation (Settings > Sequence Config). 28-Oct-2026.
//
// One counter per branch + job mode (AIR IMPORT, SEA IMPORT, LAND IMPORT, AIR EXPORT, SEA EXPORT, LAND EXPORT).
// "startNumber" is the NEXT number to give; it moves on by one with every new job.
//
// Before this file:
// - import jobs looked for payload.branchCode, which the screen never sends (it sends branchId), so every branch
//   used the DEL counter;
// - export jobs looked for jobMode "EXPORT", which the settings screen never saves (it saves AIR EXPORT / SEA EXPORT),
//   and built the number as NDL/AE/26/ in code, so the export prefixes on the screen were never used;
// - a missing counter gave TEMP-IMP-<time> job numbers;
// - a start number set back to an old value gave duplicate job numbers.
//
// Prefix tokens: {BR} branch code, {FY} financial year code (e.g. 26-27), {YY} the year the FY starts (26).
const { Op } = require('sequelize');
const JobSequence = require('../models/JobSequence');

const MODES = ['AIR IMPORT', 'SEA IMPORT', 'LAND IMPORT', 'AIR EXPORT', 'SEA EXPORT', 'LAND EXPORT'];
const SHORT = { 'AIR IMPORT': 'AI', 'SEA IMPORT': 'SI', 'LAND IMPORT': 'LI', 'AIR EXPORT': 'AE', 'SEA EXPORT': 'SE', 'LAND EXPORT': 'LE' };
const defaultPrefix = (branchCode, jobMode) => `${branchCode}-${SHORT[jobMode] || 'JB'}-`;

function modeOf(shipmentMode, side) {
  const m = String(shipmentMode || '').toUpperCase();
  const t = m.startsWith('A') || m === 'COURIER' ? 'AIR' : m.startsWith('L') || m === 'ROAD' || m === 'RAIL' ? 'LAND' : 'SEA';
  return `${t} ${side}`;
}

// the branch picked at the top of the screen (branchId) wins: the export form keeps a fixed branchCode 'DEL'
async function branchCodeOf(p = {}) {
  try {
    const CompanyBranch = require('../models/CompanyBranch');
    const b = p.branchId ? await CompanyBranch.findByPk(p.branchId) : null;
    if (b) return b.branchCode;
    if (p.branchCode && String(p.branchCode).trim()) return String(p.branchCode).trim().toUpperCase();
    const d = (await CompanyBranch.findOne({ where: { isDefault: true } })) || (await CompanyBranch.findOne({ order: [['id', 'ASC']] }));
    if (d) return d.branchCode;
  } catch (e) { /* no branch table */ }
  return (p.branchCode && String(p.branchCode).trim().toUpperCase()) || 'DEL';
}

async function fyOf(financialYearId) {
  if (!financialYearId) return null;
  try { return await require('../models/FinancialYear').findByPk(financialYearId); } catch (e) { return null; }
}

function render(prefix, number, ctx = {}) {
  const fy = ctx.fy;
  const yy = fy && fy.startDate ? String(fy.startDate).slice(2, 4) : String(new Date().getFullYear() - (new Date().getMonth() < 3 ? 1 : 0)).slice(2);
  const p = String(prefix || '')
    .replace(/\{BR\}/gi, ctx.branchCode || '')
    .replace(/\{FY\}/gi, (fy && fy.code) || '')
    .replace(/\{YY\}/gi, yy);
  return `${p}${number}`;
}

// the counter row for a branch + mode: the one for this FY if there is one, else the general one (no FY).
// Old export counters were saved as jobMode "EXPORT": used when no AIR/SEA EXPORT row is there.
async function findRow(branchCode, jobMode, financialYearId, opts = {}) {
  const q = (where) => JobSequence.findOne({ where, ...opts });
  let row = null;
  if (financialYearId) row = await q({ branchCode, jobMode, financialYearId });
  if (!row) row = await q({ branchCode, jobMode, financialYearId: { [Op.is]: null } });
  if (!row) row = await q({ branchCode, jobMode });
  if (!row && jobMode.endsWith('EXPORT')) row = await q({ branchCode, jobMode: 'EXPORT' });
  return row;
}

async function jobNoTaken(jobNo, transaction) {
  const ImportJob = require('../models/ImportJob');
  const ExportJob = require('../models/ExportJob');
  return !!((await ImportJob.findOne({ where: { jobNo }, attributes: ['id'], transaction })) || (await ExportJob.findOne({ where: { jobNo }, attributes: ['id'], transaction })));
}

// first number from n that is not already a job no
async function firstFree(prefix, n, ctx, transaction) {
  let k = Number(n) > 0 ? Math.floor(Number(n)) : 1;
  for (let i = 0; i < 5000 && await jobNoTaken(render(prefix, k, ctx), transaction); i++) k++;
  return k;
}

// what the next job no will be (no change)
async function peek({ branchCode, branchId, shipmentMode, side, jobMode, financialYearId } = {}) {
  const br = await branchCodeOf({ branchCode, branchId });
  const mode = jobMode || modeOf(shipmentMode, side || 'IMPORT');
  const fy = await fyOf(financialYearId);
  const row = await findRow(br, mode, financialYearId);
  const prefix = row ? row.prefix : defaultPrefix(br, mode);
  const ctx = { branchCode: br, fy };
  const n = await firstFree(prefix, row ? row.startNumber : 1001, ctx);
  return { branchCode: br, jobMode: mode, prefix, configured: !!row, nextNumber: n, nextJobNo: render(prefix, n, ctx) };
}

// give the next job no and move the counter on (inside the job's save transaction)
async function take({ branchCode, branchId, shipmentMode, side, financialYearId } = {}, transaction) {
  const br = await branchCodeOf({ branchCode, branchId });
  const mode = modeOf(shipmentMode, side);
  const fy = await fyOf(financialYearId);
  let row = await findRow(br, mode, financialYearId, { transaction });
  if (!row) row = await JobSequence.create({ branchCode: br, jobMode: mode, prefix: defaultPrefix(br, mode), startNumber: 1001 }, { transaction });
  const ctx = { branchCode: br, fy };
  const n = await firstFree(row.prefix, row.startNumber, ctx, transaction);
  await row.update({ startNumber: n + 1 }, { transaction });
  return render(row.prefix, n, ctx);
}

module.exports = { MODES, SHORT, defaultPrefix, modeOf, branchCodeOf, fyOf, render, findRow, jobNoTaken, firstFree, peek, take };
