import { openingOn, scopeKey } from '../../../../middlewares/branchScope.middleware.js';
import { VALID_VOUCHER, readRows, selectRows } from './hubQuery.service.js';
import { toNumber } from './hubFormat.service.js';
import { financialYearStartOf } from './financialYear.service.js';

// Dr / Cr movement per ledger between two dates, cached per (branch scope, from, to) until vouchers change: with the
// iCAFFE history (3 lakh+ vouchers) one pass takes seconds.
const MAX_CACHED_RANGES = 40;
const MAX_CACHED_EARLIER_YEARS = 20;
const EARLIER_YEARS_CACHE_MS = 30 * 60000;

const rangeCache = new Map();
let rangeCacheVersion = '';
const earlierYearsCache = new Map();

/** Changes whenever a voucher is added, edited or deleted. */
export async function voucherDataVersion() {
  const vouchers = (await selectRows('SELECT count(*) n, max(id) mx, max(updatedAt) up FROM Vouchers'))[0] || {};
  const details = (await selectRows('SELECT max(id) mx FROM VoucherDetails'))[0] || {};
  return [vouchers.n, vouchers.mx, vouchers.up, details.mx].join('|');
}

/** Map ledgerId -> { dr, cr } of the valid vouchers dated from..to (inclusive); from = null -> everything up to `to`. */
export async function ledgerMovements(from, to) {
  const version = await voucherDataVersion();
  if (version !== rangeCacheVersion) {
    rangeCache.clear();
    rangeCacheVersion = version;
  }
  const key = scopeKey() + '~' + (from || '') + '~' + (to || '');
  if (!rangeCache.has(key)) {
    if (rangeCache.size > MAX_CACHED_RANGES) rangeCache.clear();
    rangeCache.set(
      key,
      forgetWhenFailed(computeMovements(from, to), () => rangeCache.delete(key)),
    );
  }
  return rangeCache.get(key);
}

async function forgetWhenFailed(pending, forget) {
  try {
    return await pending;
  } catch (error) {
    forget();
    throw error;
  }
}

// "everything up to a date" = the years before that date's financial year (kept, see earlierYearsMovements) + that
// year, so a voucher saved today does not make the whole history be added up again
function computeMovements(from, to) {
  const cut = !from && to ? financialYearStartOf(String(to).slice(0, 10)) : null;
  if (cut && cut <= String(to).slice(0, 10)) return earlierPlusCurrentYear(cut, to);
  return sumMovements({ from, to });
}

async function earlierPlusCurrentYear(cut, to) {
  const [earlier, currentYear] = await Promise.all([earlierYearsMovements(cut), ledgerMovements(cut, to)]);
  return addMovements(earlier, currentYear);
}

function addMovements(first, second) {
  const total = new Map();
  for (const movements of [first, second]) {
    for (const [ledgerId, movement] of movements) {
      const sum = total.get(ledgerId) || { dr: 0, cr: 0 };
      total.set(ledgerId, { dr: sum.dr + movement.dr, cr: sum.cr + movement.cr });
    }
  }
  return total;
}

/** Earlier years' movements are dropped from the cache when the ledgers are merged. */
export const clearEarlierYearsMovements = () => earlierYearsCache.clear();

// Movement of every ledger before `cut` (the earlier financial years). Kept until one of those vouchers changes:
//   - count / last change / total of the vouchers dated before `cut` differ, or
//   - a voucher line added since (edits write new lines) belongs to a voucher dated before `cut`, or
//   - ledgers were merged (clearEarlierYearsMovements), or 30 minutes passed
async function earlierYearsMovements(cut) {
  const key = scopeKey() + '~' + cut;
  const signature = JSON.stringify(
    (
      await readRows(
        'SELECT count(*) n, max(updatedAt) up, round(sum(totalAmount), 2) t FROM Vouchers v WHERE v.date < ?',
        [cut],
      )
    )[0] || {},
  );
  const lastDetailId = Number(((await readRows('SELECT max(id) mx FROM VoucherDetails'))[0] || {}).mx) || 0;
  let cached = earlierYearsCache.get(key);
  if (cached && (cached.signature !== signature || Date.now() - cached.at > EARLIER_YEARS_CACHE_MS)) cached = null;
  if (cached && lastDetailId > cached.lastDetailId) {
    const newLines = await countNewEarlierLines(cached.lastDetailId, cut);
    if (newLines) cached = null;
    else cached.lastDetailId = lastDetailId;
  }
  if (!cached) {
    if (earlierYearsCache.size > MAX_CACHED_EARLIER_YEARS) earlierYearsCache.clear();
    const entry = { signature, lastDetailId, at: Date.now(), movements: sumMovements({ before: cut }) };
    cached = entry;
    earlierYearsCache.set(key, entry);
    forgetEarlierYearsWhenFailed(key, entry);
  }
  return cached.movements;
}

async function countNewEarlierLines(sinceDetailId, cut) {
  const row =
    (
      await readRows(
        'SELECT count(*) n FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE d.id > ? AND v.date < ?',
        [sinceDetailId, cut],
      )
    )[0] || {};
  return Number(row.n) || 0;
}

async function forgetEarlierYearsWhenFailed(key, entry) {
  try {
    await entry.movements;
  } catch {
    if (earlierYearsCache.get(key) === entry) earlierYearsCache.delete(key);
  }
}

async function sumMovements({ from, to, before }) {
  const where = [VALID_VOUCHER];
  const replacements = [];
  if (from) {
    where.push('v.date >= ?');
    replacements.push(from);
  }
  if (to) {
    where.push('v.date <= ?');
    replacements.push(to);
  }
  if (before) {
    where.push('v.date < ?');
    replacements.push(before);
  }
  const rows = await readRows(
    `SELECT d.ledgerId, sum(CASE WHEN d.dc = 'Dr' THEN d.amount ELSE 0 END) dr, sum(CASE WHEN d.dc = 'Cr' THEN d.amount ELSE 0 END) cr
    FROM VoucherDetails d JOIN Vouchers v ON v.id = d.voucherId WHERE ${where.join(' AND ')} GROUP BY d.ledgerId`,
    replacements,
  );
  return new Map(rows.map((row) => [row.ledgerId, { dr: toNumber(row.dr), cr: toNumber(row.cr) }]));
}

export const NO_MOVEMENT = Object.freeze({ dr: 0, cr: 0 });

/** The ledger's own opening (iCAFFE's, before Apr-2022) is company-wide: it counts under the default branch only. */
export const signedOpening = (ledger) =>
  (openingOn() ? 1 : 0) * (ledger.balanceType === 'Cr' ? -1 : 1) * toNumber(ledger.openingBalance);
