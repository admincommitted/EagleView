// Safe daily backup of the EagleView database while the backend keeps running.
// SQLite "VACUUM INTO" takes a consistent snapshot (a plain file copy can be half-written and misses the -wal file),
// the copy is checked (PRAGMA quick_check), compressed (.sqlite.gz, about a fifth of the size) and only the newest
// backups are kept.
//
//   node scripts/backupDatabase.js           -> EDI_AUTOMATION_BACKUPS\db next to the project folder
//   set EDI_BACKUP_DIR=E:\Backups\EDI        -> another folder (another disk / pen drive / NAS is better than the same disk)
//   set EDI_BACKUP_COPY_DIR=G:\My Drive\EDI_DB -> also copy each backup there (e.g. a Google Drive folder)
//   set EDI_BACKUP_KEEP=7                    -> how many backups to keep in each folder (default 7)
// Restore: stop the backend, rename database.sqlite to database.sqlite.old (and delete -wal / -shm), unzip the chosen
// .sqlite.gz (7-Zip) to node-backend\database.sqlite, start the backend.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import sqlite3 from 'sqlite3';

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
const DATABASE_FILE = path.join(BACKEND_ROOT, 'database.sqlite');
const BACKUP_DIR = process.env.EDI_BACKUP_DIR || path.join(BACKEND_ROOT, '..', '..', 'EDI_AUTOMATION_BACKUPS', 'db');
const COPY_DIR = process.env.EDI_BACKUP_COPY_DIR || '';
const BACKUPS_TO_KEEP = Math.max(1, parseInt(process.env.EDI_BACKUP_KEEP || '7', 10) || 7);
const LOG_FILE = path.join(BACKEND_ROOT, 'logs', 'db_backup.log');
const BUSY_TIMEOUT_MS = 60000;
// the uncompressed snapshot is written first, then compressed: about 1.3 x the database must be free for a moment
const FREE_SPACE_FACTOR = 1.3;
const BACKUP_FILE_NAME = /^edi_db_\d{8}_\d{4}\.sqlite\.gz$/;

const twoDigits = (number) => String(number).padStart(2, '0');
const megabytes = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;

function timestamp(date = new Date()) {
  return `${date.getFullYear()}${twoDigits(date.getMonth() + 1)}${twoDigits(date.getDate())}_${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}`;
}

function log(message) {
  const line = `${new Date().toLocaleString('en-IN')}  ${message}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${line}\r\n`);
  } catch {
    // the log file is optional
  }
}

function freeBytes(dir) {
  try {
    const stats = fs.statfsSync(dir);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

function removeOldBackups(dir) {
  const backups = fs
    .readdirSync(dir)
    .filter((name) => BACKUP_FILE_NAME.test(name))
    .sort()
    .reverse();
  for (const name of backups.slice(BACKUPS_TO_KEEP)) {
    const file = path.join(dir, name);
    try {
      fs.unlinkSync(file);
      log(`Removed old backup ${file}`);
    } catch (error) {
      log(`Could not remove ${name}: ${error.message}`);
    }
  }
}

function databaseSize() {
  const walFile = `${DATABASE_FILE}-wal`;
  return fs.statSync(DATABASE_FILE).size + (fs.existsSync(walFile) ? fs.statSync(walFile).size : 0);
}

function checkFreeSpace(size) {
  const free = freeBytes(BACKUP_DIR);
  if (free === null || free >= size * FREE_SPACE_FACTOR) return;
  throw new Error(
    `Not enough free disk space in ${BACKUP_DIR}: ${megabytes(free)} free, about ${megabytes(size * FREE_SPACE_FACTOR)} needed. Free some space or set EDI_BACKUP_DIR to another disk.`,
  );
}

const openReadOnly = (file) => new sqlite3.Database(file, sqlite3.OPEN_READONLY);
const closeDatabase = (database) => new Promise((resolve) => database.close(resolve));

async function takeSnapshot(snapshotFile) {
  const database = openReadOnly(DATABASE_FILE);
  database.configure('busyTimeout', BUSY_TIMEOUT_MS);
  await new Promise((resolve, reject) =>
    database.run('VACUUM INTO ?', [snapshotFile], (error) => (error ? reject(error) : resolve())),
  );
  await closeDatabase(database);
}

async function checkSnapshot(snapshotFile) {
  const database = openReadOnly(snapshotFile);
  const rows = await new Promise((resolve, reject) =>
    database.all('PRAGMA quick_check', (error, result) => (error ? reject(error) : resolve(result))),
  );
  await closeDatabase(database);
  const verdict = rows.map((row) => Object.values(row)[0]).join('; ');
  if (verdict === 'ok') return;
  fs.rmSync(snapshotFile, { force: true });
  throw new Error(
    `The snapshot failed its check (${verdict.slice(0, 300)}). The live database itself may need attention - nothing was kept.`,
  );
}

async function compress(snapshotFile, archiveFile) {
  await pipeline(fs.createReadStream(snapshotFile), zlib.createGzip({ level: 6 }), fs.createWriteStream(archiveFile));
  fs.unlinkSync(snapshotFile);
}

function copyToSecondFolder(archiveFile) {
  if (!COPY_DIR) return;
  try {
    fs.mkdirSync(COPY_DIR, { recursive: true });
    const copy = path.join(COPY_DIR, path.basename(archiveFile));
    fs.copyFileSync(archiveFile, copy);
    log(`Copied to ${copy}`);
    removeOldBackups(COPY_DIR);
  } catch (error) {
    log(`COPY FAILED to ${COPY_DIR}: ${error.message}`);
    process.exitCode = 2;
  }
}

async function backupDatabase() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const size = databaseSize();
  checkFreeSpace(size);
  const stamp = timestamp();
  const snapshotFile = path.join(BACKUP_DIR, `edi_db_${stamp}.sqlite.tmp`);
  const archiveFile = path.join(BACKUP_DIR, `edi_db_${stamp}.sqlite.gz`);
  fs.rmSync(snapshotFile, { force: true });
  log(`Backup started: ${DATABASE_FILE} (${megabytes(size)}) -> ${archiveFile}`);
  const startedAt = Date.now();

  await takeSnapshot(snapshotFile);
  await checkSnapshot(snapshotFile);
  await compress(snapshotFile, archiveFile);
  log(
    `Backup OK in ${Math.round((Date.now() - startedAt) / 1000)} s: ${archiveFile} (${megabytes(fs.statSync(archiveFile).size)}, check ok)`,
  );
  removeOldBackups(BACKUP_DIR);
  copyToSecondFolder(archiveFile);
}

backupDatabase().catch((error) => {
  log(`BACKUP FAILED: ${error.message}`);
  process.exit(1);
});
