import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { Worker } from 'node:worker_threads';
import { Op, QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/database.js';
import { BadRequestError, NotFoundError } from '../../../core/http/index.js';
import { Party, PartyADCode, PartyBranch, PartyDrawbackAccount } from '../../../models/index.js';

/*
 * The Party master holds ~28,000 parties with ~42,000 addresses. The full list (GET /api/masters/parties, loaded by the
 * job screens) is built once, kept in memory and sent gzip-compressed. It is read on its own read-only SQLite
 * connection in a worker thread (WAL: writes go on meanwhile); several GETs share one build; after a party write the
 * cache is rebuilt in the background, and a generation counter drops a build that started before that write.
 */
const PARTY_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_REBUILD_DELAY_MS = 1500;
const GZIP_OPTIONS = { level: 6 };
const WORKER_HEAP_LIMIT_MB = 2048;
const SQLITE_BUSY_TIMEOUT_MS = 15000;
const PARTIES_PER_SLICE = 2000;
const SEARCH_RESULT_LIMIT = 20;
const FIND_DEFAULT_LIMIT = 50;
const FIND_MAX_LIMIT = 200;
const PARTY_LIST_WORKER = path.join(import.meta.dirname, '..', '..', '..', 'utils', 'db', 'partyListWorker.js');

const PARTY_TABLES = {
  Parties: Party,
  PartyBranches: PartyBranch,
  PartyADCodes: PartyADCode,
  PartyDrawbackAccounts: PartyDrawbackAccount,
};

// the compact copy for the job / report screens leaves out null values and these stamps (about 56 MB -> 37 MB)
const COMPACT_DROPPED_FIELDS = new Set(['createdAt', 'updatedAt']);

// first match wins: a type such as 'SHIPPER / CONSIGNEE' searches shippers
const SEARCH_TYPE_FLAGS = [
  { matches: (type) => type.includes('SHIPPER'), flag: 'isShipper' },
  { matches: (type) => type.includes('CONSIGNEE'), flag: 'isConsignee' },
  { matches: (type) => type.includes('BUYER'), flag: 'isBuyer' },
  { matches: (type) => type.includes('SUB AGENT') || type.includes('SUBAGENT'), flag: 'isSubAgent' },
  { matches: (type) => type.includes('OVERSEAS AGENT'), flag: 'isOverseasAgent' },
  { matches: (type) => type.includes('NOTIFY'), flag: 'isNotifyParty' },
];

const FIND_TYPE_FLAGS = {
  EXPORTER: 'isShipper',
  CONSIGNEE: 'isConsignee',
  SUBAGENT: 'isSubAgent',
  OVERSEAS_AGENT: 'isOverseasAgent',
  SHIPLINE: 'isShipline',
  BANK: 'isBank',
};

// names starting with punctuation sort by their first letter
const FIND_NAME_SORT = "ltrim(p.name, '#\"''([{.|&\\,%*-_/ ')";

const gzipAsync = promisify(zlib.gzip);

/** The branches, AD codes and drawback accounts of a party, as every party answer carries them. */
export const partyIncludes = () => [
  { model: PartyBranch, as: 'branches' },
  { model: PartyADCode, as: 'adCodes' },
  { model: PartyDrawbackAccount, as: 'drawbackAccounts' },
];

let partyCache = null; // { json, gz, cjson, cgz, at }
let partyGeneration = 0;
let partyBuild = null;
let partyRebuildTimer = null;
let searchOnlyColumnFound = false;

async function rebuildPartyCacheInBackground() {
  partyRebuildTimer = null;
  try {
    await partyCacheReady();
  } catch {
    // the next GET builds it
  }
}

/** Drops the cached party list (any party write) and rebuilds it in the background shortly after. */
export function clearPartyCache() {
  partyCache = null;
  partyGeneration++;
  if (partyRebuildTimer) clearTimeout(partyRebuildTimer);
  partyRebuildTimer = setTimeout(rebuildPartyCacheInBackground, CACHE_REBUILD_DELAY_MS);
  if (partyRebuildTimer.unref) partyRebuildTimer.unref();
}

/** Parties.searchOnly marks the bulk-loaded iCAFFE consignees (~1.2 lakh) that stay out of the full list. */
async function hasSearchOnlyColumn() {
  if (searchOnlyColumnFound) return true;
  let rows;
  try {
    rows = await sequelize.query("SELECT 1 FROM pragma_table_info('Parties') WHERE name = 'searchOnly'", {
      type: QueryTypes.SELECT,
    });
  } catch {
    rows = [];
  }
  searchOnlyColumnFound = rows.length > 0;
  return searchOnlyColumnFound;
}

function columnKindsOf(Model) {
  const kinds = { bools: [], dates: [] };
  for (const [name, attribute] of Object.entries(Model.rawAttributes)) {
    const typeKey = attribute.type && attribute.type.key;
    if (typeKey === 'BOOLEAN') kinds.bools.push(name);
    else if (typeKey === 'DATE') kinds.dates.push(name);
  }
  return kinds;
}

const isSqliteFile = () => sequelize.getDialect() === 'sqlite' && Boolean(sequelize.options.storage);

function buildPartyListInWorker(searchOnly) {
  const spec = {};
  for (const [table, Model] of Object.entries(PARTY_TABLES)) spec[table] = columnKindsOf(Model);

  return new Promise((resolve, reject) => {
    const worker = new Worker(PARTY_LIST_WORKER, {
      workerData: { storage: sequelize.options.storage, so: searchOnly, spec },
      resourceLimits: { maxOldGenerationSizeMb: WORKER_HEAP_LIMIT_MB },
    });
    let settled = false;
    worker.once('message', (message) => {
      settled = true;
      if (message.error) return reject(new Error(message.error));
      return resolve({
        json: Buffer.from(message.json),
        cjson: Buffer.from(message.compact),
        gz: Buffer.from(message.gz),
        cgz: Buffer.from(message.cgz),
      });
    });
    worker.once('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (settled) return;
      settled = true;
      reject(new Error(`worker stopped (${code})`));
    });
  });
}

