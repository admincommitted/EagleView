// Sales module (logistics / freight forwarding) - tables, lists and who-sees-what: sales persons and the customer's sales
// profile (KAM, prospect / customer, industry, potential, lanes, contacts).
// Tables are made on first use (ensure). The accounts ledger stays the customer's master for billing; the sales profile
// sits beside it (ledgerId) - or stands alone for a prospect, until it is billed.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/database.js';
import { allowedFor } from '../../middlewares/branchScope.middleware.js';

const q = (sql, p = [], t) => sequelize.query(sql, { replacements: p, type: QueryTypes.SELECT, transaction: t });
const x = (sql, p = [], t) => sequelize.query(sql, { replacements: p, transaction: t });
const now = () => new Date().toISOString();
const INDIA_OFFSET_MS = 19800000; // +05:30
const today = () => new Date(Date.now() + INDIA_OFFSET_MS).toISOString().slice(0, 10); // India date

// ---- fixed lists (the editable ones are in SalesLookups) ----
const CUSTOMER_STATUS = [
  ['PROSPECT', 'Prospect', 'Not billed yet - being worked on'],
  ['ACTIVE', 'Active customer', 'Billed / shipping with us'],
  ['ON_HOLD', 'On hold', 'Business paused (credit, dispute, season)'],
  ['LOST', 'Lost', 'Moved to a competitor / closed'],
  ['BLOCKED', 'Blocked', 'Do not quote (blacklisted / bad payment)'],
];
const CUSTOMER_TYPES = [
  ['EXPORTER', 'Exporter / shipper'],
  ['IMPORTER', 'Importer / consignee'],
  ['EXIM', 'Exporter + importer'],
  ['FORWARDER', 'Forwarder / co-loader (trade partner)'],
  ['CHA', 'Customs broker (CHA)'],
  ['OVERSEAS_AGENT', 'Overseas agent'],
  ['NOMINATION', 'Nominated by overseas agent'],
  ['ECOMMERCE', 'E-commerce / courier'],
  ['GOVT', 'Government / PSU'],
  ['OTHER', 'Other'],
];
const SEGMENTS = [
  ['KEY', 'Key account'],
  ['REGULAR', 'Regular'],
  ['OCCASIONAL', 'Occasional'],
  ['NEW', 'New / first shipments'],
];
// services and the lane modes use the same codes
const SERVICES = [
  ['AIR_EXP', 'Air Export'],
  ['AIR_IMP', 'Air Import'],
  ['SEA_EXP_FCL', 'Sea Export FCL'],
  ['SEA_EXP_LCL', 'Sea Export LCL'],
  ['SEA_IMP_FCL', 'Sea Import FCL'],
  ['SEA_IMP_LCL', 'Sea Import LCL'],
  ['CUSTOMS_IMP', 'Customs clearance - Import'],
  ['CUSTOMS_EXP', 'Customs clearance - Export'],
  ['TRANSPORT', 'Transport / trucking'],
  ['WAREHOUSE', 'Warehousing'],
  ['COURIER', 'Courier / express'],
  ['PROJECT', 'Project / ODC cargo'],
  ['CROSS_TRADE', 'Cross trade'],
  ['INSURANCE', 'Cargo insurance'],
  ['DG', 'Dangerous goods handling'],
  ['COLD_CHAIN', 'Cold chain / temperature controlled'],
];
const VOLUME_UNITS = [
  ['KG', 'Kg'],
  ['CBM', 'CBM'],
  ['TEU', "TEU (20')"],
  ['FEU', "FEU (40')"],
  ['CONTAINERS', 'Containers'],
  ['SHIPMENTS', 'Shipments'],
  ['JOBS', 'Customs jobs'],
  ['TRUCKS', 'Trucks'],
  ['PALLETS', 'Pallets'],
  ['PKGS', 'Packages'],
];
const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const CONTAINER_TYPES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF', '20OT', '40OT', '20FR', '40FR', '20TK', 'LCL'];
const SP_ROLES = [
  ['EXECUTIVE', 'Sales executive'],
  ['KAM', 'Key account manager'],
  ['MANAGER', 'Sales manager'],
  ['HEAD', 'Head of sales'],
  ['CS', 'Customer service (inside sales)'],
];
const TURNOVER = ['Up to 5 Cr', '5 - 25 Cr', '25 - 100 Cr', '100 - 500 Cr', '500 Cr +'];
const CREDIT_TERMS = [
  ['ADVANCE', 'Advance'],
  ['CASH', 'Cash / against delivery'],
  ['CREDIT', 'Credit (days)'],
  ['PDC', 'Post-dated cheque'],
];
// editable lists, seeded once
const LOOKUP_KINDS = {
  INDUSTRY: [
    'Pharmaceuticals',
    'Automobile & auto parts',
    'Garments & textiles',
    'Electronics & electricals',
    'Engineering goods & machinery',
    'Chemicals',
    'FMCG',
    'Food & agro / perishables',
    'Handicrafts & home decor',
    'Leather & footwear',
    'Gems & jewellery',
    'Medical devices',
    'Telecom',
    'IT hardware',
    'Steel & metals',
    'Plastics & packaging',
    'Furniture',
    'Toys & sports goods',
    'E-commerce',
    'Aerospace & defence',
    'Oil & gas',
    'Project cargo',
    'Others',
  ],
  SOURCE: [
    'Existing customer',
    'Reference',
    'Cold call',
    'Website / email enquiry',
    'Exhibition / trade fair',
    'Overseas agent nomination',
    'Tender / RFQ',
    'Social media',
    'Walk-in',
    'Associations (FIEO / EPC)',
    'Other',
  ],
  COMPETITOR: [],
  LOST_REASON: [
    'Rate higher',
    'Transit time',
    'Service issue',
    'Credit terms',
    'Nominated to another agent',
    'Shipment cancelled / no business',
    'No response from customer',
    'Relationship with competitor',
    'Other',
  ],
  DEPARTMENT: ['Logistics', 'Exports', 'Imports', 'Purchase', 'Accounts', 'Management', 'Supply chain', 'Commercial'],
  COMMODITY: [],
};

