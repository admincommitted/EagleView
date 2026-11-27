// Branch + financial year scope for the accounts screens.
//
// The branch and financial year picked in the top bar travel with every /api call as the headers X-Branch (a branch
// code, or ALL) and X-FY (financial year id). For the accounts routes:
//   - which branches a user may see: an admin sees every branch; anyone else only the branch(es) in User Management
//     (Users.branch, comma separated; blank = the default branch). Asking for another branch is refused (403), and
//     "ALL" means all of the user's own branches - never more. This is checked here, on the server, not on the screen.
//   - while a GET request runs, every SELECT that reads the Vouchers table (raw SQL or Sequelize) is limited to those
//     branches: "FROM Vouchers v" is read as "FROM (SELECT * FROM Vouchers WHERE <branch>) v". So lists, reports,
//     balances, search, a voucher opened by id - all show only the branches in scope. A voucher saved with no branch
//     counts as the default branch (head office).
//   - a change (POST / PUT / DELETE) to an existing voucher of a branch outside the user's branches is refused.
//   - ledger opening balances (iCAFFE's opening, before Apr-2022) are company-wide; they count under the default
//     branch, so they show for "All" and for the default branch, not for another single branch.
//   - X-FY: the year used when a screen asks for "the current year" without naming one.
import { AsyncLocalStorage } from 'node:async_hooks';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

const BRANCH_CODE = /^[A-Z0-9]{2,8}$/;
const FALLBACK_DEFAULT_BRANCH = 'DEL';
const BRANCH_CACHE_TTL_MS = 60000;
const USER_BRANCH_CACHE_TTL_MS = 30000;
const ALL_BRANCHES_KEY = 'ALL';
const VOUCHER_CHANGE_PATH = /\/(?:vouchers|update-status|purchase-info|documents)\/(\d+)(?:\/|$)/;

const requestScope = new AsyncLocalStorage();

// __noScope: these lookups must see every branch, also while a scoped request runs
const selectRows = (sql, replacements = []) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    __noScope: true,
  });

let branchCache = { checkedAt: 0, def: FALLBACK_DEFAULT_BRANCH, codes: [] };

async function activeBranches() {
  if (Date.now() - branchCache.checkedAt < BRANCH_CACHE_TTL_MS) return branchCache;
  const rows = await selectRows(
    "SELECT branchCode, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id",
  ).catch(() => []);
  const codes = rows.map((row) => String(row.branchCode || '').toUpperCase()).filter((code) => BRANCH_CODE.test(code));
  branchCache = { checkedAt: Date.now(), def: codes[0] || FALLBACK_DEFAULT_BRANCH, codes };
  return branchCache;
}

const userBranchCache = new Map(); // userId -> { checkedAt, list }

/** The branch codes a user may see; null = every branch (admin). */
export async function allowedFor(user) {
  const { def, codes } = await activeBranches();
  if (!user) return [def];
  if (String(user.role || '').toLowerCase() === 'admin') return null;
  const cached = userBranchCache.get(user.id);
  if (cached && Date.now() - cached.checkedAt < USER_BRANCH_CACHE_TTL_MS) return cached.list;
  const userRow = (await selectRows('SELECT branch FROM Users WHERE id = ?', [user.id]).catch(() => []))[0] || {};
  let list = String(userRow.branch || '')
    .toUpperCase()
    .split(/[,;\s]+/)
    .filter((code) => BRANCH_CODE.test(code) && codes.includes(code));
  if (!list.length) list = [def];
  userBranchCache.set(user.id, { checkedAt: Date.now(), list });
  return list;
}

const branchClause = (list, def) =>
  list
    ? `coalesce(nullif(upper(trim(branchCode)), ''), '${def}') IN (${list.map((code) => `'${code}'`).join(', ')})`
    : null;

// "FROM Vouchers v" / "JOIN `Vouchers` AS `Voucher`" -> the same table limited to the branches in scope
const SQL_KEYWORDS =
  '(?:WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP|ORDER|LIMIT|UNION|USING|HAVING|SET|AND|OR|NATURAL)';
const VOUCHERS_TABLE_REFERENCE = new RegExp(
  `\\b(FROM|JOIN)(\\s+)([\`"]?)Vouchers\\3(?=[\\s,)]|$)((\\s+AS)?\\s+([\`"]?)(?!${SQL_KEYWORDS}\\b)([A-Za-z_]\\w*)\\6)?`,
  'gi',
);

