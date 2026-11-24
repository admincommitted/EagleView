// Sales module (logistics / freight forwarding) - tables, lists and who-sees-what. 11-Nov-2026, step 1:
// sales persons and the customer's sales profile (KAM, prospect / customer, industry, potential, lanes, contacts).
// Tables are made on first use (ensure). The accounts ledger stays the customer's master for billing; the sales profile
// sits beside it (ledgerId) - or stands alone for a prospect, until it is billed.
const { sequelize } = require('../db');
const { QueryTypes } = require('sequelize');

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const now = () => new Date().toISOString();
const today = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10); // India date

// ---- fixed lists (the editable ones are in SalesLookups) ----
const CUSTOMER_STATUS = [
  ['PROSPECT', 'Prospect', 'Not billed yet - being worked on'],
  ['ACTIVE', 'Active customer', 'Billed / shipping with us'],
  ['ON_HOLD', 'On hold', 'Business paused (credit, dispute, season)'],
  ['LOST', 'Lost', 'Moved to a competitor / closed'],
  ['BLOCKED', 'Blocked', 'Do not quote (blacklisted / bad payment)'],
];
const CUSTOMER_TYPES = [
  ['EXPORTER', 'Exporter / shipper'], ['IMPORTER', 'Importer / consignee'], ['EXIM', 'Exporter + importer'],
  ['FORWARDER', 'Forwarder / co-loader (trade partner)'], ['CHA', 'Customs broker (CHA)'], ['OVERSEAS_AGENT', 'Overseas agent'],
  ['NOMINATION', 'Nominated by overseas agent'], ['ECOMMERCE', 'E-commerce / courier'], ['GOVT', 'Government / PSU'], ['OTHER', 'Other'],
];
const SEGMENTS = [['KEY', 'Key account'], ['REGULAR', 'Regular'], ['OCCASIONAL', 'Occasional'], ['NEW', 'New / first shipments']];
// services and the lane modes use the same codes
const SERVICES = [
  ['AIR_EXP', 'Air Export'], ['AIR_IMP', 'Air Import'], ['SEA_EXP_FCL', 'Sea Export FCL'], ['SEA_EXP_LCL', 'Sea Export LCL'],
  ['SEA_IMP_FCL', 'Sea Import FCL'], ['SEA_IMP_LCL', 'Sea Import LCL'], ['CUSTOMS_IMP', 'Customs clearance - Import'], ['CUSTOMS_EXP', 'Customs clearance - Export'],
  ['TRANSPORT', 'Transport / trucking'], ['WAREHOUSE', 'Warehousing'], ['COURIER', 'Courier / express'], ['PROJECT', 'Project / ODC cargo'],
  ['CROSS_TRADE', 'Cross trade'], ['INSURANCE', 'Cargo insurance'], ['DG', 'Dangerous goods handling'], ['COLD_CHAIN', 'Cold chain / temperature controlled'],
];
const VOLUME_UNITS = [['KG', 'Kg'], ['CBM', 'CBM'], ['TEU', 'TEU (20\')'], ['FEU', 'FEU (40\')'], ['CONTAINERS', 'Containers'], ['SHIPMENTS', 'Shipments'], ['JOBS', 'Customs jobs'], ['TRUCKS', 'Trucks'], ['PALLETS', 'Pallets'], ['PKGS', 'Packages']];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const CONTAINER_TYPES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR', '20TK', 'LCL'];
const SP_ROLES = [['EXECUTIVE', 'Sales executive'], ['KAM', 'Key account manager'], ['MANAGER', 'Sales manager'], ['HEAD', 'Head of sales'], ['CS', 'Customer service (inside sales)']];
const TURNOVER = ['Up to 5 Cr', '5 - 25 Cr', '25 - 100 Cr', '100 - 500 Cr', '500 Cr +'];
const CREDIT_TERMS = [['ADVANCE', 'Advance'], ['CASH', 'Cash / against delivery'], ['CREDIT', 'Credit (days)'], ['PDC', 'Post-dated cheque']];
// editable lists, seeded once
const LOOKUP_KINDS = {
  INDUSTRY: ['Pharmaceuticals', 'Automobile & auto parts', 'Garments & textiles', 'Electronics & electricals', 'Engineering goods & machinery', 'Chemicals', 'FMCG',
    'Food & agro / perishables', 'Handicrafts & home decor', 'Leather & footwear', 'Gems & jewellery', 'Medical devices', 'Telecom', 'IT hardware', 'Steel & metals',
    'Plastics & packaging', 'Furniture', 'Toys & sports goods', 'E-commerce', 'Aerospace & defence', 'Oil & gas', 'Project cargo', 'Others'],
  SOURCE: ['Existing customer', 'Reference', 'Cold call', 'Website / email enquiry', 'Exhibition / trade fair', 'Overseas agent nomination', 'Tender / RFQ', 'Social media', 'Walk-in', 'Associations (FIEO / EPC)', 'Other'],
  COMPETITOR: [],
  LOST_REASON: ['Rate higher', 'Transit time', 'Service issue', 'Credit terms', 'Nominated to another agent', 'Shipment cancelled / no business', 'No response from customer', 'Relationship with competitor', 'Other'],
  DEPARTMENT: ['Logistics', 'Exports', 'Imports', 'Purchase', 'Accounts', 'Management', 'Supply chain', 'Commercial'],
  COMMODITY: [],
};

