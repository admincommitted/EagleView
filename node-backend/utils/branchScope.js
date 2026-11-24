// Branch + financial year scope for the accounts screens (06-Nov-2026).
//
// The branch and financial year picked in the top bar travel with every /api call as the headers X-Branch (a branch
// code, or ALL) and X-FY (financial year id). For /api/accounts-hub and /api/vouchers:
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
const { AsyncLocalStorage } = require('async_hooks');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');

const als = new AsyncLocalStorage();
const CODE = /^[A-Z0-9]{2,8}$/;
const q = (sql, p = []) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, __noScope: true });

let cache = { at: 0, def: 'DEL', codes: [] };
async function branches() {
  if (Date.now() - cache.at < 60000) return cache;
  const rows = await q("SELECT branchCode, isDefault FROM CompanyBranches WHERE coalesce(status, 'Active') <> 'Inactive' ORDER BY isDefault DESC, id").catch(() => []);
  const codes = rows.map(r => String(r.branchCode || '').toUpperCase()).filter(c => CODE.test(c));
  cache = { at: Date.now(), def: codes[0] || 'DEL', codes };
  return cache;
}
const userCache = new Map();
async function allowedFor(user) {
  const { def, codes } = await branches();
  if (!user) return [def];
  if (String(user.role || '').toLowerCase() === 'admin') return null; // every branch
  const c = userCache.get(user.id);
  if (c && Date.now() - c.at < 30000) return c.list;
  const u = (await q('SELECT branch FROM Users WHERE id = ?', [user.id]).catch(() => []))[0] || {};
  let list = String(u.branch || '').toUpperCase().split(/[,;\s]+/).filter(x => CODE.test(x) && codes.includes(x));
  if (!list.length) list = [def];
  userCache.set(user.id, { at: Date.now(), list });
  return list;
}

const clauseOf = (list, def) => (list ? `coalesce(nullif(upper(trim(branchCode)), ''), '${def}') IN (${list.map(c => `'${c}'`).join(', ')})` : null);

// "FROM Vouchers v" / "JOIN `Vouchers` AS `Voucher`" -> the same table limited to the branches in scope
const KW = '(?:WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP|ORDER|LIMIT|UNION|USING|HAVING|SET|AND|OR|NATURAL)';
const RX = new RegExp('\\b(FROM|JOIN)(\\s+)([`"]?)Vouchers\\3(?=[\\s,)]|$)((\\s+AS)?\\s+([`"]?)(?!' + KW + '\\b)([A-Za-z_]\\w*)\\6)?', 'gi');
function rewrite(sql, clause) {
  return sql.replace(RX, (m, kw, ws, qt, aliasPart, asKw, aq, alias) => `${kw}${ws}(SELECT * FROM Vouchers WHERE ${clause}) AS ${alias ? aq + alias + aq : 'Vouchers'}`);
}

let patched = false;
function patch() {
  if (patched) return; patched = true;
  const orig = sequelize.query.bind(sequelize);
  sequelize.query = function (sql, opts) {
    const s = als.getStore();
    if (s && s.clause && !(opts && opts.__noScope)) {
      const text = typeof sql === 'string' ? sql : sql && sql.query;
      if (typeof text === 'string' && /^\s*(SELECT|WITH)\b/i.test(text) && /Vouchers/.test(text)) {
        const nt = rewrite(text, s.clause);
        if (nt !== text) sql = typeof sql === 'string' ? nt : { ...sql, query: nt };
      }
    }
    return orig(sql, opts);
  };
}

async function middleware(req, res, next) {
  try {
    patch();
    const { def, codes } = await branches();
    const allowed = await allowedFor(req.user);
    const want = String(req.get('x-branch') || '').trim().toUpperCase();
    let list;
    if (want && want !== 'ALL') {
      if (!CODE.test(want) || (codes.length && !codes.includes(want))) return res.status(400).json({ error: 'Unknown branch ' + want });
      if (allowed && !allowed.includes(want)) return res.status(403).json({ error: 'You do not have access to branch ' + want });
      list = [want];
    } else list = allowed; // ALL (or nothing sent): every branch the user may see
    const fyId = parseInt(req.get('x-fy'), 10) || null;
    const store = { list, def, fyId, includeOpening: !list || list.includes(def), key: (list ? list.join(',') : 'ALL'), clause: null };
    // a change to an existing voucher must be in the user's branches
    if (req.method !== 'GET' && allowed) {
      const m = /\/(?:vouchers|update-status|purchase-info|documents)\/(\d+)(?:\/|$)/.exec(req.path);
      if (m) {
        const v = (await q('SELECT branchCode FROM Vouchers WHERE id = ?', [m[1]]))[0];
        const b = v ? (String(v.branchCode || '').trim().toUpperCase() || def) : null;
        if (v && !allowed.includes(b)) return res.status(403).json({ error: 'This voucher belongs to branch ' + b + ' - you do not have access to it' });
      }
    }
    if (req.method === 'GET') store.clause = clauseOf(list, def);
    als.run(store, next);
  } catch (e) { next(e); }
}

const current = () => als.getStore() || null;
// ledger opening balances count under the default branch only
const openingOn = () => { const s = current(); return !s || !s.clause || s.includeOpening; }; // changes (merge etc.) always see the full opening
const scopeKey = () => { const s = current(); return s ? s.key : 'ALL'; };
const fyId = () => { const s = current(); return s ? s.fyId : null; };

// GET /api/branch-scope/me - the branches this user may pick in the top bar
async function me(req, res) {
  try {
    const { def, codes } = await branches();
    const allowed = await allowedFor(req.user);
    res.json({ all: !allowed, branches: allowed || codes, defaultBranch: def, canPickAll: !allowed || allowed.length > 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { middleware, me, current, openingOn, scopeKey, fyId, rewrite, allowedFor };
