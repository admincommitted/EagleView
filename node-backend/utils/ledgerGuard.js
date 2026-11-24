// Ledger mix-up guard (06-Nov-2026). One party's entry must never land on, or be set off against, another party's ledger.
//
// The iCAFFE accounts carry look-alike ledgers: 46 names that differ only in spaces / dots ("SG ENTERPRISES." and
// "SG ENTERPRISES"), 69 GSTINs on more than one ledger (some on two different companies, some junk like "1111"), and
// 38 parties tied to two ledgers. The old code then "guessed" - first ledger with that GSTIN / party / name - and could post
// to the wrong one. The rules here, used by vouchers, GST invoices, OCR and the ledger master:
//   - a ledger is only ever found when exactly ONE fits; when more than one fits, nothing is guessed - the screen gets the
//     names and the user picks the account;
//   - every line of a voucher must be an existing, active ledger;
//   - a bill set-off must be for the same party: the allocation's ledger must be on the voucher, and the bill it is set
//     against must carry that same ledger;
//   - a new / renamed ledger may not look like an existing one (same letters and digits) and may not take a GSTIN that
//     another party's ledger already has (two accounts of the same party - same party link - are allowed);
//   - ledger create / change / delete / merge are written to AccLedgerAudit (who, when, before / after).
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../db');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t, __noScope: true });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const bad = (m, extra) => Object.assign(new Error(m), { status: 400 }, extra || {});
// letters and digits only: "SG ENTERPRISES." = "S.G. ENTERPRISES" = "SGENTERPRISES"
const key = (s) => String(s || '').toUpperCase().replace(/&/g, 'AND').replace(/[^A-Z0-9]/g, '');
const GSTIN_RX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
const validGstin = (g) => GSTIN_RX.test(String(g || '').toUpperCase().replace(/\s/g, ''));

let hasActive = null;
async function activeCol(t) {
  if (hasActive === null) hasActive = (await q('PRAGMA table_info(AccountLedgers)', [], t)).some(c => c.name === 'isActive');
  return hasActive ? 'coalesce(isActive, 1) = 1' : '1 = 1';
}

// one ledger by party / GSTIN / name - or an error listing the look-alikes
async function findOne({ ledgerId, partyId, gstin, name }, t) {
  const act = await activeCol(t);
  if (ledgerId) {
    const r = (await q(`SELECT id, name FROM AccountLedgers WHERE id = ? AND ${act}`, [Number(ledgerId)], t))[0];
    if (!r) throw bad('The account picked is not an active ledger any more - pick it again');
    return r.id;
  }
  const pick = (rows, how) => {
    if (rows.length === 1) return rows[0].id;
    if (rows.length > 1) throw bad('More than one account ' + how + ': ' + rows.slice(0, 5).map(r => r.name).join(' / ') + ' - pick the account (Ledger) by hand', { candidates: rows.slice(0, 10) });
    return null;
  };
  if (partyId) { const id = pick(await q(`SELECT id, name FROM AccountLedgers WHERE partyId = ? AND ${act}`, [Number(partyId)], t), 'is tied to this party'); if (id) return id; }
  const g = String(gstin || '').toUpperCase().replace(/\s/g, '');
  if (validGstin(g)) {
    const rows = await q(`SELECT id, name FROM AccountLedgers WHERE upper(replace(gstin, ' ', '')) = ? AND ${act}`, [g], t);
    // a GSTIN hit is used only when the name also fits (a GSTIN typed against the wrong party must not move the entry)
    const nk = key(name);
    const fit = nk ? rows.filter(r => { const k = key(r.name); return k.startsWith(nk.slice(0, 6)) || nk.startsWith(k.slice(0, 6)); }) : rows;
    const id = pick(fit.length ? fit : (nk ? [] : rows), 'has GSTIN ' + g);
    if (id) return id;
  }
  const nk = key(name);
  if (nk) {
    const rows = (await q(`SELECT id, name FROM AccountLedgers WHERE ${act}`, [], t)).filter(r => key(r.name) === nk);
    const id = pick(rows, 'has this name');
    if (id) return id;
  }
  return null;
}

