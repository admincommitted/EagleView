// Branch of air waybills (AWB / MAWB / HAWB), 10-Nov-2026.
// Before, the AWB screens never sent a branch, so every AWB was saved with branchId empty and every user saw every
// branch's AWBs. Now:
//   - a new AWB gets the branch picked in the top bar (X-Branch header; for "All" the user's own branch, else the
//     default branch). branchId = CompanyBranches.id.
//   - lists / search / tracking show only the branch picked (or, for "All", the user's branches). An AWB without a
//     branch (all the old ones) counts as the default branch (head office) - as vouchers do.
//   - financial year: from the AWB's own date (executed date; today if empty), not from the year picked in the top bar.
//     Lists / tracking (and Search when no dates / AWB no are given) show the year picked in the top bar (X-FY).
const { Op } = require('sequelize');
const { sequelize } = require('../db');
const { allowedFor } = require('./branchScope');

let cache = { at: 0, rows: [] };
async function branches() {
  if (Date.now() - cache.at < 60000) return cache.rows;
  const rows = await sequelize.query("SELECT id, upper(trim(branchCode)) code, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id",
    { type: sequelize.QueryTypes.SELECT, __noScope: true }).catch(() => []);
  cache = { at: Date.now(), rows };
  return rows;
}

// { saveId, ids (null = every branch), def }
async function scope(req) {
  const rows = await branches();
  if (!rows.length) return { saveId: null, ids: null, def: null };
  const def = rows[0];
  const byCode = new Map(rows.map(r => [r.code, r]));
  const allowed = await allowedFor(req.user); // null = every branch (admin)
  const want = String((req.get && req.get('x-branch')) || '').trim().toUpperCase();
  let codes;
  if (want && want !== 'ALL' && byCode.has(want) && (!allowed || allowed.includes(want))) codes = [want];
  else codes = allowed; // ALL / nothing: the user's branches (null = all)
  const saveCode = codes && codes.length ? codes[0] : (allowed && allowed.length ? allowed[0] : def.code);
  const ids = codes ? codes.map(c => byCode.get(c)).filter(Boolean).map(r => r.id) : null;
  return { saveId: (byCode.get(saveCode) || def).id, ids, def: def.id, defIn: !codes || codes.includes(def.code) };
}

// Sequelize where for Airwaybill / HouseAWB rows in scope ({} when every branch)
async function where(req) {
  const s = await scope(req);
  if (!s.ids) return {};
  const or = [{ branchId: { [Op.in]: s.ids.length ? s.ids : [-1] } }];
  if (s.defIn) or.push({ branchId: null });
  return { [Op.or]: or };
}

// ---- financial year ----
let fyCache = { at: 0, rows: [] };
async function years() {
  if (Date.now() - fyCache.at < 60000) return fyCache.rows;
  const rows = await sequelize.query("SELECT id, startDate, endDate FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY startDate",
    { type: sequelize.QueryTypes.SELECT, __noScope: true }).catch(() => []);
  fyCache = { at: Date.now(), rows: rows.map(r => ({ id: r.id, start: String(r.startDate || '').slice(0, 10), end: String(r.endDate || '').slice(0, 10) })) };
  return fyCache.rows;
}
const ymd = (v) => {
  const t = String(v || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
const todayIn = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);
// the financial year id of an AWB date (executed date; today when empty or not a date)
async function fyFor(date) {
  const d = ymd(date) || todayIn();
  const y = (await years()).find(r => r.start && r.end && d >= r.start && d <= r.end);
  return y ? y.id : null;
}
// Sequelize where for the year picked in the top bar ({} when none sent); an AWB without a year counts by its date
async function fyWhere(req) {
  const id = parseInt((req.get && req.get('x-fy')) || '', 10);
  if (!id) return {};
  const y = (await years()).find(r => r.id === id);
  if (!y) return {};
  return { [Op.or]: [{ financialYearId: id }, { [Op.and]: [{ financialYearId: null }, { createdAt: { [Op.gte]: new Date(y.start + 'T00:00:00+05:30') } }, { createdAt: { [Op.lte]: new Date(y.end + 'T23:59:59+05:30') } }] }] };
}

module.exports = { scope, where, fyFor, fyWhere };
