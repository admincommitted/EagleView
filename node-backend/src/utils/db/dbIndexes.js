// SQLite indexes for the job tables. Job / invoice / item / container rows are always read by their parent id, and jobs
// by jobNo / BE no / SB no, but Sequelize only creates the primary key. Every index here is CREATE INDEX IF NOT EXISTS,
// so it is safe to run on each start; a column that does not exist in the table (old database) is skipped.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';

const WANTED = [
  ['ImportJob', ['jobNo']],
  ['ImportJob', ['icegateUniqueId']],
  ['ImportJob', ['status']],
  ['ImportJob', ['jobDate']],
  ['ImportInvoice', ['importJobId']],
  ['ImportItem', ['importInvoiceId']],
  ['ImportItem', ['importJobId']],
  ['ImportContainer', ['importJobId']],
  ['ImportFinalDoc', ['beNo']],
  ['ExportJob', ['jobNo']],
  ['ExportJob', ['sbNo']],
  ['ExportJob', ['icegateUniqueId']],
  ['ExportJob', ['status']],
  ['ExportJob', ['jobDate']],
  ['ExportInvoice', ['exportJobId']],
  ['ExportItem', ['exportInvoiceId']],
  ['ExportItem', ['exportJobId']],
  ['ExportContainer', ['exportJobId']],
  ['ExportDocument', ['exportJobId']],
  ['ExportDrawback', ['exportJobId']],
  ['ExportLicense', ['exportJobId']],
  ['ExportFinalDoc', ['sbNo']],
  ['ExportFinalDoc', ['jobNo']],
  ['TariffComponent', ['tariffHeaderId']],
  ['PartyBranch', ['partyId']],
  ['PartyADCode', ['partyId']],
  ['PartyDocument', ['partyId']],
  ['PartyItemMaster', ['partyId']],
  // AWB module: master/house AWB by number, child rows by awbId, tracking + logs + WhatsApp queue by awbNumber
  ['Airwaybill', ['awbNumber']],
  ['Airwaybill', ['status']],
  ['HouseAWB', ['awbNumber']],
  ['HouseAWB', ['masterAwbNumber']],
  ['HouseAWB', ['masterAwbId']],
  ['AwbOci', ['awbId']],
  ['AwbDimension', ['awbId']],
  ['AwbRateLine', ['awbId']],
  ['AwbOtherCharge', ['awbId']],
  ['SpecialHandlingCode', ['awbId']],
  ['AwbLog', ['awbNumber']],
  ['AwbTracking', ['awbNumber']],
  ['WhatsappNotificationQueue', ['sent']],
  ['WhatsappNotificationQueue', ['awbNumber']],
  // Accounts: voucher lines by voucher / ledger
  ['Voucher', ['voucherTypeId']],
  ['VoucherDetail', ['voucherId']],
  ['VoucherDetail', ['ledgerId']],
];

const quoteIdentifier = (name) => '"' + String(name).replace(/"/g, '""') + '"';

const isSqliteDialect = () => sequelize.getDialect() === 'sqlite';

async function tableColumns(table) {
  const rows = await sequelize.query(`PRAGMA table_info(${quoteIdentifier(table)})`, { type: QueryTypes.SELECT });
  return new Set(rows.map((row) => row.name));
}

function tableNameOf(model) {
  const tableName = model.getTableName();
  return typeof tableName === 'string' ? tableName : tableName.tableName;
}

const indexNameFor = (table, columns) => `idx_${table}_${columns.join('_')}`.replace(/[^A-Za-z0-9_]/g, '_');

async function indexExists(table, indexName) {
  const indexes = await sequelize.query(`PRAGMA index_list(${quoteIdentifier(table)})`, { type: QueryTypes.SELECT });
  return indexes.some((index) => index.name === indexName);
}

async function ensureOneIndex(table, columns, columnCache, result) {
  if (!columnCache[table]) columnCache[table] = await tableColumns(table);
  if (!columnCache[table].size) {
    result.skipped.push(table + ' (no table)');
    return;
  }
  const missing = columns.filter((column) => !columnCache[table].has(column));
  if (missing.length) {
    result.skipped.push(`${table}(${missing.join(',')}) column missing`);
    return;
  }
  const indexName = indexNameFor(table, columns);
  if (await indexExists(table, indexName)) {
    result.existing.push(indexName);
    return;
  }
  const columnList = columns.map(quoteIdentifier).join(', ');
  await sequelize.query(
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${quoteIdentifier(table)} (${columnList})`,
  );
  result.created.push(indexName);
}

/** Creates the missing indexes; returns { created, skipped, existing }. */
async function ensureJobIndexes({ log = console } = {}) {
  const result = { created: [], skipped: [], existing: [] };
  if (!isSqliteDialect()) {
    result.skipped.push('not sqlite: indexes are managed on the server');
    return result;
  }
  const columnCache = {};
  for (const [modelName, columns] of WANTED) {
    const model = sequelize.models[modelName];
    if (!model) {
      result.skipped.push(modelName + ' (no model)');
      continue;
    }
    const table = tableNameOf(model);
    try {
      await ensureOneIndex(table, columns, columnCache, result);
    } catch (error) {
      result.skipped.push(`${table}(${columns.join(',')}) ${error.message}`);
    }
  }
  if (result.created.length) log.log('[DB] indexes created:', result.created.join(', '));
  if (result.skipped.length) log.warn('[DB] indexes skipped:', result.skipped.join('; '));
  return result;
}

/** Lets SQLite refresh its query statistics; cheap, meant for startup and once a day. */
async function optimizeDb() {
  if (!isSqliteDialect()) return;
  try {
    await sequelize.query('PRAGMA optimize');
  } catch (error) {
    console.warn('[DB] optimize:', error.message);
  }
}

/** Folds the WAL file back into database.sqlite so it does not grow without limit. */
async function checkpointDb() {
  if (!isSqliteDialect()) return;
  try {
    await sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch (error) {
    console.warn('[DB] checkpoint:', error.message);
  }
}

export { ensureJobIndexes, optimizeDb, checkpointDb };