const MANAGER_ROLES = ['MANAGER', 'HEAD'];

const CREATE_SALES_TABLES = [
  `CREATE TABLE IF NOT EXISTS SalesPersons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL, userId INTEGER, username TEXT,
    mobile TEXT, phone TEXT, email TEXT, whatsapp TEXT, designation TEXT, role TEXT, reportingToId INTEGER, branchCodes TEXT, services TEXT, aliases TEXT,
    joinDate TEXT, leaveDate TEXT, isActive INTEGER DEFAULT 1, remarks TEXT, createdBy TEXT, updatedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`,
  `CREATE TABLE IF NOT EXISTS SalesCustomers (id INTEGER PRIMARY KEY AUTOINCREMENT, ledgerId INTEGER UNIQUE, partyId INTEGER, name TEXT NOT NULL, status TEXT,
    customerType TEXT, industry TEXT, segment TEXT, source TEXT, sourceDetail TEXT, kamId INTEGER, secondaryIds TEXT, branchCode TEXT, services TEXT,
    address TEXT, city TEXT, state TEXT, country TEXT, pinCode TEXT, gstin TEXT, pan TEXT, iec TEXT, website TEXT, phone TEXT, email TEXT,
    turnoverBand TEXT, employees TEXT, potentialAirKg REAL, potentialSeaFclTeu REAL, potentialSeaLclCbm REAL, potentialCustomsJobs REAL, potentialTrucks REAL,
    potentialRevenue REAL, currentSharePct REAL, competitors TEXT, creditTerm TEXT, creditDaysAsked INTEGER, creditLimitAsked REAL,
    firstContactDate TEXT, nextReviewDate TEXT, lostReason TEXT, lostTo TEXT, lostDate TEXT, remarks TEXT,
    createdBy TEXT, updatedBy TEXT, createdAt DATETIME, updatedAt DATETIME)`,
  'CREATE INDEX IF NOT EXISTS idx_salescust_kam ON SalesCustomers (kamId, status)',
  'CREATE INDEX IF NOT EXISTS idx_salescust_name ON SalesCustomers (name)',
  `CREATE TABLE IF NOT EXISTS SalesContacts (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, name TEXT NOT NULL, designation TEXT, department TEXT,
    mobile TEXT, phone TEXT, email TEXT, whatsapp TEXT, isPrimary INTEGER DEFAULT 0, isDecisionMaker INTEGER DEFAULT 0, sendQuotes INTEGER DEFAULT 1,
    birthday TEXT, anniversary TEXT, linkedin TEXT, remarks TEXT, isActive INTEGER DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`,
  'CREATE INDEX IF NOT EXISTS idx_salescontacts ON SalesContacts (customerId)',
  `CREATE TABLE IF NOT EXISTS SalesLanes (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, service TEXT, origin TEXT, originCountry TEXT,
    destination TEXT, destinationCountry TEXT, commodity TEXT, hsCode TEXT, incoterm TEXT, containerType TEXT, shipmentsPerMonth REAL, volumePerShipment REAL,
    volumeUnit TEXT, isDg INTEGER DEFAULT 0, isTempControlled INTEGER DEFAULT 0, currentVendor TEXT, currentRate REAL, rateCurrency TEXT, rateBasis TEXT, targetRate REAL,
    status TEXT, remarks TEXT, isActive INTEGER DEFAULT 1, createdAt DATETIME, updatedAt DATETIME)`,
  'CREATE INDEX IF NOT EXISTS idx_saleslanes ON SalesLanes (customerId)',
  `CREATE TABLE IF NOT EXISTS SalesAssignments (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, salesPersonId INTEGER, role TEXT, fromDate TEXT, toDate TEXT,
    reason TEXT, changedBy TEXT, createdAt DATETIME)`,
  'CREATE INDEX IF NOT EXISTS idx_salesassign ON SalesAssignments (customerId, fromDate)',
  // a customer billed on more than one ledger (iCAFFE keeps e.g. "X PVT LTD" and "X PVT LTD (IMPORT DUTY ACCOUNT)" / "-DUTY A/C" / "- DO"):
  // the main ledger is SalesCustomers.ledgerId, the others are here. kind REIMB = duty / DO / direct-party (reimbursement) account
  `CREATE TABLE IF NOT EXISTS SalesCustomerLedgers (id INTEGER PRIMARY KEY AUTOINCREMENT, customerId INTEGER NOT NULL, ledgerId INTEGER NOT NULL UNIQUE, kind TEXT,
    createdBy TEXT, createdAt DATETIME)`,
  'CREATE INDEX IF NOT EXISTS idx_salescustledgers ON SalesCustomerLedgers (customerId)',
  `CREATE TABLE IF NOT EXISTS SalesLookups (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, value TEXT NOT NULL, sortOrder INTEGER, isActive INTEGER DEFAULT 1,
    createdAt DATETIME, updatedAt DATETIME, UNIQUE (kind, value))`,
];