export function rewrite(sql, clause) {
  return sql.replace(
    VOUCHERS_TABLE_REFERENCE,
    (match, keyword, whitespace, quote, aliasPart, asKeyword, aliasQuote, alias) =>
      `${keyword}${whitespace}(SELECT * FROM Vouchers WHERE ${clause}) AS ${alias ? aliasQuote + alias + aliasQuote : 'Vouchers'}`,
  );
}

const READ_QUERY = /^\s*(SELECT|WITH)\b/i;

let queryPatched = false;

// sequelize.query is wrapped once, so every read of Vouchers inside a scoped request gets the branch filter
function patchSequelizeQuery() {
  if (queryPatched) return;
  queryPatched = true;
  const originalQuery = sequelize.query.bind(sequelize);
  sequelize.query = function scopedQuery(sql, options) {
    const scope = requestScope.getStore();
    if (scope && scope.clause && !(options && options.__noScope)) {
      const text = typeof sql === 'string' ? sql : sql && sql.query;
      if (typeof text === 'string' && READ_QUERY.test(text) && /Vouchers/.test(text)) {
        const scopedText = rewrite(text, scope.clause);
        if (scopedText !== text) sql = typeof sql === 'string' ? scopedText : { ...sql, query: scopedText };
      }
    }
    return originalQuery(sql, options);
  };
}

// a change to an existing voucher must be in the user's branches; returns the refusal text, or null
async function voucherBranchRefusal(req, allowed, def) {
  const match = VOUCHER_CHANGE_PATH.exec(req.path);
  if (!match) return null;
  const voucher = (await selectRows('SELECT branchCode FROM Vouchers WHERE id = ?', [match[1]]))[0];
  if (!voucher) return null;
  const branch =
    String(voucher.branchCode || '')
      .trim()
      .toUpperCase() || def;
  if (allowed.includes(branch)) return null;
  return `This voucher belongs to branch ${branch} - you do not have access to it`;
}

export async function middleware(req, res, next) {
  try {
    patchSequelizeQuery();
    const { def, codes } = await activeBranches();
    const allowed = await allowedFor(req.user);
    const wanted = String(req.get('x-branch') || '')
      .trim()
      .toUpperCase();

    let list;
    if (wanted && wanted !== ALL_BRANCHES_KEY) {
      if (!BRANCH_CODE.test(wanted) || (codes.length && !codes.includes(wanted))) {
        return res.status(400).json({ error: `Unknown branch ${wanted}` });
      }
      if (allowed && !allowed.includes(wanted)) {
        return res.status(403).json({ error: `You do not have access to branch ${wanted}` });
      }
      list = [wanted];
    } else {
      list = allowed; // ALL (or nothing sent): every branch the user may see
    }

    const store = {
      list,
      def,
      fyId: parseInt(req.get('x-fy'), 10) || null,
      includeOpening: !list || list.includes(def),
      key: list ? list.join(',') : ALL_BRANCHES_KEY,
      clause: null,
    };

    if (req.method !== 'GET' && allowed) {
      const refusalText = await voucherBranchRefusal(req, allowed, def);
      if (refusalText) return res.status(403).json({ error: refusalText });
    }
    if (req.method === 'GET') store.clause = branchClause(list, def);
    return requestScope.run(store, next);
  } catch (error) {
    return next(error);
  }
}

export const current = () => requestScope.getStore() || null;

// ledger opening balances count under the default branch only; changes (merge etc.) always see the full opening
export const openingOn = () => {
  const scope = current();
  return !scope || !scope.clause || scope.includeOpening;
};

export const scopeKey = () => {
  const scope = current();
  return scope ? scope.key : ALL_BRANCHES_KEY;
};

export const fyId = () => {
  const scope = current();
  return scope ? scope.fyId : null;
};

/** GET /api/branch-scope/me - the branches this user may pick in the top bar. */
export async function me(req, res) {
  try {
    const { def, codes } = await activeBranches();
    const allowed = await allowedFor(req.user);
    res.json({
      all: !allowed,
      branches: allowed || codes,
      defaultBranch: def,
      canPickAll: !allowed || allowed.length > 1,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
