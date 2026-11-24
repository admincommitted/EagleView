// iCAFFE accounts masters into EagleView Accounts (05-Nov-2026).
// Source: _tariff_load\icaffe_accounts_20261105.json - read-only crawl of iCAFFE (Account Master, Group Master, GST Charges).
//   Groups  : iCAFFE's 179 groups. A group EagleView already has (same name, same nature) is used; the rest are added under
//             their iCAFFE parent. Each group keeps its iCAFFE id (AccountGroups.icaffeId, e.g. GRP/219).
//   Ledgers : iCAFFE's 7,647 accounts with their group, credit days / limit, PAN, TDS, blacklist, MSME, dealing branch.
//             AccountLedgers.icaffeId = ACC/7414; partyId = the Party master party with the same iCAFFE code (SHP/2854, AGT/1704);
//             GSTIN / address / state from that party's default branch. A ledger EagleView already has with the same name is
//             updated, not doubled. Three iCAFFE names occur twice: the second gets " - ACC/<id>" after its name.
//   Opening : iCAFFE's bill-wise opening entries (99,003 bills, entered 01-02-2023) go to AccLedgerOpenings;
//             the ledger's opening balance = their net (Dr / Cr).
//   Charges : iCAFFE's 265 GST charges into AccGstCharges with SAC, GST %, income / expense ledger and the six GST heads
//             (output and input IGST / CGST / SGST) the charge posts to - iCAFFE posts GST charge-wise to those heads.
// Nothing is deleted. One transaction; a full copy of the database is written to backups\ first.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const SRC = process.env.EDI_SRC || path.join(__dirname, '_tariff_load', 'icaffe_accounts_20261105.json');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_accounts_' + stamp + '.sqlite');
const LOG = path.join(path.dirname(SRC), 'icaffe_accounts_load_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00');
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const t0 = (v, n = 255) => { const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, n) : null; };
const norm = (v) => String(v || '').toLowerCase().replace(/miscellaneous/g, 'misc').replace(/\baccount\b/g, 'accounts').replace(/[^a-z0-9]/g, '');
const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const iso = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const NATURE = { 1: 'Assets', 2: 'Liabilities', 3: 'Income', 4: 'Expenses' };
// iCAFFE name -> EagleView built-in group (where the names differ)
const ALIAS = { 'loansliability': 'loansliability', 'miscexpensesasset': 'miscexpensesas', 'suspenseac': 'suspenseac', 'purchaseaccounts': 'purchaseaccounts' };

