import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';

/** Raw SELECT: the rows as plain objects. */
export const selectRows = (sql, replacements = [], transaction) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });

/** Raw INSERT / UPDATE / DELETE / DDL. */
export const execute = (sql, replacements = [], transaction) => sequelize.query(sql, { replacements, transaction });

/** Searchable docket columns; every other field of the form is kept in dataJson. */
export const DOCKET_COLUMNS = [
  'docketNo',
  'division',
  'branchCode',
  'docketDate',
  'clearanceDate',
  'customsOnly',
  'jobType',
  'shipmentType',
  'houseType',
  'cargoType',
  'freightTerm',
  'nomination',
  'shipmentTerm',
  'mainParty',
  'mainPartyId',
  'mainAddress',
  'otherParty',
  'overseasAgent',
  'subAgent',
  'billingType',
  'billingParty',
  'billingAddress',
  'notifyParty',
  'cha',
  'mawbNo',
  'mawbDate',
  'hawbNo',
  'hawbDate',
  'carrier',
  'flightVessel',
  'voyage',
  'etd',
  'eta',
  'igmNo',
  'igmDate',
  'originPort',
  'destinationPort',
  'dischargePort',
  'clearanceAt',
  'pkgs',
  'pkgUnit',
  'grossWeight',
  'chargeableWeight',
  'volume',
  'goodsDesc',
  'stage',
  'currentStatus',
  'docketOwner',
  'referenceNo',
  'remarks',
  'marketingPerson',
  'quotationNo',
  'placeOfSupply',
  'costCentre',
  'ediJobNo',
  'poNo',
];
export const NUMBER_COLUMNS = new Set([
  'pkgs',
  'grossWeight',
  'chargeableWeight',
  'volume',
  'customsOnly',
  'mainPartyId',
]);

const columnType = (column) => (NUMBER_COLUMNS.has(column) ? 'REAL' : 'TEXT');
const columnNamesOf = async (table) =>
  new Set((await selectRows(`PRAGMA table_info(${table})`)).map((column) => column.name));
const STARTUP_DELAY_MS = 4000;

async function createShipmentsTable() {
  const columns = DOCKET_COLUMNS.map(
    (column) => column + ' ' + columnType(column) + (column === 'docketNo' ? ' UNIQUE' : ''),
  ).join(', ');
  await execute(`CREATE TABLE IF NOT EXISTS Shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, ${columns},
    containersJson TEXT, dimensionsJson TEXT, docsJson TEXT, dataJson TEXT, cancelReason TEXT, completedOn TEXT, createdBy TEXT, modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  const existing = await columnNamesOf('Shipments');
  for (const column of DOCKET_COLUMNS) {
    if (!existing.has(column)) await execute(`ALTER TABLE Shipments ADD COLUMN ${column} ${columnType(column)}`);
  }
  await execute('CREATE INDEX IF NOT EXISTS idx_shipments_div ON Shipments (division, branchCode, docketDate)');
}

async function createTables() {
  await createShipmentsTable();
  await execute(`CREATE TABLE IF NOT EXISTS ShipmentEvents (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, kind TEXT, title TEXT, eventDate TEXT, eventTime TEXT, doneDate TEXT, doneTime TEXT,
    status TEXT, remarks TEXT, dataJson TEXT, createdBy TEXT, modifiedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await execute('CREATE INDEX IF NOT EXISTS idx_shipev ON ShipmentEvents (shipmentId, kind)');
  await execute('CREATE INDEX IF NOT EXISTS idx_shipments_edijob ON Shipments (ediJobNo)');
  await execute(
    'CREATE TABLE IF NOT EXISTS ShipmentsDeleted (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, docketNo TEXT, dataJson TEXT, eventsJson TEXT, reason TEXT, deletedBy TEXT, createdAt DATETIME, updatedAt DATETIME)',
  );
  // the deleted copy also keeps the provisional sheet and the uploaded files' rows
  const deletedColumns = await columnNamesOf('ShipmentsDeleted');
  for (const column of ['provisionalJson', 'filesJson']) {
    if (!deletedColumns.has(column)) await execute(`ALTER TABLE ShipmentsDeleted ADD COLUMN ${column} TEXT`);
  }
  await execute('CREATE INDEX IF NOT EXISTS idx_shipments_mawb ON Shipments (mawbNo, hawbNo)');
  await execute(`CREATE TABLE IF NOT EXISTS ShipmentFiles (id INTEGER PRIMARY KEY AUTOINCREMENT, shipmentId INTEGER, docType TEXT, fileName TEXT, originalName TEXT, mimeType TEXT, filePath TEXT, size INTEGER,
    remarks TEXT, uploadedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await execute('CREATE INDEX IF NOT EXISTS idx_shipfiles ON ShipmentFiles (shipmentId)');
  await execute(
    'CREATE TABLE IF NOT EXISTS ShipmentSeries (id INTEGER PRIMARY KEY AUTOINCREMENT, branchCode TEXT, division TEXT, fy TEXT, nextNo INTEGER, createdAt DATETIME, updatedAt DATETIME, UNIQUE (branchCode, division, fy))',
  );
}

let tablesReady = null;

/** Shipments, ShipmentEvents, ShipmentsDeleted, ShipmentFiles, ShipmentSeries - made once; tried again after a failure. */
export function ensureShipmentTables() {
  tablesReady =
    tablesReady ||
    createTables().catch((error) => {
      tablesReady = null;
      throw error;
    });
  return tablesReady;
}

/** Startup: the tables are made a few seconds after the backend starts, not only when the screen is first used. */
export function initShipmentTables() {
  setTimeout(async () => {
    try {
      await ensureShipmentTables();
      console.log('[shipments] tables ready: Shipments, ShipmentEvents, ShipmentSeries');
    } catch (error) {
      console.error('[shipments] tables not made:', error.message);
    }
  }, STARTUP_DELAY_MS);
}