async function seedLookups() {
  const seededKinds = new Set(
    (await q('SELECT kind, count(*) n FROM SalesLookups GROUP BY kind')).map((row) => row.kind),
  );
  for (const [kind, values] of Object.entries(LOOKUP_KINDS)) {
    if (seededKinds.has(kind)) continue;
    let sortOrder = 0;
    for (const value of values) {
      await x(
        'INSERT OR IGNORE INTO SalesLookups (kind, value, sortOrder, isActive, createdAt, updatedAt) VALUES (?,?,?,1,?,?)',
        [kind, value, ++sortOrder, now(), now()],
      );
    }
  }
}

let ready = null;
const ensure = () => {
  ready =
    ready ||
    (async () => {
      try {
        for (const statement of CREATE_SALES_TABLES) await x(statement);
        await seedLookups();
      } catch (error) {
        ready = null;
        throw error;
      }
    })();
  return ready;
};

// ---- who sees what ----
const isManagerRole = (person) => MANAGER_ROLES.includes(String(person.role || '').toUpperCase());

// the person and everyone reporting to them (any depth)
async function teamOf(person) {
  const team = new Set([person.id]);
  if (!isManagerRole(person)) return team;
  const everyone = await q('SELECT id, reportingToId FROM SalesPersons');
  let grew = true;
  while (grew) {
    grew = false;
    for (const other of everyone) {
      if (other.reportingToId && team.has(other.reportingToId) && !team.has(other.id)) {
        team.add(other.id);
        grew = true;
      }
    }
  }
  return team;
}

// the branches picked in the top bar (x-branch), limited to those the user may see; null = every branch
async function viewerBranches(req, user) {
  try {
    const allowed = await allowedFor(user);
    const wanted = String((req.get && req.get('x-branch')) || '')
      .trim()
      .toUpperCase();
    if (wanted && wanted !== 'ALL' && (!allowed || allowed.includes(wanted))) return [wanted];
    if (allowed) return allowed;
    return null;
  } catch {
    return null;
  }
}

// admin: everything (in the branches picked). A user linked to a sales person: own customers (KAM or secondary) and, for a
// manager / head, everyone reporting to them (any depth). Any other user: the customers of the branches they may see.
async function viewer(req) {
  await ensure();
  const user = req.user || {};
  const isAdmin = String(user.role || '').toLowerCase() === 'admin';
  const [me] = user.id
    ? await q('SELECT * FROM SalesPersons WHERE userId = ? AND coalesce(isActive, 1) = 1 ORDER BY id LIMIT 1', [
        user.id,
      ])
    : [null];
  const team = me && !isAdmin ? await teamOf(me) : null; // null = not limited by person
  const branches = await viewerBranches(req, user);
  const canManage = isAdmin || !me || isManagerRole(me);
  return { isAdmin, me, team, branches, canManage, user: user.fullName || user.username || user.email || '' };
}