let ready = null;
const ensure = () => (ready = ready || (async () => {
  await x(`CREATE TABLE IF NOT EXISTS SalesPersons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL, userId INTEGER, username TEXT,
    mobile TEXT, phone TEXT, email TEXT, whatsapp TEXT, designation TEXT, role TEXT, reportingToId INTEGER, branchCodes TEXT, services TEXT, aliases TEXT,
    joinDate TEXT, leaveDate TEXT, isActive INTEGER DEFAULT 1, remarks TEXT, createdBy TEXT, updatedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x(`CREATE TABLE IF NOT EXISTS SalesCustomers (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER UNIQUE, partyId INTEGER, name TEXT NOT NULL, status TEXT,
    customerType TEXT, industry TEXT, segment TEXT, source TEXT, sourceDetail TEXT, kamId INTEGER, secondaryIds TEXT, branchCode TEXT, services TEXT,
    address TEXT, city TEXT, state TEXT, country TEXT, pinCode TEXT, gstin TEXT, pan TEXT, iec TEXT, website TEXT, phone TEXT, email TEXT,
    turnoverBand TEXT, employees TEXT, potentialAirKg REAL, potentialSeaFclTeu REAL, potentialSeaLclCbm REAL, potentialCustomsJobs REAL, potentialTrucks REAL,
    potentialRevenue REAL, currentSharePct REAL, competitors TEXT, creditTerm TEXT, creditDaysAsked INTEGER, creditLimitAsked REAL,
    firstContactDate TEXT, nextReviewDate TEXT, lostReason TEXT, lostTo TEXT, lostDate TEXT, remarks TEXT,
    createdBy TEXT, updatedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_salescust_kam ON SalesCustomers (kamId, status)');
  await x('CREATE INDEX IF NOT EXISTS idx_salescust_name ON SalesCustomers (name)');
  await x(`CREATE TABLE IF NOT EXISTS SalesContacts (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, name TEXT NOT NULL, designation TEXT, department TEXT,
    mobile TEXT, phone TEXT, email TEXT, whatsapp TEXT, isPrimary INTEGER DEFAULT 0, isDecisionMaker INTEGER DEFAULT 0, sendQuotes INTEGER DEFAULT 1,
    birthday TEXT, anniversary TEXT, linkedin TEXT, remarks TEXT, isActive INTEGER DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_salescontacts ON SalesContacts (customerId)');
  await x(`CREATE TABLE IF NOT EXISTS SalesLanes (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, service TEXT, origin TEXT, originCountry TEXT,
    destination TEXT, destinationCountry TEXT, commodity TEXT, hsCode TEXT, incoterm TEXT, containerType TEXT, shipmentsPerMonth REAL, volumePerShipment REAL,
    volumeUnit TEXT, isDg INTEGER DEFAULT 0, isTempControlled INTEGER DEFAULT 0, currentVendor TEXT, currentRate REAL, rateCurrency TEXT, rateBasis TEXT, targetRate REAL,
    status TEXT, remarks TEXT, isActive INTEGER DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_saleslanes ON SalesLanes (customerId)');
  await x(`CREATE TABLE IF NOT EXISTS SalesAssignments (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, salesPersonId INTEGER, role TEXT, fromDate TEXT, toDate TEXT,
    reason TEXT, changedBy TEXT, createdAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_salesassign ON SalesAssignments (customerId, fromDate)');
  // a customer billed on more than one ledger (iCAFFE keeps e.g. "X PVT LTD" and "X PVT LTD (IMPORT DUTY ACCOUNT)" / "-DUTY A/C" / "- DO"):
  // the main ledger is SalesCustomers.ledgerId, the others are here. kind REIMB = duty / DO / direct-party (reimbursement) account
  await x(`CREATE TABLE IF NOT EXISTS SalesCustomerLedgers (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, ledgerId INTEGER NOT NULL UNIQUE, kind TEXT,
    createdBy TEXT, createdAt DATETIME)`);
  await x('CREATE INDEX IF NOT EXISTS idx_salescustledgers ON SalesCustomerLedgers (customerId)');
  await x(`CREATE TABLE IF NOT EXISTS SalesLookups (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, value TEXT NOT NULL, sortOrder INTEGER, isActive INTEGER DEFAULT 1,
    createdAt DATETIME, updatedAt DATETIME, UNIQUE (kind, value))`);
  const have = await q('SELECT kind, count(*) n FROM SalesLookups GROUP BY kind');
  const seeded = new Set(have.map(r => r.kind));
  for (const [kind, vals] of Object.entries(LOOKUP_KINDS)) {
    if (seeded.has(kind)) continue;
    let i = 0; for (const v of vals) await x('INSERT OR IGNORE INTO SalesLookups (kind, value, sortOrder, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?)', [kind, v, ++i, now(), now()]);
  }
})().catch(e => { ready = null; throw e; }));

// ---- who sees what ----
// admin: everything (in the branches picked). A user linked to a sales person: own customers (KAM or secondary) and, for a
// manager / head, everyone reporting to them (any depth). Any other user: the customers of the branches they may see.
async function viewer(req) {
  await ensure();
  const u = req.user || {};
  const isAdmin = String(u.role || '').toLowerCase() === 'admin';
  const me = u.id ? (await q('SELECT * FROM SalesPersons WHERE userId = ? AND coalesce(isActive, 1) = 1 ORDER BY id LIMIT 1', [u.id]))[0] : null;
  let team = null; // null = not limited by person
  if (me && !isAdmin) {
    team = new Set([me.id]);
    if (['MANAGER', 'HEAD'].includes(String(me.role || '').toUpperCase())) {
      const all = await q('SELECT id, reportingToId FROM SalesPersons');
      let grew = true;
      while (grew) { grew = false; for (const p of all) if (p.reportingToId && team.has(p.reportingToId) && !team.has(p.id)) { team.add(p.id); grew = true; } }
    }
  }
  let branches = null; // null = every branch
  try {
    const { allowedFor } = require('./branchScope');
    const allowed = await allowedFor(u);
    const want = String((req.get && req.get('x-branch')) || '').trim().toUpperCase();
    if (want && want !== 'ALL' && (!allowed || allowed.includes(want))) branches = [want];
    else if (allowed) branches = allowed;
  } catch (e) { branches = null; }
  const canManage = isAdmin || !me || ['MANAGER', 'HEAD'].includes(String(me.role || '').toUpperCase());
  return { isAdmin, me, team, branches, canManage, user: u.fullName || u.username || u.email || '' };
}
// SQL condition on SalesCustomers (alias c) for the viewer
function customerWhere(v, alias = 'c') {
  const w = []; const p = [];
  if (v.team) {
    const ids = [...v.team];
    const sec = ids.map(() => `(',' || coalesce(${alias}.secondaryIds, '') || ',') LIKE ?`).join(' OR ');
    w.push(`(${alias}.kamId IN (${ids.map(() => '?').join(',')}) OR ${sec})`); p.push(...ids, ...ids.map(i => `%,${i},%`));
  } else if (v.branches && v.branches.length) {
    w.push(`(${alias}.branchCode IS NULL OR ${alias}.branchCode = '' OR upper(${alias}.branchCode) IN (${v.branches.map(() => '?').join(',')}))`); p.push(...v.branches);
  }
  return { w, p };
}

// ---- helpers ----
const clean = (s) => (s == null ? null : String(s).trim() || null);
const upper = (s) => (clean(s) ? clean(s).toUpperCase() : null);
const numOrNull = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(s => String(s).trim()).filter(Boolean);
const csv = (v) => { const l = listOf(v); return l.length ? l.join(',') : null; };
const nameKey = (s) => String(s || '').toUpperCase().replace(/\b(MR|MRS|MS|DR)\.?\s+/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
const GSTIN_RE = /^(?!0{15})[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/; // iCAFFE keeps 000000000000000 for 'no GSTIN'
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// sales person matched to a name typed in iCAFFE (docket "marketing person", party marketing person): name or alias
async function personByName(name) {
  const k = nameKey(name); if (!k) return null;
  const all = await q('SELECT id, name, aliases FROM SalesPersons');
  return all.find(p => nameKey(p.name) === k || listOf(p.aliases).some(a => nameKey(a) === k)) || null;
}

// the Sundry Debtors groups (and every group under them)
async function debtorGroupIds() {
  const groups = await q('SELECT id, parentId, name FROM AccountGroups');
  const roots = groups.filter(g => /^sundry debtors$/i.test(String(g.name || '').trim())).map(g => g.id);
  const out = new Set(roots); let grew = true;
  while (grew) { grew = false; for (const g of groups) if (g.parentId && out.has(g.parentId) && !out.has(g.id)) { out.add(g.id); grew = true; } }
  return out;
}

// ---- iCAFFE debtor groups ----
// iCAFFE keeps debtors in groups named after the sales person ("SUNDRY DEBTORS (DEEPAK KUMAR)", "Sundry Debtors - Mr. Rajan
// Sharma", "SUNDRY DEBTORS (POOJA SINGH-MUMBAI)"), after a branch / place, or after a kind (DIRECT, COURIER DIVISION, OVERSEAS
// AGENT, CASE, DISPUTED, CUSTOM DUTY, Blocked Recoveries). groupInfo() reads the person, the kind and the status out of the name.
const NOT_PERSON = ['DIRECT', 'COURIER DIVISION', 'OVERSEAS AGENT', 'CASE', 'DISBUTED', 'DISPUTED', 'W/KYC', 'W KYC', 'CUSTOM DUTY', 'HYDERABAD', 'BANGALORE', 'MAROL BRANCH',
  'GOA', 'PUNE', 'AHAMEDABAD', 'AHMEDABAD', 'GUJRAT', 'LUDHIANA', 'ANDHERI', 'CHENNAI', 'MUMBAI', 'JAIPUR', 'DELHI', 'KOLKATA', 'KOLKATTA', 'BLOCKED RECOVERIES', 'OVERSEAS'];
const PLACE_WORDS = /\b(MUMBAI|DELHI|JAIPUR|CHENNAI|KOLKAT+A|YUSUF SARAI|EXPORT|IMPORT|BRANCH|AHMD|AHMEDABAD)\b/g;
function groupInfo(name) {
  const g = String(name || '').trim();
  const U = g.toUpperCase();
  const out = { person: null, kind: null, status: null, customerType: null, service: null };
  if (/CUSTOM\s*DUTY/.test(U)) out.kind = 'REIMB';
  if (/\(\s*CASE\s*\)|BLOCKED RECOVER/.test(U)) out.status = 'BLOCKED';
  else if (/DIS[BP]UTED|W\/?\s*KYC/.test(U)) out.status = 'ON_HOLD';
  if (/OVERSEAS/.test(U)) out.customerType = 'OVERSEAS_AGENT';
  if (/COURIER/.test(U)) out.service = 'COURIER';
  if (/\(\s*\d{4}\s*-\s*\d{4}\s*\)/.test(U)) return out;
  let inner = (/\(([^)]*)\)/.exec(g) || [])[1] || (/sundry debtors\s*-\s*(.+)$/i.exec(g) || [])[1] || (/^sundry debtors\s*\(?\s*([^)]*)$/i.exec(g) || [])[1] || '';
  inner = inner.replace(/^\s*(MR|MRS|MS|DR)\.?\s+/i, '').trim();
  if (!inner) return out;
  if (NOT_PERSON.includes(inner.toUpperCase()) || /^COMMITTED\b/i.test(inner)) return out;
  const p = inner.split(/\s*-\s*/)[0].toUpperCase().replace(PLACE_WORDS, '').replace(/\s+/g, ' ').trim();
  if (p && /^[A-Z. ]{3,}$/.test(p) && !NOT_PERSON.includes(p)) out.person = p.replace(/\b([A-Z])([A-Z]*)\b/g, (m, a, b) => a + b.toLowerCase());
  return out;
}
// a ledger that is the duty / DO / direct-party (reimbursement) account of a customer
const isReimbLedger = (name, groupName) => /CUSTOM\s*DUTY/i.test(groupName || '') || /DUTY\s*(A\/?C|ACCOUNT)|IMPORT DUTY|\(\s*DIRECT PARTY|[-(]\s*D\.?O\.?\s*\)?$|\bDUTY\b/i.test(name || '');
// the customer's own name without the account suffixes, for matching its ledgers
const DROP = new Set(['PVT', 'PRIVATE', 'PRIVAT', 'LTD', 'LIMITED', 'LIMITE', 'LIMIT', 'LTD.', 'LLP', 'INC', 'CO', 'COMPANY', 'THE', 'INDIA', 'I', 'P', 'M/S', 'MS', 'AND']);
const baseName = (name) => String(name || '').toUpperCase()
  .replace(/\((IMPORT )?DUTY ACCOUNT\)|\(DIRECT PARTY ACCOUNT\)|\(OVERSEAS\)|\(CASE\)|\(FY[^)]*\)/g, ' ')
  .replace(/[-\s]+(DUTY A\/?C|DUTY|DO|DR|COURIER DIV(ISION)?)\s*$/g, ' ')
  .replace(/[^A-Z0-9]+/g, ' ').trim().split(' ').filter(w => w && !DROP.has(w)).join(' ');
const panOf = (gstin, pan) => { const g = String(gstin || '').toUpperCase(); if (GSTIN_RE.test(g) && PAN_RE.test(g.slice(2, 12))) return g.slice(2, 12); const p = String(pan || '').toUpperCase(); return PAN_RE.test(p) ? p : null; };

module.exports = {
  groupInfo, isReimbLedger, baseName, panOf,
  q, x, now, today, ensure, viewer, customerWhere, personByName, debtorGroupIds, nameKey,
  clean, upper, numOrNull, listOf, csv, GSTIN_RE, PAN_RE, EMAIL_RE,
  CUSTOMER_STATUS, CUSTOMER_TYPES, SEGMENTS, SERVICES, VOLUME_UNITS, INCOTERMS, CONTAINER_TYPES, SP_ROLES, TURNOVER, CREDIT_TERMS, LOOKUP_KINDS,
};
