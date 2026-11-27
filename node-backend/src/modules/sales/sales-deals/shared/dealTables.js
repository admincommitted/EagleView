import { q, x, ensure as ensureSalesTables, viewer } from '../../../../utils/common/salesHub.js';

// columns the deal screens need, added to the old tables (nothing is removed)
const ADDED_COLUMNS = {
  Leads: {
    customerId: 'INTEGER',
    contactId: 'INTEGER',
    salesPersonId: 'INTEGER',
    branchCode: 'TEXT',
    receivedVia: 'TEXT',
    quoteBy: 'TEXT',
    priority: 'TEXT',
    pkgs: 'REAL',
    grossWt: 'REAL',
    chargeableWt: 'REAL',
    cbm: 'REAL',
    containers: 'TEXT',
    isDg: 'INTEGER',
    isTemp: 'INTEGER',
    hsCode: 'TEXT',
    cargoValue: 'REAL',
    cargoCurrency: 'TEXT',
    frequency: 'TEXT',
    pickupAt: 'TEXT',
    deliveryAt: 'TEXT',
    lostTo: 'TEXT',
    closedAt: 'TEXT',
    updatedBy: 'TEXT',
  },
  Quotations: {
    customerId: 'INTEGER',
    contactId: 'INTEGER',
    salesPersonId: 'INTEGER',
    branchCode: 'TEXT',
    serviceType: 'TEXT',
    incoterms: 'TEXT',
    quoteCurrency: 'TEXT',
    pkgs: 'REAL',
    grossWt: 'REAL',
    chargeableWt: 'REAL',
    cbm: 'REAL',
    containers: 'TEXT',
    cargoValue: 'REAL',
    cargoCurrency: 'TEXT',
    carrier: 'TEXT',
    routing: 'TEXT',
    transitTime: 'TEXT',
    frequency: 'TEXT',
    terms: 'TEXT',
    revision: 'INTEGER',
    parentId: 'INTEGER',
    rootNo: 'TEXT',
    docketNo: 'TEXT',
    wonAt: 'TEXT',
    lostTo: 'TEXT',
    lostRate: 'TEXT',
    marginInr: 'REAL',
    marginPct: 'REAL',
    updatedBy: 'TEXT',
  },
  QuotationCharges: {
    chargeId: 'INTEGER',
    sacCode: 'TEXT',
    gstRate: 'REAL',
    section: 'TEXT',
    minSell: 'REAL',
    minBuy: 'REAL',
    vendor: 'TEXT',
    sellAmount: 'REAL',
    buyAmount: 'REAL',
    sellInr: 'REAL',
    buyInr: 'REAL',
  },
};

async function createBaseTables() {
  await x(`CREATE TABLE IF NOT EXISTS Leads (id INTEGER PRIMARY KEY AUTOINCREMENT, enquiryNo TEXT UNIQUE, date TEXT, partyLedgerId INTEGER, clientName TEXT, contactPerson TEXT,
    designation TEXT, email TEXT, phone TEXT, mode TEXT, serviceType TEXT, origin TEXT, destination TEXT, incoterms TEXT, readinessDate TEXT, commodity TEXT, containerType TEXT,
    weight REAL, volume REAL, targetRate TEXT, competitor TEXT, remarks TEXT, status TEXT, lostReason TEXT, createdBy INTEGER, createdByName TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x(`CREATE TABLE IF NOT EXISTS Quotations (id INTEGER PRIMARY KEY AUTOINCREMENT, quoteNo TEXT NOT NULL UNIQUE, leadId INTEGER, date TEXT NOT NULL, validUntil TEXT, partyLedgerId INTEGER,
    clientName TEXT NOT NULL, contactPerson TEXT, email TEXT, origin TEXT, destination TEXT, mode TEXT, commodity TEXT, remarks TEXT, status TEXT NOT NULL DEFAULT 'DRAFT', sentAt DATETIME,
    sentTo TEXT, decidedAt DATETIME, rejectReason TEXT, jobNo TEXT, totalBuyInr REAL DEFAULT 0, totalSellInr REAL DEFAULT 0, createdBy INTEGER, createdByName TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x(`CREATE TABLE IF NOT EXISTS QuotationCharges (id INTEGER PRIMARY KEY AUTOINCREMENT, quotationId INTEGER NOT NULL, head TEXT NOT NULL, buyRate REAL DEFAULT 0, sellRate REAL DEFAULT 0,
    currency TEXT DEFAULT 'INR', roe REAL DEFAULT 1, qty REAL DEFAULT 1, basis TEXT, remarks TEXT, sortOrder INTEGER DEFAULT 0, createdAt DATETIME, updatedAt DATETIME)`);
}

async function addMissingColumns() {
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    const existing = new Set((await q(`PRAGMA table_info("${table}")`)).map((column) => column.name));
    for (const [column, type] of Object.entries(columns)) {
      if (!existing.has(column)) await x(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    }
  }
}

async function createIndexes() {
  await x('CREATE INDEX IF NOT EXISTS idx_leads_cust ON Leads (customerId, status)');
  await x('CREATE INDEX IF NOT EXISTS idx_quotes_lead ON Quotations (leadId, status)');
  await x('CREATE INDEX IF NOT EXISTS idx_qcharges_quote ON QuotationCharges (quotationId)');
}

let dealTablesReady = null;

/**
 * Enquiries and quotations use the old tables Leads, Quotations and QuotationCharges (the Provisional Sheet reads a
 * docket's quotation from them) with the columns the deal screens need. Made / widened once, on first use.
 */
export function ensureDealTables() {
  dealTablesReady =
    dealTablesReady ||
    (async () => {
      try {
        await ensureSalesTables();
        await createBaseTables();
        await addMissingColumns();
        await createIndexes();
      } catch (error) {
        dealTablesReady = null;
        throw error;
      }
    })();
  return dealTablesReady;
}

/** The deal tables first, then who is looking (the order every deal route used). */
export async function loadDealViewer(req) {
  await ensureDealTables();
  return viewer(req);
}