// SQL condition on SalesCustomers (alias c) for the viewer
function customerWhere(v, alias = 'c') {
  const w = [];
  const p = [];
  if (v.team) {
    const ids = [...v.team];
    const secondary = ids.map(() => `(',' || coalesce(${alias}.secondaryIds, '') || ',') LIKE ?`).join(' OR ');
    w.push(`(${alias}.kamId IN (${ids.map(() => '?').join(',')}) OR ${secondary})`);
    p.push(...ids, ...ids.map((id) => `%,${id},%`));
  } else if (v.branches && v.branches.length) {
    w.push(
      `(${alias}.branchCode IS NULL OR ${alias}.branchCode = '' OR upper(${alias}.branchCode) IN (${v.branches.map(() => '?').join(',')}))`,
    );
    p.push(...v.branches);
  }
  return { w, p };
}

// ---- helpers ----
const clean = (s) => (s == null ? null : String(s).trim() || null);
const upper = (s) => (clean(s) ? clean(s).toUpperCase() : null);
const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
const csv = (v) => {
  const list = listOf(v);
  return list.length ? list.join(',') : null;
};
const nameKey = (s) =>
  String(s || '')
    .toUpperCase()
    .replace(/\b(MR|MRS|MS|DR)\.?\s+/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
const GSTIN_RE = /^(?!0{15})[0-9]{2}[A-Z0-9]{10}[0-9A-Z]{3}$/; // iCAFFE keeps 000000000000000 for 'no GSTIN'
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// sales person matched to a name typed in iCAFFE (docket "marketing person", party marketing person): name or alias
async function personByName(name) {
  const wantedKey = nameKey(name);
  if (!wantedKey) return null;
  const people = await q('SELECT id, name, aliases FROM SalesPersons');
  return (
    people.find(
      (person) =>
        nameKey(person.name) === wantedKey || listOf(person.aliases).some((alias) => nameKey(alias) === wantedKey),
    ) || null
  );
}

// the Sundry Debtors groups (and every group under them)
async function debtorGroupIds() {
  const groups = await q('SELECT id, parentId, name FROM AccountGroups');
  const roots = groups
    .filter((group) => /^sundry debtors$/i.test(String(group.name || '').trim()))
    .map((group) => group.id);
  const ids = new Set(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of groups) {
      if (group.parentId && ids.has(group.parentId) && !ids.has(group.id)) {
        ids.add(group.id);
        grew = true;
      }
    }
  }
  return ids;
}

// ---- iCAFFE debtor groups ----
// iCAFFE keeps debtors in groups named after the sales person ("SUNDRY DEBTORS (DEEPAK KUMAR)", "Sundry Debtors - Mr. Rajan
// Sharma", "SUNDRY DEBTORS (POOJA SINGH-MUMBAI)"), after a branch / place, or after a kind (DIRECT, COURIER DIVISION, OVERSEAS
// AGENT, CASE, DISPUTED, CUSTOM DUTY, Blocked Recoveries). groupInfo() reads the person, the kind and the status out of the name.
const NOT_PERSON = [
  'DIRECT',
  'COURIER DIVISION',
  'OVERSEAS AGENT',
  'CASE',
  'DISBUTED',
  'DISPUTED',
  'W/KYC',
  'W KYC',
  'CUSTOM DUTY',
  'HYDERABAD',
  'BANGALORE',
  'MAROL BRANCH',
  'GOA',
  'PUNE',
  'AHAMEDABAD',
  'AHMEDABAD',
  'GUJRAT',
  'LUDHIANA',
  'ANDHERI',
  'CHENNAI',
  'MUMBAI',
  'JAIPUR',
  'DELHI',
  'KOLKATA',
  'KOLKATTA',
  'BLOCKED RECOVERIES',
  'OVERSEAS',
];
const PLACE_WORDS = /\b(MUMBAI|DELHI|JAIPUR|CHENNAI|KOLKAT+A|YUSUF SARAI|EXPORT|IMPORT|BRANCH|AHMD|AHMEDABAD)\b/g;
const FINANCIAL_YEAR_IN_NAME = /\(\s*\d{4}\s*-\s*\d{4}\s*\)/;

