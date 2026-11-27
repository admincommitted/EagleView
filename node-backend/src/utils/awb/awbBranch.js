// Branch and financial year of air waybills (AWB / MAWB / HAWB).
//   - a new AWB gets the branch picked in the top bar (X-Branch header; for "All" the user's own branch, else the
//     default branch). branchId = CompanyBranches.id.
//   - lists / search / tracking show only the branch picked (or, for "All", the user's branches). An AWB without a
//     branch counts as the default branch (head office) - as vouchers do.
//   - financial year: from the AWB's own date (executed date; today if empty), not from the year picked in the top bar.
//     Lists / tracking (and Search when no dates / AWB no are given) show the year picked in the top bar (X-FY).
import { QueryTypes } from 'sequelize';
import { sequelize, Op } from '../../config/database.js';
import { allowedFor } from '../../middlewares/branchScope.middleware.js';

const CACHE_TTL_MS = 60000;
const IST_OFFSET_MS = 19800000;

let branchCache = { at: 0, rows: [] };
async function branches() {
  if (Date.now() - branchCache.at < CACHE_TTL_MS) return branchCache.rows;
  const rows = await sequelize
    .query(
      "SELECT id, upper(trim(branchCode)) code, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id",
      { type: QueryTypes.SELECT, __noScope: true },
    )
    .catch(() => []);
  branchCache = { at: Date.now(), rows };
  return rows;
}

// { saveId, ids (null = every branch), def, defIn }
async function scope(req) {
  const rows = await branches();
  if (!rows.length) return { saveId: null, ids: null, def: null };
  const defaultBranch = rows[0];
  const branchByCode = new Map(rows.map((row) => [row.code, row]));
  const allowed = await allowedFor(req.user); // null = every branch (admin)
  const wanted = String((req.get && req.get('x-branch')) || '')
    .trim()
    .toUpperCase();
  const wantedIsAllowed =
    wanted && wanted !== 'ALL' && branchByCode.has(wanted) && (!allowed || allowed.includes(wanted));
  const codes = wantedIsAllowed ? [wanted] : allowed; // ALL / nothing: the user's branches (null = all)
  const saveCode = codes && codes.length ? codes[0] : allowed && allowed.length ? allowed[0] : defaultBranch.code;
  const ids = codes
    ? codes
        .map((code) => branchByCode.get(code))
        .filter(Boolean)
        .map((row) => row.id)
    : null;
  return {
    saveId: (branchByCode.get(saveCode) || defaultBranch).id,
    ids,
    def: defaultBranch.id,
    defIn: !codes || codes.includes(defaultBranch.code),
  };
}

// Sequelize where for Airwaybill / HouseAWB rows in scope ({} when every branch)
async function where(req) {
  const branchScope = await scope(req);
  if (!branchScope.ids) return {};
  const anyOf = [{ branchId: { [Op.in]: branchScope.ids.length ? branchScope.ids : [-1] } }];
  if (branchScope.defIn) anyOf.push({ branchId: null });
  return { [Op.or]: anyOf };
}

let yearCache = { at: 0, rows: [] };
async function years() {
  if (Date.now() - yearCache.at < CACHE_TTL_MS) return yearCache.rows;
  const rows = await sequelize
    .query('SELECT id, startDate, endDate FROM FinancialYears WHERE coalesce(isDeleted, 0) = 0 ORDER BY startDate', {
      type: QueryTypes.SELECT,
      __noScope: true,
    })
    .catch(() => []);
  yearCache = {
    at: Date.now(),
    rows: rows.map((row) => ({
      id: row.id,
      start: String(row.startDate || '').slice(0, 10),
      end: String(row.endDate || '').slice(0, 10),
    })),
  };
  return yearCache.rows;
}

const ymd = (value) => {
  const text = String(value || '').trim();
  let match;
  if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text))) return `${match[1]}-${match[2]}-${match[3]}`;
  if ((match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text))) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  return '';
};
const todayInIndia = () => new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);

// the financial year id of an AWB date (executed date; today when empty or not a date)
async function fyFor(date) {
  const day = ymd(date) || todayInIndia();
  const year = (await years()).find((row) => row.start && row.end && day >= row.start && day <= row.end);
  return year ? year.id : null;
}

// Sequelize where for the year picked in the top bar ({} when none sent); an AWB without a year counts by its date
async function fyWhere(req) {
  const id = parseInt((req.get && req.get('x-fy')) || '', 10);
  if (!id) return {};
  const year = (await years()).find((row) => row.id === id);
  if (!year) return {};
  return {
    [Op.or]: [
      { financialYearId: id },
      {
        [Op.and]: [
          { financialYearId: null },
          { createdAt: { [Op.gte]: new Date(year.start + 'T00:00:00+05:30') } },
          { createdAt: { [Op.lte]: new Date(year.end + 'T23:59:59+05:30') } },
        ],
      },
    ],
  };
}

export { scope, where, fyFor, fyWhere };
