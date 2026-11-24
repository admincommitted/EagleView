// fix_blank_be_pin.js  (16-Nov-2026)
// 537 BE jobs loaded from iCAFFE have no importer PIN (iCAFFE's job export had no IMP_PIN for them; iCAFFE put the PIN
// into the .be from its own importer-branch master). EagleView stops such a job with "Header: PIN is mandatory".
// This fills the PIN only where it is certain (utils/pinSuggest.js pick()):
//   - a 6-digit PIN written in the job's own address / city, or
//   - the one PIN that all other jobs of the same IEC + branch (+ address 1) have, and the Party master does not differ
//   - and the PIN's first digit fits the job's state (India Post zone: 1 Delhi / Haryana / Punjab, 2 UP ...)
// The rest are listed; their PIN is picked on the Job Header ("Known PINs") or typed by the user.
//   node fix_blank_be_pin.js --check   -> list only, nothing is written
//   node fix_blank_be_pin.js           -> writes pin + autoField_10; old values first to ..\backups\be_pin_<stamp>.csv
// Stop the EagleView backend before the write run.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));
const { pick, okPin } = require('./utils/pinSuggest');

const CHECK = process.argv.includes('--check');
const DB = path.join(__dirname, 'database.sqlite');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BK = path.join(__dirname, '..', 'backups', 'be_pin_' + stamp + '.csv');
const db = new sqlite3.Database(DB, CHECK ? sqlite3.OPEN_READONLY : sqlite3.OPEN_READWRITE);
db.configure('busyTimeout', 15000);
const all = (sql, p = []) => new Promise((ok, bad) => db.all(sql, p, (e, r) => (e ? bad(e) : ok(r))));
const run = (sql, p = []) => new Promise((ok, bad) => db.run(sql, p, function (e) { return e ? bad(e) : ok(this); }));
const csv = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

(async () => {
  const jobs = await all(`SELECT id, jobNo, iecCode, branchSrNo, address1, address2, city, state, pin, autoField_10, coalesce(beNo, '') AS beNo
      FROM ImportJobs WHERE coalesce(jobNo, '') NOT LIKE 'AMD/%'`);
  const blank = jobs.filter(j => !okPin(j.autoField_10) && !okPin(j.pin));
  const fix = []; const left = [];
  for (const j of blank) { const p = await pick(all, j); if (p) fix.push({ j, ...p }); else left.push(j); }
  console.log(`BE jobs: ${jobs.length} | without a valid importer PIN: ${blank.length} (${blank.filter(j => j.beNo).length} already filed)`);
  console.log(`PIN found for certain: ${fix.length} | left for the user (Job Header > Known PINs): ${left.length}\n`);
  const how = {}; fix.forEach(f => { const k = f.how.replace(/\d+ other/, 'n other'); how[k] = (how[k] || 0) + 1; });
  Object.entries(how).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
  console.log('\nFirst ones:');
  fix.slice(0, 15).forEach(f => console.log(`  job ${String(f.j.jobNo).padEnd(14)} IEC ${String(f.j.iecCode).padEnd(11)} br ${String(f.j.branchSrNo ?? '').padEnd(3)} ${String(f.j.city || '').slice(0, 22).padEnd(22)} -> ${f.pin}  (${f.how})`));
  if (CHECK) { console.log('\nCheck only - nothing written.'); db.close(); return; }
  if (!fix.length) { console.log('Nothing to write.'); db.close(); return; }

  fs.mkdirSync(path.dirname(BK), { recursive: true });
  fs.writeFileSync(BK, 'id,jobNo,old_pin,old_autoField_10,new_pin,how\r\n' + fix.map(f => [f.j.id, f.j.jobNo, f.j.pin, f.j.autoField_10, f.pin, f.how].map(csv).join(',')).join('\r\n') + '\r\n');
  console.log('\nOld values saved: ' + BK);
  await run('BEGIN');
  try {
    let n = 0;
    for (const f of fix) { const r = await run('UPDATE ImportJobs SET pin = ?, autoField_10 = ? WHERE id = ?', [f.pin, f.pin, f.j.id]); n += r.changes; }
    await run('COMMIT');
    console.log('PIN filled on ' + n + ' job(s).');
  } catch (e) { await run('ROLLBACK'); throw e; }
  db.close();
})().catch(e => { console.error('Stopped, nothing changed: ' + e.message); process.exit(1); });