/** The whole list built in a worker thread (SQLite only; other databases build it here). */
async function buildPartyListOffThread() {
  if (!isSqliteFile()) throw new Error('not SQLite');
  return buildPartyListInWorker(await hasSearchOnlyColumn());
}

const allRows = (db, sql) =>
  new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => (error ? reject(error) : resolve(rows)));
  });

/** The big list SELECTs on their own read-only connection (SQLite), so they do not hold up writes and other reads. */
async function readTablesOnOwnConnection(sqls) {
  const readViaSequelize = () => Promise.all(sqls.map((sql) => sequelize.query(sql, { type: QueryTypes.SELECT })));
  if (!isSqliteFile()) return readViaSequelize();
  let sqlite3;
  try {
    sqlite3 = (await import('sqlite3')).default;
  } catch {
    return readViaSequelize();
  }
  return new Promise((resolve) => {
    const db = new sqlite3.Database(sequelize.options.storage, sqlite3.OPEN_READONLY, async (openError) => {
      if (openError) return resolve(readViaSequelize());
      db.configure('busyTimeout', SQLITE_BUSY_TIMEOUT_MS);
      try {
        const results = await Promise.all(sqls.map((sql) => allRows(db, sql)));
        db.close();
        return resolve(results);
      } catch {
        db.close();
        return resolve(readViaSequelize());
      }
    });
  });
}

/** Turns raw SQLite values into what Sequelize answers: 0/1 -> booleans, date texts -> ISO strings. */
function rowFixerFor(Model) {
  const { bools, dates } = columnKindsOf(Model);
  return (row) => {
    for (const name of bools) if (name in row) row[name] = row[name] == null ? row[name] : !!row[name];
    for (const name of dates) {
      if (!row[name]) continue;
      const date = new Date(String(row[name]).replace(' ', 'T').replace(' +00:00', 'Z'));
      if (!Number.isNaN(date.getTime())) row[name] = date.toISOString();
    }
    return row;
  };
}