// every line: an existing, active ledger
async function checkLines(ledgerIds, t) {
  const ids = [...new Set((ledgerIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return;
  const rows = await q(`SELECT id, name${hasActive !== false ? ', coalesce(isActive, 1) act' : ''} FROM AccountLedgers WHERE id IN (${ids.join(',')})`, [], t).catch(async () => { hasActive = false; return q(`SELECT id, name FROM AccountLedgers WHERE id IN (${ids.join(',')})`, [], t); });
  const got = new Map(rows.map(r => [Number(r.id), r]));
  const missing = ids.filter(i => !got.has(i));
  if (missing.length) throw bad('Account not found (id ' + missing.join(', ') + ') - it may have been merged or deleted; pick the account again');
  const inactive = rows.filter(r => r.act !== undefined && Number(r.act) === 0);
  if (inactive.length) throw bad('Account ' + inactive.map(r => r.name).join(', ') + ' is inactive - pick an active account');
}

// a set-off is for the voucher's own party and against a bill of that same party
async function checkAllocations(allocs, lineLedgerIds, selfId, t) {
  const onVoucher = new Set((lineLedgerIds || []).map(Number));
  for (const a of allocs || []) {
    const led = Number(a.ledgerId);
    if (!led) continue;
    if (!onVoucher.has(led)) throw bad('A bill is set off for an account that is not on this voucher - set off only the party of this voucher');
    const against = Number(a.againstVoucherId) || null;
    if (!against) continue;
    if (selfId && against === Number(selfId)) throw bad('A voucher cannot be set off against itself');
    const hit = await q('SELECT 1 FROM VoucherDetails WHERE voucherId = ? AND ledgerId = ? LIMIT 1', [against, led], t);
    if (!hit.length) {
      const v = (await q('SELECT voucherNumber FROM Vouchers WHERE id = ?', [against], t))[0];
      throw bad('Bill ' + (v ? v.voucherNumber : '#' + against) + ' is not a bill of this party - it cannot be set off here');
    }
  }
}

// a new / changed ledger must not look like another one or take another party's GSTIN
async function checkLedgerMaster({ id, name, gstin, partyId }, t) {
  // only what is new or changed is checked (the iCAFFE look-alikes already in the books can still be edited)
  const prev = id ? (await q('SELECT name, gstin, partyId FROM AccountLedgers WHERE id = ?', [Number(id)], t))[0] : null;
  const nk = key(name);
  if (nk && !(prev && key(prev.name) === nk)) {
    const same = (await q('SELECT id, name FROM AccountLedgers WHERE id <> ?', [Number(id) || 0], t)).filter(r => key(r.name) === nk);
    if (same.length) throw bad('An account "' + same[0].name + '" already exists - it differs only in spaces / dots. Use that account (or Merge Account) instead of a second one.');
  }
  const g = String(gstin || '').toUpperCase().replace(/\s/g, '');
  if (g && !(prev && String(prev.gstin || '').toUpperCase().replace(/\s/g, '') === g)) {
    const cur = id ? (await q('SELECT partyId FROM AccountLedgers WHERE id = ?', [Number(id)], t))[0] : null;
    const pid = partyId || (cur && cur.partyId) || null;
    const other = (await q("SELECT id, name, partyId FROM AccountLedgers WHERE id <> ? AND upper(replace(gstin, ' ', '')) = ?", [Number(id) || 0, g], t))
      .filter(r => !(pid && r.partyId && Number(r.partyId) === Number(pid)));
    if (other.length) throw bad('GSTIN ' + g + ' is already on account "' + other[0].name + '" - one GSTIN belongs to one party. Check the GSTIN, or use that account.');
  }
}

let auditReady = null;
async function auditLedger(t, ledgerId, action, by, before, after) {
  auditReady = auditReady || x(`CREATE TABLE IF NOT EXISTS AccLedgerAudit (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER, ledgerName TEXT, action TEXT, byUser TEXT,
    beforeJson TEXT, afterJson TEXT, createdAt DATETIME)`).then(() => x('CREATE INDEX IF NOT EXISTS idx_accledaudit_ledger ON AccLedgerAudit (ledgerId)')).catch(e => { auditReady = null; throw e; });
  await auditReady;
  await x('INSERT INTO AccLedgerAudit (ledgerId, ledgerName, action, byUser, beforeJson, afterJson, createdAt) VALUES (?,?,?,?,?,?,?)',
    [ledgerId || null, (after && after.name) || (before && before.name) || null, action, by || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, new Date().toISOString()], t);
}

// look-alike report: names, GSTINs and party links that point at more than one ledger
async function lookAlikes() {
  const rows = await q('SELECT l.id, l.name, l.gstin, l.partyId, l.icaffeId, g.name groupName FROM AccountLedgers l LEFT JOIN AccountGroups g ON g.id = l.groupId');
  const by = (f) => { const m = new Map(); for (const r of rows) { const k = f(r); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m.entries()].filter(([, v]) => v.length > 1); };
  const out = [];
  for (const [k, v] of by(r => key(r.name))) out.push({ check: 'Same name (only spaces / dots differ)', value: v[0].name, accounts: v });
  for (const [k, v] of by(r => { const g = String(r.gstin || '').toUpperCase().replace(/\s/g, ''); return g || null; })) out.push({ check: validGstin(k) ? 'Same GSTIN on more than one account' : 'Invalid GSTIN on more than one account', value: k, accounts: v });
  for (const [k, v] of by(r => r.partyId || null)) out.push({ check: 'One party tied to more than one account', value: 'party #' + k, accounts: v });
  return out;
}

module.exports = { key, validGstin, findOne, checkLines, checkAllocations, checkLedgerMaster, auditLedger, lookAlikes };
