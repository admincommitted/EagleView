// Builds the full party list (GET /api/masters/parties) in a worker thread.
// The list is large (tens of thousands of parties and addresses, tens of MB of JSON). Built on the main thread - reading
// the rows, turning them into objects, JSON.stringify and gzip - every other request waited for it after each party save.
// This worker opens its own read-only SQLite connection (WAL: writes go on meanwhile), builds the JSON (full + compact
// copy), gzips both and hands back the buffers. The main thread only stores them.
// Started with `new Worker(path, { workerData: { storage, so, spec } })`; it does not load the app's models.
import { parentPort, workerData } from 'node:worker_threads';
import zlib from 'node:zlib';
import sqlite3 from 'sqlite3';

// storage: database file; searchOnlyHidden (so): leave out search-only parties;
// spec: { Parties: { bools: [...], dates: [...] }, PartyBranches: ..., ... }
const { storage, so: searchOnlyHidden, spec } = workerData;

const BUSY_TIMEOUT_MS = 15000;
const GZIP_LEVEL = 6;
const TABLES = ['Parties', 'PartyBranches', 'PartyADCodes', 'PartyDrawbackAccounts'];
// the compact copy for the job / report screens has no createdAt / updatedAt
const COMPACT_DROPPED_KEYS = new Set(['createdAt', 'updatedAt']);

const PARTY_FILTER = searchOnlyHidden ? ' WHERE coalesce(searchOnly, 0) = 0' : '';
const CHILD_FILTER = searchOnlyHidden
  ? ' WHERE partyId IN (SELECT id FROM Parties WHERE coalesce(searchOnly, 0) = 0)'
  : '';
const selectAllFrom = (table) => 'SELECT * FROM ' + table + (table === 'Parties' ? PARTY_FILTER : CHILD_FILTER);

// SQLite gives booleans as 0/1 and dates as text: turn them into what Sequelize would return
function rowFixerFor(table) {
  const tableSpec = spec[table] || { bools: [], dates: [] };
  return (row) => {
    for (const key of tableSpec.bools) if (key in row) row[key] = row[key] == null ? row[key] : !!row[key];
    for (const key of tableSpec.dates) {
      if (!row[key]) continue;
      const date = new Date(String(row[key]).replace(' ', 'T').replace(' +00:00', 'Z'));
      if (!isNaN(date)) row[key] = date.toISOString();
    }
    return row;
  };
}

function openReadOnlyDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(storage, sqlite3.OPEN_READONLY, (openError) => {
      if (openError) return reject(openError);
      db.configure('busyTimeout', BUSY_TIMEOUT_MS);
      resolve(db);
    });
  });
}

const allRows = (db, sql) =>
  new Promise((resolve, reject) => {
    db.all(sql, (error, rows) => (error ? reject(error) : resolve(rows)));
  });

async function readAllTables() {
  const db = await openReadOnlyDatabase();
  try {
    return await Promise.all(TABLES.map((table) => allRows(db, selectAllFrom(table))));
  } finally {
    db.close();
  }
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

// no null values and no createdAt / updatedAt
function compactCopy(object) {
  const compact = {};
  for (const key in object) {
    const value = object[key];
    if (value === null || value === undefined || COMPACT_DROPPED_KEYS.has(key)) continue;
    compact[key] = Array.isArray(value)
      ? value.map((item) => (item && typeof item === 'object' ? compactCopy(item) : item))
      : value;
  }
  return compact;
}

const toArrayBuffer = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length);

function buildPartyList([parties, branches, adCodes, drawbackAccounts]) {
  const branchesByParty = groupByParty(branches, rowFixerFor('PartyBranches'));
  const adCodesByParty = groupByParty(adCodes, rowFixerFor('PartyADCodes'));
  const drawbackByParty = groupByParty(drawbackAccounts, rowFixerFor('PartyDrawbackAccounts'));
  const fixParty = rowFixerFor('Parties');
  for (const party of parties) {
    fixParty(party);
    party.branches = branchesByParty.get(party.id) || [];
    party.adCodes = adCodesByParty.get(party.id) || [];
    party.drawbackAccounts = drawbackByParty.get(party.id) || [];
  }
  return parties;
}

async function main() {
  try {
    const parties = buildPartyList(await readAllTables());
    const json = Buffer.from(JSON.stringify(parties));
    const compact = Buffer.from(JSON.stringify(parties.map(compactCopy)));
    const gz = zlib.gzipSync(json, { level: GZIP_LEVEL });
    const cgz = zlib.gzipSync(compact, { level: GZIP_LEVEL });
    const message = {
      json: toArrayBuffer(json),
      compact: toArrayBuffer(compact),
      gz: toArrayBuffer(gz),
      cgz: toArrayBuffer(cgz),
      count: parties.length,
    };
    parentPort.postMessage(message, [message.json, message.compact, message.gz, message.cgz]);
  } catch (error) {
    parentPort.postMessage({ error: error.message || String(error) });
  }
}

main();