function groupByParty(rows, fixRow) {
  const byParty = new Map();
  for (const row of rows) {
    fixRow(row);
    if (!byParty.has(row.partyId)) byParty.set(row.partyId, []);
    byParty.get(row.partyId).push(row);
  }
  return byParty;
}

function compactCopy(record) {
  const compact = {};
  for (const key in record) {
    const value = record[key];
    if (value === null || value === undefined || COMPACT_DROPPED_FIELDS.has(key)) continue;
    // '' is kept: screen code may call string methods on it
    compact[key] = Array.isArray(value)
      ? value.map((item) => (item && typeof item === 'object' ? compactCopy(item) : item))
      : value;
  }
  return compact;
}

/** JSON.stringify in slices with a pause every few thousand parties, so other requests are served meanwhile. */
async function stringifyInSlices(parties, mapParty) {
  const parts = ['['];
  for (let index = 0; index < parties.length; index++) {
    if (index) parts.push(',');
    parts.push(JSON.stringify(mapParty ? mapParty(parties[index]) : parties[index]));
    if (index % PARTIES_PER_SLICE === PARTIES_PER_SLICE - 1) await yieldToEventLoop();
  }
  parts.push(']');
  return parts.join('');
}

/**
 * The full list with plain SQL (Sequelize instances for every party took about a minute); the shape is the same as
 * findAll({ include: branches, adCodes, drawbackAccounts }).
 */
async function buildPartyJson() {
  const searchOnly = await hasSearchOnlyColumn();
  const partyFilter = searchOnly ? ' WHERE coalesce(searchOnly, 0) = 0' : '';
  const childFilter = searchOnly ? ' WHERE partyId IN (SELECT id FROM Parties WHERE coalesce(searchOnly, 0) = 0)' : '';
  const selectAll = (table) => `SELECT * FROM ${table}${table === 'Parties' ? partyFilter : childFilter}`;

  const [parties, branches, adCodes, drawbackAccounts] = await readTablesOnOwnConnection(
    Object.keys(PARTY_TABLES).map(selectAll),
  );
  const branchesByParty = groupByParty(branches, rowFixerFor(PartyBranch));
  const adCodesByParty = groupByParty(adCodes, rowFixerFor(PartyADCode));
  const drawbackAccountsByParty = groupByParty(drawbackAccounts, rowFixerFor(PartyDrawbackAccount));
  const fixParty = rowFixerFor(Party);
  for (const party of parties) {
    fixParty(party);
    party.branches = branchesByParty.get(party.id) || [];
    party.adCodes = adCodesByParty.get(party.id) || [];
    party.drawbackAccounts = drawbackAccountsByParty.get(party.id) || [];
  }
  const json = await stringifyInSlices(parties, null);
  const compact = await stringifyInSlices(parties, compactCopy);
  return { json, compact };
}

async function buildPartyListCache() {
  try {
    return await buildPartyListOffThread();
  } catch (error) {
    console.warn('[parties] worker build failed, building here:', error.message);
    const built = await buildPartyJson();
    const [gz, cgz] = await Promise.all([gzipAsync(built.json, GZIP_OPTIONS), gzipAsync(built.compact, GZIP_OPTIONS)]);
    return { json: built.json, gz, cjson: built.compact, cgz };
  }
}

async function startPartyBuild() {
  const generation = partyGeneration;
  try {
    const cache = await buildPartyListCache();
    cache.at = Date.now();
    if (generation === partyGeneration) partyCache = cache;
    return { cache, stale: generation !== partyGeneration };
  } finally {
    partyBuild = null;
  }
}

