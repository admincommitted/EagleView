// SQLite indexes for the job tables (29-Oct-2026)
// Job/invoice/item/container rows are always read by their parent id, and jobs by jobNo / BE no / SB no,
// but Sequelize only creates the primary key. Every index here is CREATE INDEX IF NOT EXISTS, so it is
// safe to run on each start; a column that does not exist in the table (old database) is skipped.
const { sequelize } = require('../db');

const WANTED = [
  ['ImportJob', ['jobNo']], ['ImportJob', ['icegateUniqueId']], ['ImportJob', ['status']], ['ImportJob', ['jobDate']],
  ['ImportInvoice', ['importJobId']],
  ['ImportItem', ['importInvoiceId']], ['ImportItem', ['importJobId']],
  ['ImportContainer', ['importJobId']],
  ['ImportFinalDoc', ['beNo']],
  ['ExportJob', ['jobNo']], ['ExportJob', ['sbNo']], ['ExportJob', ['icegateUniqueId']], ['ExportJob', ['status']], ['ExportJob', ['jobDate']],
  ['ExportInvoice', ['exportJobId']],
  ['ExportItem', ['exportInvoiceId']], ['ExportItem', ['exportJobId']],
  ['ExportContainer', ['exportJobId']], ['ExportDocument', ['exportJobId']], ['ExportDrawback', ['exportJobId']], ['ExportLicense', ['exportJobId']],
  ['ExportFinalDoc', ['sbNo']], ['ExportFinalDoc', ['jobNo']],
  ['TariffComponent', ['tariffHeaderId']],
  ['PartyBranch', ['partyId']], ['PartyADCode', ['partyId']], ['PartyDocument', ['partyId']], ['PartyItemMaster', ['partyId']],
  // AWB module: master/house AWB by number, child rows by awbId, tracking + logs + WhatsApp queue by awbNumber
  ['Airwaybill', ['awbNumber']], ['Airwaybill', ['status']],
  ['HouseAWB', ['awbNumber']], ['HouseAWB', ['masterAwbNumber']], ['HouseAWB', ['masterAwbId']],
  ['AwbOci', ['awbId']], ['AwbDimension', ['awbId']], ['AwbRateLine', ['awbId']], ['AwbOtherCharge', ['awbId']], ['SpecialHandlingCode', ['awbId']],
  ['AwbLog', ['awbNumber']], ['AwbTracking', ['awbNumber']], ['WhatsappNotificationQueue', ['sent']], ['WhatsappNotificationQueue', ['awbNumber']],
  // Accounts: voucher lines by voucher / ledger
  ['Voucher', ['voucherTypeId']], ['VoucherDetail', ['voucherId']], ['VoucherDetail', ['ledgerId']],
];

const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';

async function tableColumns(table) {
  const rows = await sequelize.query(`PRAGMA table_info(${q(table)})`, { type: sequelize.QueryTypes.SELECT });
  return new Set(rows.map(r => r.name));
}

// Creates the missing indexes; returns { created, skipped, existing }
async function ensureJobIndexes({ log = console } = {}) {
  const out = { created: [], skipped: [], existing: [] };
  if (sequelize.getDialect() !== 'sqlite') { out.skipped.push('not sqlite: indexes are managed on the server'); return out; }
  const colCache = {};
  for (const [modelName, cols] of WANTED) {
    const model = sequelize.models[modelName];
    if (!model) { out.skipped.push(modelName + ' (no model)'); continue; }
    const t = model.getTableName();
    const table = typeof t === 'string' ? t : t.tableName;
    try {
      if (!colCache[table]) colCache[table] = await tableColumns(table);
      if (!colCache[table].size) { out.skipped.push(table + ' (no table)'); continue; }
      const missing = cols.filter(c => !colCache[table].has(c));
      if (missing.length) { out.skipped.push(`${table}(${missing.join(',')}) column missing`); continue; }
      const name = `idx_${table}_${cols.join('_')}`.replace(/[^A-Za-z0-9_]/g, '_');
      const have = await sequelize.query(`PRAGMA index_list(${q(table)})`, { type: sequelize.QueryTypes.SELECT });
      if (have.some(i => i.name === name)) { out.existing.push(name); continue; }
      await sequelize.query(`CREATE INDEX IF NOT EXISTS ${q(name)} ON ${q(table)} (${cols.map(q).join(', ')})`);
      out.created.push(name);
    } catch (e) { out.skipped.push(`${table}(${cols.join(',')}) ${e.message}`); }
  }
  if (out.created.length) log.log('[DB] indexes created:', out.created.join(', '));
  if (out.skipped.length) log.warn('[DB] indexes skipped:', out.skipped.join('; '));
  return out;
}

// Lets SQLite refresh its query statistics; cheap, meant for startup and once a day
async function optimizeDb() {
  if (sequelize.getDialect() !== 'sqlite') return;
  try { await sequelize.query('PRAGMA optimize'); } catch (e) { console.warn('[DB] optimize:', e.message); }
}

// Folds the WAL file back into database.sqlite so it does not grow without limit
async function checkpointDb() {
  if (sequelize.getDialect() !== 'sqlite') return;
  try { await sequelize.query('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) { console.warn('[DB] checkpoint:', e.message); }
}

module.exports = { ensureJobIndexes, optimizeDb, checkpointDb, WANTED };