// the text that may name the person: "(...)", "Sundry Debtors - ...", or "Sundry Debtors (..." without the closing bracket
function personPartOf(groupName) {
  const inner =
    (/\(([^)]*)\)/.exec(groupName) || [])[1] ||
    (/sundry debtors\s*-\s*(.+)$/i.exec(groupName) || [])[1] ||
    (/^sundry debtors\s*\(?\s*([^)]*)$/i.exec(groupName) || [])[1] ||
    '';
  return inner.replace(/^\s*(MR|MRS|MS|DR)\.?\s+/i, '').trim();
}

const titleCase = (text) => text.replace(/\b([A-Z])([A-Z]*)\b/g, (match, first, rest) => first + rest.toLowerCase());

function groupInfo(name) {
  const groupName = String(name || '').trim();
  const upperName = groupName.toUpperCase();
  const info = { person: null, kind: null, status: null, customerType: null, service: null };
  if (/CUSTOM\s*DUTY/.test(upperName)) info.kind = 'REIMB';
  if (/\(\s*CASE\s*\)|BLOCKED RECOVER/.test(upperName)) info.status = 'BLOCKED';
  else if (/DIS[BP]UTED|W\/?\s*KYC/.test(upperName)) info.status = 'ON_HOLD';
  if (/OVERSEAS/.test(upperName)) info.customerType = 'OVERSEAS_AGENT';
  if (/COURIER/.test(upperName)) info.service = 'COURIER';
  if (FINANCIAL_YEAR_IN_NAME.test(upperName)) return info;
  const inner = personPartOf(groupName);
  if (!inner) return info;
  if (NOT_PERSON.includes(inner.toUpperCase()) || /^COMMITTED\b/i.test(inner)) return info;
  const person = inner
    .split(/\s*-\s*/)[0]
    .toUpperCase()
    .replace(PLACE_WORDS, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (person && /^[A-Z. ]{3,}$/.test(person) && !NOT_PERSON.includes(person)) info.person = titleCase(person);
  return info;
}

// a ledger that is the duty / DO / direct-party (reimbursement) account of a customer
const isReimbLedger = (name, groupName) =>
  /CUSTOM\s*DUTY/i.test(groupName || '') ||
  /DUTY\s*(A\/?C|ACCOUNT)|IMPORT DUTY|\(\s*DIRECT PARTY|[-(]\s*D\.?O\.?\s*\)?$|\bDUTY\b/i.test(name || '');

// the customer's own name without the account suffixes, for matching its ledgers
const DROP = new Set([
  'PVT',
  'PRIVATE',
  'PRIVAT',
  'LTD',
  'LIMITED',
  'LIMITE',
  'LIMIT',
  'LTD.',
  'LLP',
  'INC',
  'CO',
  'COMPANY',
  'THE',
  'INDIA',
  'I',
  'P',
  'M/S',
  'MS',
  'AND',
]);
const baseName = (name) =>
  String(name || '')
    .toUpperCase()
    .replace(/\((IMPORT )?DUTY ACCOUNT\)|\(DIRECT PARTY ACCOUNT\)|\(OVERSEAS\)|\(CASE\)|\(FY[^)]*\)/g, ' ')
    .replace(/[-\s]+(DUTY A\/?C|DUTY|DO|DR|COURIER DIV(ISION)?)\s*$/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && !DROP.has(word))
    .join(' ');

const panOf = (gstin, pan) => {
  const gstinText = String(gstin || '').toUpperCase();
  if (GSTIN_RE.test(gstinText) && PAN_RE.test(gstinText.slice(2, 12))) return gstinText.slice(2, 12);
  const panText = String(pan || '').toUpperCase();
  return PAN_RE.test(panText) ? panText : null;
};

export {
  groupInfo,
  isReimbLedger,
  baseName,
  panOf,
  q,
  x,
  now,
  today,
  ensure,
  viewer,
  customerWhere,
  personByName,
  debtorGroupIds,
  nameKey,
  clean,
  upper,
  numOrNull,
  listOf,
  csv,
  GSTIN_RE,
  PAN_RE,
  EMAIL_RE,
  CUSTOMER_STATUS,
  CUSTOMER_TYPES,
  SEGMENTS,
  SERVICES,
  VOLUME_UNITS,
  INCOTERMS,
  CONTAINER_TYPES,
  SP_ROLES,
  TURNOVER,
  CREDIT_TERMS,
  LOOKUP_KINDS,
};