(async () => {
  try {
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    say('Source: ' + SRC + ' - groups ' + src.groups.length + ', accounts ' + src.accounts.length + ', charges ' + src.charges.rows.length);
    await run('PRAGMA busy_timeout = 30000');
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    say('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    const S = now();

    // ---------- columns
    const colsOf = async (t) => new Set((await all(`PRAGMA table_info(${t})`)).map(c => c.name));
    const addCol = async (t, c, ty) => { if (!(await colsOf(t)).has(c)) { await run(`ALTER TABLE ${t} ADD COLUMN ${c} ${ty}`); say(t + ': column added ' + c); } };
    await addCol('AccountGroups', 'icaffeId', 'TEXT');
    for (const [c, ty] of [['icaffeId', 'TEXT'], ['partyId', 'INTEGER'], ['isActive', 'TINYINT(1)'], ['dealingBranch', 'TEXT'], ['createdByName', 'TEXT'], ['isBlacklisted', 'TINYINT(1)'], ['msmeNo', 'TEXT'], ['isTdsApplicable', 'TINYINT(1)'], ['pan', 'VARCHAR(50)'], ['creditDays', 'INTEGER'], ['creditLimit', 'DECIMAL(15,2)'], ['gstin', 'VARCHAR(50)'], ['address', 'TEXT'], ['state', 'VARCHAR(255)'], ['pinCode', 'VARCHAR(50)'], ['country', 'VARCHAR(255)'], ['monthlyBudget', 'REAL'], ['accountCode', 'TEXT']])
      await addCol('AccountLedgers', c, ty);
    await run(`CREATE TABLE IF NOT EXISTS AccGstCharges (id INTEGER PRIMARY KEY AUTOINCREMENT, chargeName TEXT, sacCode TEXT, gstRate REAL, ledgerId REAL, expenseLedgerId REAL, rcm TINYINT(1), exempt TINYINT(1), isActive TINYINT(1) DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`);
    for (const c of ['icaffeId TEXT', 'igstLedgerId INTEGER', 'cgstLedgerId INTEGER', 'sgstLedgerId INTEGER', 'igstInputLedgerId INTEGER', 'cgstInputLedgerId INTEGER', 'sgstInputLedgerId INTEGER', 'printName TEXT', 'description TEXT'])
      await addCol('AccGstCharges', c.split(' ')[0], c.split(' ')[1]);
    await run(`CREATE TABLE IF NOT EXISTS AccLedgerOpenings (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER, docNo TEXT, docDate TEXT, dueDate TEXT, dc TEXT, amount REAL, jobNo TEXT, remarks TEXT, createdAt DATETIME, updatedAt DATETIME)`);
    await run('CREATE INDEX IF NOT EXISTS idx_accledgers_icaffe ON AccountLedgers (icaffeId)');
    await run('CREATE INDEX IF NOT EXISTS idx_accledgers_party ON AccountLedgers (partyId)');
    await run('CREATE INDEX IF NOT EXISTS idx_accledgeropen_ledger ON AccLedgerOpenings (ledgerId)');

    // ---------- groups (parents first)
    const eg = await all('SELECT id, name, nature, icaffeId FROM AccountGroups');
    const byNorm = new Map(eg.map(g => [norm(g.name), g])); const usedNames = new Set(eg.map(g => g.name.toUpperCase()));
    const gid = new Map(); // GRP/x -> EagleView id
    let gNew = 0, gMatch = 0;
    const groups = [...src.groups].sort((a, b) => a.depth - b.depth);
    for (const g of groups) {
      const nat = NATURE[g.Type] || 'Assets'; const nm = t0(g.GroupName, 200);
      const had = eg.find(x => x.icaffeId === g.GroupID) || (() => { const x = byNorm.get(ALIAS[norm(nm)] || norm(nm)); return x && x.nature === nat && !gidHas(x.id) ? x : null; })();
      if (had) { gid.set(g.GroupID, had.id); await run('UPDATE AccountGroups SET icaffeId = ?, updatedAt = ? WHERE id = ?', [g.GroupID, S, had.id]); gMatch++; continue; }
      const parent = g.GroupRefID && g.GroupRefID !== 'GRP/0' ? gid.get(g.GroupRefID) || null : null;
      let name = nm; if (usedNames.has(name.toUpperCase())) name = nm + ' (' + g.GroupID + ')';
      const r = await run('INSERT INTO AccountGroups (name, parentId, nature, isBuiltIn, icaffeId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [name, parent, nat, 0, g.GroupID, S, S]);
      usedNames.add(name.toUpperCase()); gid.set(g.GroupID, r.lastID); gNew++;
    }
    function gidHas(id) { for (const v of gid.values()) if (v === id) return true; return false; }
    say('Groups: ' + gMatch + ' matched to EagleView groups, ' + gNew + ' added');

    // ---------- ledgers
    const lcols = await colsOf('AccountLedgers');
    const parties = await all('SELECT id, code FROM Parties WHERE code IS NOT NULL');
    const pByCode = new Map(parties.map(p => [String(p.code).toUpperCase(), p.id]));
    // a party merged into another when it was added to the Party master (iCAFFE directory -> importedPartyId)
    for (const r of await all('SELECT code, importedPartyId FROM IcaffeParties WHERE importedPartyId IS NOT NULL').catch(() => [])) { const k = String(r.code || '').toUpperCase(); if (k && !pByCode.has(k)) pByCode.set(k, r.importedPartyId); }
    const brs = await all('SELECT partyId, address1, address2, city, state, country, pinCode, gstin FROM PartyBranches ORDER BY isDefault DESC, id');
    const brOf = new Map(); for (const b of brs) if (!brOf.has(b.partyId)) brOf.set(b.partyId, b);
    const el = await all('SELECT id, name, icaffeId FROM AccountLedgers');
    const lByName = new Map(el.map(l => [String(l.name).trim().toUpperCase(), l])); const lByIc = new Map(el.filter(l => l.icaffeId).map(l => [l.icaffeId, l]));
    const lid = new Map(); const seen = new Set(); let lNew = 0, lUpd = 0, linked = 0, dup = 0, noGroup = 0;
    for (const a of src.accounts) {
      const g = gid.get(a.GroupID); if (!g) { noGroup++; continue; }
      let name = t0(a.AccountName, 240) || a.AccountID; const key = name.toUpperCase();
      if (seen.has(key)) { name = name + ' - ' + a.AccountID; dup++; } seen.add(key);
      const ob = a.OB || []; const net = Math.round(ob.reduce((s, r) => s + num(r[2]) - num(r[3]), 0) * 100) / 100;
      const pid = a.PartyID ? pByCode.get(String(a.PartyID).toUpperCase()) || null : null; if (pid) linked++;
      const b = pid ? brOf.get(pid) || {} : {};
      const row = { name, groupId: g, openingBalance: Math.abs(net), balanceType: net < 0 ? 'Cr' : 'Dr', icaffeId: a.AccountID, partyId: pid,
        creditDays: Math.round(num(a.CreditDays)), creditLimit: num(a.CreditLimit), pan: t0(a.PANNumber, 50), isBlacklisted: a.IsBlackListed === 'T' ? 1 : 0,
        isTdsApplicable: a.TDSFlag === 'T' ? 1 : 0, msmeNo: t0(a.MSMENo, 60), dealingBranch: t0(a.DealingBranchName, 100), monthlyBudget: num(a.MonthlyBudget),
        accountCode: t0(a.UserAccountCode, 60), isActive: 1, createdByName: t0(a.EnterBy, 100),
        gstin: t0(b.gstin, 50), address: t0([b.address1, b.address2, b.city].filter(Boolean).join(', '), 500), state: t0(b.state, 100), pinCode: t0(b.pinCode, 20), country: t0(b.country, 60) };
      const keys = Object.keys(row).filter(k => lcols.has(k));
      const had = lByIc.get(a.AccountID) || lByName.get(name.toUpperCase());
      if (had) { await run(`UPDATE AccountLedgers SET ${keys.map(k => k + ' = ?').join(', ')}, updatedAt = ? WHERE id = ?`, [...keys.map(k => row[k]), S, had.id]); lid.set(a.AccountID, had.id); lUpd++; }
      else { const r = await run(`INSERT INTO AccountLedgers (${keys.join(', ')}, createdAt, updatedAt) VALUES (${keys.map(() => '?').join(',')},?,?)`, [...keys.map(k => row[k]), S, S]); lid.set(a.AccountID, r.lastID); lNew++; }
    }
    say('Ledgers: ' + lNew + ' added, ' + lUpd + ' already there (updated), ' + linked + ' tied to a Party master party, ' + dup + ' duplicate names given the iCAFFE id' + (noGroup ? ', ' + noGroup + ' skipped (group not found)' : ''));

    // ---------- opening bills
    const ids = [...lid.values()]; let ob = 0;
    for (let i = 0; i < ids.length; i += 500) await run(`DELETE FROM AccLedgerOpenings WHERE ledgerId IN (${ids.slice(i, i + 500).join(',')}) AND remarks LIKE 'iCAFFE opening%'`);
    for (const a of src.accounts) {
      const l = lid.get(a.AccountID); if (!l || !a.OB) continue;
      for (const r of a.OB) { const dr = num(r[2]), cr = num(r[3]); if (!dr && !cr) continue;
        await run('INSERT INTO AccLedgerOpenings (ledgerId, docNo, docDate, dc, amount, remarks, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)',
          [l, t0(r[0], 80), iso(r[1]), dr - cr >= 0 ? 'Dr' : 'Cr', Math.abs(Math.round((dr - cr) * 100) / 100), t0('iCAFFE opening - ' + [r[4], r[5]].filter(Boolean).join(' / ') + (num(r[6]) ? ' - FC ' + r[6] + ' @ ' + r[7] : ''), 200), S, S]); ob++; }
    }
    say('Opening bills: ' + ob);

    // ---------- GST charges
    const H = src.charges.H; const idx = (name, nth = 0) => { let k = -1; for (let i = 0, c = 0; i < H.length; i++) if (H[i] === name) { if (c === nth) { k = i; break; } c++; } return k; };
    const I = { name: idx('Charge Name'), sac: idx('SA Code'), gst: idx('GST Rate'), print: idx('Print Charge Name'), id: idx('CHARGEID'), inc: idx('Income Head'), exp: idx('Expense Head'),
      sgst: idx('SGST Account Head'), sgstIn: idx('SGST In. Cr. Head'), cgst: idx('CGST Account Head'), cgstIn: idx('CGST In. Cr. Head'), igst: idx('IGST Account Head', 1), igstIn: idx('IGST In. Cr. Head'), desc: idx('Description'), status: idx('Status') };
    const allL = await all('SELECT id, name FROM AccountLedgers'); const ln = new Map(allL.map(l => [String(l.name).trim().toUpperCase(), l.id]));
    const L = (v) => (v ? ln.get(String(v).trim().toUpperCase()) || null : null);
    const ccols = await colsOf('AccGstCharges'); const have = new Map((await all('SELECT id, chargeName FROM AccGstCharges')).map(c => [String(c.chargeName).trim().toUpperCase(), c.id]));
    let cNew = 0, cUpd = 0, noInc = 0; const st = {};
    for (const r of src.charges.rows) {
      const nm = t0(r[I.name], 200); if (!nm) continue;
      st[r[I.status]] = (st[r[I.status]] || 0) + 1;
      const row = { chargeName: nm.toUpperCase(), sacCode: t0(r[I.sac], 20), gstRate: num(r[I.gst]), ledgerId: L(r[I.inc]), expenseLedgerId: L(r[I.exp]), icaffeId: t0(r[I.id], 40),
        sgstLedgerId: L(r[I.sgst]), sgstInputLedgerId: L(r[I.sgstIn]), cgstLedgerId: L(r[I.cgst]), cgstInputLedgerId: L(r[I.cgstIn]), igstLedgerId: L(r[I.igst]), igstInputLedgerId: L(r[I.igstIn]),
        printName: t0(r[I.print], 200), description: t0(r[I.desc], 500), isActive: r[I.status] === 'T' ? 0 : 1 };
      if (!row.ledgerId) noInc++;
      const keys = Object.keys(row).filter(k => ccols.has(k)); const h = have.get(row.chargeName);
      if (h) { await run(`UPDATE AccGstCharges SET ${keys.map(k => k + ' = ?').join(', ')}, updatedAt = ? WHERE id = ?`, [...keys.map(k => row[k]), S, h]); cUpd++; }
      else { await run(`INSERT INTO AccGstCharges (${keys.join(', ')}, createdAt, updatedAt) VALUES (${keys.map(() => '?').join(',')},?,?)`, [...keys.map(k => row[k]), S, S]); cNew++; }
    }
    say('GST charges: ' + cNew + ' added, ' + cUpd + ' updated, ' + noInc + ' without an income head in iCAFFE; iCAFFE Status values ' + JSON.stringify(st) + ' (T = disabled)');

    await run('COMMIT');
    const tb = await all('SELECT sum(CASE WHEN balanceType = \'Dr\' THEN openingBalance ELSE -openingBalance END) net, count(*) n FROM AccountLedgers');
    say('Done. Ledgers now ' + tb[0].n + ', opening Dr - Cr = ' + Math.round(tb[0].net * 100) / 100);
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* not in a transaction */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
