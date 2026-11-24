// iCAFFE Purchase Register bill details into EagleView purchase vouchers (08-Nov-2026).
// Source: _tariff_load\icaffe_purchase_register_YYYYMMDD.json - iCAFFE's "Purchase Register" report read half-month by half-month
//   (01-Apr-2022 to date, all branches / divisions), one row per purchase voucher:
//   {"cols":["ACTRECEIPTID","ACTVOUCHERDATE",...,"TOTAL_AMOUNT","ACTTDSAMOUNT"],"halves":{"2024-09-01":[[row],...]}}
// What it does: each row is matched to the purchase voucher loaded from iCAFFE (Vouchers.icaffeRef = voucher no | dd/mm/yyyy)
//   and fills in AccPurchaseInfo for it: vendor bill no (ACTTRADEINVNO), bill date (ACTTRADEINVDATE), kind 'bill', and the TDS
//   amount where iCAFFE shows one. Where the voucher has no job no / reference no yet, the docket and the bill no are put there.
//   Only EMPTY fields are filled - anything already entered in EagleView is never overwritten. Nothing else is changed.
//   Rows with no matching voucher (e.g. vouchers made in iCAFFE after the last voucher read) are listed in the log.
// One transaction; a full copy of the database is written to backups\ first. --check = dry run, nothing saved.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const TL = path.join(__dirname, '_tariff_load');
const SRC = process.env.EDI_SRC || (fs.existsSync(TL) ? fs.readdirSync(TL).filter(f => /^icaffe_purchase_register_\d+.*\.json$/.test(f)).sort().map(f => path.join(TL, f)).pop() : null);
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_icaffe_purchase_register_' + stamp + '.sqlite');
const LOG = path.join(SRC ? path.dirname(SRC) : TL, 'icaffe_purchase_register_result_' + stamp + '.txt');

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));
const log = []; const say = (s) => { console.log(s); log.push(s); };
const num = (v) => { const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0; };
const ymd = (d) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(d || '').trim()); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
const t = (v) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return s || null; };
const empty = (v) => v == null || String(v).trim() === '';