/** The cached full party list ({ json, gz, cjson, cgz }); built when missing or older than 10 minutes. */
export async function partyCacheReady() {
  if (partyCache && Date.now() - partyCache.at <= PARTY_CACHE_TTL_MS) return partyCache;
  if (!partyBuild) partyBuild = startPartyBuild();
  const { cache, stale } = await partyBuild;
  // a party was saved while the list was being read: read once more
  return stale ? partyCacheReady() : cache;
}

function searchFlagOf(type) {
  const upperType = type.toUpperCase();
  const match = SEARCH_TYPE_FLAGS.find(({ matches }) => matches(upperType));
  return match ? match.flag : null;
}

/** GET /parties/search: up to 20 parties whose name contains the text, with their addresses and codes. */
export async function searchParties({ q, type }) {
  if (!q) return [];
  const where = { name: { [Op.like]: `%${q}%` } };
  if (type) {
    const flag = searchFlagOf(type);
    if (flag) where[flag] = true;
  }
  return Party.findAll({ where, limit: SEARCH_RESULT_LIMIT, include: partyIncludes() });
}

const findLimitOf = (limit) => Math.min(Math.max(parseInt(limit, 10) || FIND_DEFAULT_LIMIT, 1), FIND_MAX_LIMIT);

/**
 * GET /parties/find: every party in the master, the search-only iCAFFE consignees included (name, code, IEC, PAN or
 * GSTIN), names starting with the text first.
 */
export async function findParties({ q, type, limit }) {
  const text = String(q || '').trim();
  const flag = FIND_TYPE_FLAGS[String(type || '').toUpperCase()];
  if (!text && !flag) return [];
  const searchOnly = await hasSearchOnlyColumn();
  const conditions = [];
  const replacements = [];
  if (flag) conditions.push(`p.${flag} = 1`);
  if (text) {
    conditions.push(
      '(p.name LIKE ? OR p.code = ? OR p.taxId = ? OR p.panNumber = ? ' +
        'OR p.id IN (SELECT partyId FROM PartyBranches WHERE gstin = ? OR regNo = ?))',
    );
    const upperText = text.toUpperCase();
    replacements.push(`%${text}%`, upperText, upperText, upperText, upperText, upperText);
  }
  const searchOnlyColumn = searchOnly ? 'coalesce(p.searchOnly, 0)' : '0';
  const sql =
    `SELECT p.id, p.code, p.name, p.partyType, p.city, p.countryCode, ${searchOnlyColumn} searchOnly FROM Parties p` +
    (conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '') +
    ` ORDER BY CASE WHEN p.name LIKE ? THEN 0 ELSE 1 END, ${FIND_NAME_SORT} LIMIT ?`;
  return sequelize.query(sql, {
    replacements: [...replacements, `${text}%`, findLimitOf(limit)],
    type: QueryTypes.SELECT,
  });
}

/** POST /parties/:id/activate: a search-only party joins the full party list and is returned in full. */
export async function activateParty(id) {
  const partyId = Number(id);
  if (await hasSearchOnlyColumn()) {
    await sequelize.query('UPDATE Parties SET searchOnly = 0 WHERE id = ? AND coalesce(searchOnly, 0) = 1', {
      replacements: [partyId],
    });
  }
  clearPartyCache();
  const party = await Party.findByPk(partyId, { include: partyIncludes() });
  if (!party) throw new NotFoundError('Party not found', { body: { error: 'Party not found' } });
  return party;
}

const newPartyBranchRow =
  (partyId) =>
  ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...branch }) => ({
    ...branch,
    partyId,
    isDefault: branch.isDefault !== undefined ? !!branch.isDefault : !!branch.default,
    branchSrNo: branch.branchSrNo || '1',
    branchName: branch.branchName || branch.branch || 'DEFAULT',
    address1: branch.address1 || '',
    address2: branch.address2 || '',
    city: branch.city || '',
    state: branch.state || '',
    country: branch.countryCode || branch.country || 'IN',
    email1: branch.email1 || branch.email || '',
    pinCode: branch.pinCode || branch.zip || '',
    phone: branch.phone || '',
    regNo: branch.regNo || branch.gstin || '',
    ctxType: branch.ctxType || null,
    ctxState: branch.ctxState || null,
  });

