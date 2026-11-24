// backup_edi_db.js  (14-Nov-2026) - safe daily backup of the EagleView database.
// Works while EagleView is running: SQLite "VACUUM INTO" takes a consistent snapshot (users can keep working), the copy
// is checked (PRAGMA quick_check), compressed (.sqlite.gz, about a fifth of the size) and only the newest ones are kept.
// A plain file copy of database.sqlite while the backend runs can be half-written and misses what is still in the -wal file.
//
//   node backup_edi_db.js              -> backup to EDI_AUTOMATION_BACKUPS\db next to the project folder
//                                         (project in D:\Commited\EDI_AUTOMATION -> D:\Commited\EDI_AUTOMATION_BACKUPS\db)
//   set EDI_BACKUP_DIR=E:\Backups\EDI  -> another folder (another disk / pen drive / NAS is better than the same disk)
//   set EDI_BACKUP_COPY_DIR=G:\My Drive\EDI_DB   -> also copy each backup there (e.g. Google Drive folder)
//   set EDI_BACKUP_KEEP=7              -> how many backups to keep in each folder (default 7)
// Restore: stop the backend, rename database.sqlite to database.sqlite.old (and delete -wal / -shm), unzip the chosen
// .sqlite.gz (7-Zip) to node-backend\database.sqlite, start the backend.
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const DIR = process.env.EDI_BACKUP_DIR || path.join(__dirname, '..', '..', 'EDI_AUTOMATION_BACKUPS', 'db');
const COPY_DIR = process.env.EDI_BACKUP_COPY_DIR || '';
const KEEP = Math.max(1, parseInt(process.env.EDI_BACKUP_KEEP || '7', 10) || 7);
const LOG = path.join(__dirname, 'logs', 'db_backup.log');

const p2 = (n) => String(n).padStart(2, '0');
const d = new Date();
const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
const mb = (n) => (n / 1048576).toFixed(0) + ' MB';
function log(msg) {
  const line = `${new Date().toLocaleString('en-IN')}  ${msg}`;
  console.log(line);
  try { fs.mkdirSync(path.dirname(LOG), { recursive: true }); fs.appendFileSync(LOG, line + '\r\n'); } catch (e) { /* log is optional */ }
}
function freeBytes(dir) { try { const s = fs.statfsSync(dir); return s.bavail * s.bsize; } catch (e) { return null; } }
function prune(dir) {
  const files = fs.readdirSync(dir).filter(f => /^edi_db_\d{8}_\d{4}\.sqlite\.gz$/.test(f)).sort().reverse();
  for (const f of files.slice(KEEP)) { try { fs.unlinkSync(path.join(dir, f)); log('Removed old backup ' + path.join(dir, f)); } catch (e) { log('Could not remove ' + f + ': ' + e.message); } }
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  const size = fs.statSync(DB).size + (fs.existsSync(DB + '-wal') ? fs.statSync(DB + '-wal').size : 0);
  const free = freeBytes(DIR);
  // the uncompressed snapshot is written first, then compressed: needs about 1.3 x the database free for a short time
  if (free !== null && free < size * 1.3) throw new Error(`Not enough free disk space in ${DIR}: ${mb(free)} free, about ${mb(size * 1.3)} needed. Free some space or set EDI_BACKUP_DIR to another disk.`);
  const tmp = path.join(DIR, `edi_db_${stamp}.sqlite.tmp`);
  const gz = path.join(DIR, `edi_db_${stamp}.sqlite.gz`);
  try { fs.unlinkSync(tmp); } catch (e) { /* none */ }
  log(`Backup started: ${DB} (${mb(size)}) -> ${gz}`);
  const t0 = Date.now();

  const db = new sqlite3.Database(DB, sqlite3.OPEN_READONLY);
  db.configure('busyTimeout', 60000);
  await new Promise((ok, bad) => db.run('VACUUM INTO ?', [tmp], (e) => (e ? bad(e) : ok())));
  await new Promise(ok => db.close(ok));

  const chk = new sqlite3.Database(tmp, sqlite3.OPEN_READONLY);
  const res = await new Promise((ok, bad) => chk.all('PRAGMA quick_check', (e, r) => (e ? bad(e) : ok(r))));
  await new Promise(ok => chk.close(ok));
  const verdict = res.map(r => Object.values(r)[0]).join('; ');
  if (verdict !== 'ok') { try { fs.unlinkSync(tmp); } catch (e) { /* */ } throw new Error('The snapshot failed its check (' + verdict.slice(0, 300) + '). The live database itself may need attention - nothing was kept.'); }

  await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 6 }), fs.createWriteStream(gz));
  fs.unlinkSync(tmp);
  const gzSize = fs.statSync(gz).size;
  log(`Backup OK in ${Math.round((Date.now() - t0) / 1000)} s: ${gz} (${mb(gzSize)}, check ok)`);
  prune(DIR);

  if (COPY_DIR) {
    try {
      fs.mkdirSync(COPY_DIR, { recursive: true });
      const dst = path.join(COPY_DIR, path.basename(gz));
      fs.copyFileSync(gz, dst);
      log('Copied to ' + dst);
      prune(COPY_DIR);
    } catch (e) { log('COPY FAILED to ' + COPY_DIR + ': ' + e.message); process.exitCode = 2; }
  }
})().catch(e => { log('BACKUP FAILED: ' + e.message); process.exit(1); });
