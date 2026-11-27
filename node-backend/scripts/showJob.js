// Shows what the database holds for one job, to check a save from the screen (read-only, it changes nothing).
//   npm run show-job -- import 4975        (Bill of Entry job no)
//   npm run show-job -- export 1234        (Shipping Bill job no)
//   npm run show-job -- import 4975 full   (also the extra fields kept as JSON)
import path from 'node:path';
import sqlite3 from 'sqlite3';

const BACKEND_ROOT = path.resolve(import.meta.dirname, '..');
const DATABASE_FILE = process.env.DB_STORAGE || path.join(BACKEND_ROOT, 'database.sqlite');
const [kind = '', jobNo = '', detail = ''] = process.argv.slice(2);
const showExtra = detail === 'full';

const database = new sqlite3.Database(DATABASE_FILE, sqlite3.OPEN_READONLY);
const rows = (sql, params) =>
  new Promise((resolve, reject) =>
    database.all(sql, params, (error, result) => (error ? reject(error) : resolve(result))),
  );

const parseJson = (text) => {
  try {
    return JSON.parse(text || '{}');
  } catch {
    return {};
  }
};

function printTable(title, list) {
  console.log(`\n${title} (${list.length})`);
  if (list.length) console.table(list);
}

const isFilled = (value) => value !== '' && value !== null && value !== undefined;
const filledFields = (record) => Object.fromEntries(Object.entries(record).filter(([, value]) => isFilled(value)));

function printExtra(title, text) {
  if (!showExtra) return;
  const filled = filledFields(parseJson(text));
  console.log(`\n${title}: ${Object.keys(filled).length} filled fields`);
  console.dir(filled, { depth: 2, maxArrayLength: 10 });
}

// every filled column of the job row (most screen boxes are columns; the rest is in the JSON column)
async function printFilledColumns(table, id, jsonColumn) {
  if (!showExtra) return;
  const [row] = await rows(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  const { [jsonColumn]: _json, ...columns } = row;
  const filled = filledFields(columns);
  console.log(`\nAll filled columns of ${table}: ${Object.keys(filled).length}`);
  console.dir(filled, { depth: 1 });
}

async function showImportJob() {
  const [job] = await rows(
    `SELECT id, jobNo, jobDate, shipmentMode, boeType, iecCode, beNo, icegateStatus, updatedAt, extendedData
       FROM ImportJobs WHERE jobNo = ? ORDER BY id DESC LIMIT 1`,
    [jobNo],
  );
  if (!job) return console.log(`No import job ${jobNo}`);
  const { extendedData, ...header } = job;
  printTable('Job header (ImportJobs)', [header]);
  await printFilledColumns('ImportJobs', job.id, 'extendedData');
  printExtra('Job header extra fields (ImportJobs.extendedData)', extendedData);
  printTable(
    'Invoices (ImportInvoices)',
    await rows('SELECT id, invNo, invDate, currency, value FROM ImportInvoices WHERE importJobId = ? ORDER BY id', [
      job.id,
    ]),
  );
  printTable(
    'Items (ImportItems)',
    await rows(
      `SELECT it.invSrNo, it.itemSrNo, it.ritc, substr(it."desc", 1, 40) AS description, it.qty, it.bcdRate,
              it.bcdNotificationNo, it.bcdSrNo
         FROM ImportItems it JOIN ImportInvoices inv ON inv.id = it.importInvoiceId
        WHERE inv.importJobId = ? ORDER BY CAST(it.invSrNo AS INTEGER), CAST(it.itemSrNo AS INTEGER)`,
      [job.id],
    ),
  );
  printTable(
    'Containers (ImportContainers)',
    await rows('SELECT containerNo, size, type, sealNo FROM ImportContainers WHERE importJobId = ?', [job.id]),
  );
}

async function showExportJob() {
  const [job] = await rows(
    `SELECT id, jobNo, jobDate, shipmentMode, status, sbNo, sbDate, updatedAt, additionalData
       FROM ExportJobs WHERE jobNo = ? ORDER BY id DESC LIMIT 1`,
    [jobNo],
  );
  if (!job) return console.log(`No export job ${jobNo}`);
  const { additionalData, ...header } = job;
  printTable('Job header (ExportJobs)', [header]);
  await printFilledColumns('ExportJobs', job.id, 'additionalData');
  printExtra('Job header extra fields (ExportJobs.additionalData)', additionalData);
  printTable(
    'Invoices (ExportInvoices)',
    await rows(
      'SELECT id, no, invoiceNo, invoiceDate, currency, invoiceValue FROM ExportInvoices WHERE exportJobId = ? ORDER BY id',
      [job.id],
    ),
  );
  printTable(
    'Items (ExportItems)',
    await rows(
      `SELECT it.invSr, it.itemSr, it.ritc, substr(coalesce(it."desc", it.productDescription), 1, 40) AS description, it.quantity, it.unit, it.rate
         FROM ExportItems it JOIN ExportInvoices inv ON inv.id = it.exportInvoiceId
        WHERE inv.exportJobId = ? ORDER BY CAST(it.invSr AS INTEGER), CAST(it.itemSr AS INTEGER)`,
      [job.id],
    ),
  );
  printTable(
    'Containers (ExportContainers)',
    await rows('SELECT containerNo, size, type, sealNo FROM ExportContainers WHERE exportJobId = ?', [job.id]),
  );
}

try {
  if (!jobNo || !['import', 'export'].includes(kind)) {
    console.log('usage: npm run show-job -- import <jobNo> [full]   |   npm run show-job -- export <jobNo> [full]');
  } else if (kind === 'import') {
    await showImportJob();
  } else {
    await showExportJob();
  }
} finally {
  database.close();
}