const defaultBranchOf = (party) => ({
  partyId: party.id,
  branchSrNo: '1',
  branchName: 'DEFAULT',
  address1: party.street || '',
  address2: '',
  city: party.city || '',
  state: party.stateProvince || '',
  country: party.countryCode || 'IN',
  pinCode: party.zipPostcode || '',
  phone: party.phoneNumber || '',
  regNo: party.taxId || '',
});

const hasRows = (list) => Boolean(list && Array.isArray(list) && list.length > 0);

async function addBranchesOfNewParty(party, branches) {
  if (hasRows(branches)) {
    await PartyBranch.bulkCreate(branches.map(newPartyBranchRow(party.id)));
    return;
  }
  await PartyBranch.create(defaultBranchOf(party));
}

/**
 * POST /parties: a new party from the Party Master form (already checked by createPartySchema) with its addresses
 * (a DEFAULT address from the party's own when none is given), AD codes and drawback accounts.
 */
export async function createParty(partyData, { branches, adCodes, drawbackAccounts }) {
  if (partyData.code === '') partyData.code = null;

  const existingParty = await Party.findOne({ where: { name: partyData.name } });
  if (existingParty) {
    throw new BadRequestError('A party with this name already exists in the database!', {
      body: { error: 'DUPLICATE_PARTY', message: 'A party with this name already exists in the database!' },
    });
  }

  const newParty = await Party.create(partyData);
  await addBranchesOfNewParty(newParty, branches);
  if (hasRows(adCodes)) {
    await PartyADCode.bulkCreate(adCodes.map((adCode) => ({ ...adCode, partyId: newParty.id })));
  }
  if (hasRows(drawbackAccounts)) {
    await PartyDrawbackAccount.bulkCreate(drawbackAccounts.map((account) => ({ ...account, partyId: newParty.id })));
  }
  return Party.findByPk(newParty.id, { include: partyIncludes() });
}

const editedPartyBranchRow =
  (partyId) =>
  ({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...branch }) => ({
    ...branch,
    partyId,
    branchSrNo: branch.branchSrNo || '1',
    branchName: branch.branchName || branch.branch || 'DEFAULT',
    address1: branch.address1 || '',
    address2: branch.address2 || '',
    city: branch.city || '',
    state: branch.state || '',
    country: branch.country || branch.countryCode || 'IN',
    email1: branch.email1 || branch.email || '',
    pinCode: branch.pinCode || branch.zip || '',
    isDefault: branch.isDefault !== undefined ? !!branch.isDefault : !!branch.default,
    phone: branch.phone || '',
    regNo: branch.regNo || branch.gstin || '',
  });

/** The address / AD code / drawback lists sent with an edited party replace the saved ones (each only when sent). */
export async function replacePartyChildren(partyId, { branches, adCodes, drawbackAccounts }) {
  if (branches && Array.isArray(branches)) {
    await PartyBranch.destroy({ where: { partyId } });
    await PartyBranch.bulkCreate(branches.map(editedPartyBranchRow(partyId)));
  }
  if (adCodes && Array.isArray(adCodes)) {
    await PartyADCode.destroy({ where: { partyId } });
    await PartyADCode.bulkCreate(adCodes.map((adCode) => ({ ...adCode, partyId })));
  }
  if (drawbackAccounts && Array.isArray(drawbackAccounts)) {
    await PartyDrawbackAccount.destroy({ where: { partyId } });
    await PartyDrawbackAccount.bulkCreate(drawbackAccounts.map((account) => ({ ...account, partyId })));
  }
}