(async () => {
  try {
    if (!SRC) throw new Error('No _tariff_load\\icaffe_purchase_register_*.json file');
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const C = src.cols || []; const ix = (n) => { const i = C.indexOf(n); if (i < 0) throw new Error('column missing in file: ' + n); return i; };
    const I = { vno: ix('ACTRECEIPTID'), vdate: ix('ACTVOUCHERDATE'), billNo: ix('ACTTRADEINVNO'), billDate: ix('ACTTRADEINVDATE'), docket: ix('ACTDOCKETNO'), tds: ix('ACTTDSAMOUNT'), party: ix('PARTYNAME') };
    const rows = []; for (const k of Object.keys(src.halves || {}).sort()) for (const r of src.halves[k] || []) rows.push(r);
    say('Source: ' + SRC + ' - ' + Object.keys(src.halves || {}).length + ' half-months, ' + rows.length + ' purchase vouchers');
    await run('PRAGMA busy_timeout = 30000');
    if (!DRY) { fs.mkdirSync(path.dirname(BACKUP), { recursive: true }); say('Backup: ' + BACKUP); await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'"); }
    await run('BEGIN IMMEDIATE');
    await run(`CREATE TABLE IF NOT EXISTS AccPurchaseInfo (id INTEGER PRIMARY KEY AUTOINCREMENT, voucherId INTEGER UNIQUE, kind TEXT, desk TEXT, billNo TEXT, billDate TEXT, dueDate TEXT, hblNo TEXT, mblNo TEXT,
      isSez TINYINT(1) DEFAULT 0, sezType TEXT, tds1Section TEXT, tds1Amount REAL, tds2Section TEXT, tds2Amount REAL,
      againstVoucherId INTEGER, cnReason TEXT, holdPayment TINYINT(1) DEFAULT 0, holdReason TEXT, holdBy TEXT, holdAt TEXT, createdByName TEXT, createdAt DATETIME, updatedAt DATETIME)`);
    await run('CREATE INDEX IF NOT EXISTS idx_accpinfo_voucher ON AccPurchaseInfo (voucherId)');
    // iCAFFE vouchers in EagleView, by icaffeRef
    const vmap = new Map();
    for (const v of await all('SELECT id, icaffeRef, jobNo, refNo FROM Vouchers WHERE icaffeRef IS NOT NULL')) vmap.set(v.icaffeRef, v);
    const pmap = new Map();
    for (const p of await all('SELECT id, voucherId, kind, billNo, billDate, tds1Amount FROM AccPurchaseInfo')) pmap.set(p.voucherId, p);
    const S = new Date().toISOString().replace('T', ' ').replace('Z', ' +00:00'); // 14-Nov-2026: the form Sequelize (SQLite) reads; 'T...Z' came back as null (job created time, timeline)
    let added = 0, filled = 0, same = 0, jobSet = 0, refSet = 0, dup = 0; const miss = []; const seen = new Set();
    for (const r of rows) {
      const ref = String(r[I.vno] || '').trim() + '|' + String(r[I.vdate] || '').trim();
      if (seen.has(ref)) { dup++; continue; } seen.add(ref);
      const v = vmap.get(ref);
      if (!v) { miss.push(ref + '  ' + (r[I.party] || '') + '  bill ' + (r[I.billNo] || '')); continue; }
      const billNo = t(r[I.billNo]); const billDate = ymd(r[I.billDate]); const tds = num(r[I.tds]) || null; const docket = t(r[I.docket]);
      const p = pmap.get(v.id);
      if (!p) {
        await run('INSERT INTO AccPurchaseInfo (voucherId, kind, billNo, billDate, tds1Amount, createdByName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [v.id, 'bill', billNo, billDate, tds, 'iCAFFE', S, S]);
        added++;
      } else {
        const set = [], val = [];
        if (empty(p.kind)) { set.push('kind = ?'); val.push('bill'); }
        if (empty(p.billNo) && billNo) { set.push('billNo = ?'); val.push(billNo); }
        if (empty(p.billDate) && billDate) { set.push('billDate = ?'); val.push(billDate); }
        if (p.tds1Amount == null && tds) { set.push('tds1Amount = ?'); val.push(tds); }
        if (set.length) { await run('UPDATE AccPurchaseInfo SET ' + set.join(', ') + ', updatedAt = ? WHERE id = ?', [...val, S, p.id]); filled++; } else same++;
      }
      const vs = [], vv = [];
      if (empty(v.jobNo) && docket) { vs.push('jobNo = ?'); vv.push(docket); jobSet++; }
      if (empty(v.refNo) && billNo) { vs.push('refNo = ?'); vv.push(billNo.slice(0, 80)); refSet++; }
      if (vs.length) await run('UPDATE Vouchers SET ' + vs.join(', ') + ' WHERE id = ?', [...vv, v.id]);
    }
    say('Bill details added: ' + added + '   filled into existing rows: ' + filled + '   already complete: ' + same);
    say('Job no set on ' + jobSet + ' vouchers, reference (bill) no set on ' + refSet + ' vouchers (only where empty)');
    say('Repeated rows in the file skipped: ' + dup);
    say('Not found in EagleView (no iCAFFE voucher with that no. and date - load the newer vouchers first): ' + miss.length + (miss.length ? '\n  ' + miss.slice(0, 60).join('\n  ') : ''));
    if (DRY) { await run('ROLLBACK'); say('Check only (--check) - nothing saved.'); } else { await run('COMMIT'); say('Done.'); }
  } catch (e) {
    say('FAILED - nothing was changed: ' + (e && e.stack || e));
    try { await run('ROLLBACK'); } catch (e2) { /* ignore */ }
  } finally {
    try { fs.writeFileSync(LOG, log.join('\n')); console.log('Log: ' + LOG); } catch (e) { /* ignore */ }
    db.close();
  }
})();
