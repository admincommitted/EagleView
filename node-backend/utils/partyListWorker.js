// 17-Nov-2026: builds the full party list (GET /api/masters/parties) in a worker thread.
// Saving a party took up to ~50 s on the office PC: after every party write the list (~28,000 parties, ~42,000
// addresses, ~50 MB of JSON) was rebuilt on the main thread - reading the rows, turning them into objects,
// JSON.stringify and gzip - and every other request, the party POST itself included, waited for it.
// This worker opens its own read-only SQLite connection (WAL: writes go on meanwhile), builds the same JSON as before
// (full + compact copy) and gzips both, and hands back Buffers. The main thread only stores them.
const { parentPort, workerData } = require('worker_threads');
const zlib = require('zlib');
const sqlite3 = require('sqlite3');

const { storage, so, spec } = workerData; // spec: { Parties: { bools: [...], dates: [...] }, PartyBranches: ..., ... }

const W = { Parties: so ? ' WHERE coalesce(searchOnly, 0) = 0' : '' };
const WP = so ? ' WHERE partyId IN (SELECT id FROM Parties WHERE coalesce(searchOnly, 0) = 0)' : '';
const sql = (t) => 'SELECT * FROM ' + t + (t in W ? W[t] : WP);

const fix = (t) => {
  const s = spec[t] || { bools: [], dates: [] };
  return (r) => {
    for (const k of s.bools) if (k in r) r[k] = r[k] == null ? r[k] : !!r[k];
    for (const k of s.dates) if (r[k]) { const d = new Date(String(r[k]).replace(' ', 'T').replace(' +00:00', 'Z')); if (!isNaN(d)) r[k] = d.toISOString(); }
    return r;
  };
};

function run() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(storage, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      db.configure('busyTimeout', 15000);
      const all = (q) => new Promise((ok, no) => db.all(q, (e, rows) => (e ? no(e) : ok(rows))));
      Promise.all(['Parties', 'PartyBranches', 'PartyADCodes', 'PartyDrawbackAccounts'].map(t => all(sql(t))))
        .then((r) => { db.close(); resolve(r); }, (e) => { db.close(); reject(e); });
    });
  });
}

run().then(([ps, br, ad, dbk]) => {
  const group = (rows, f) => { const m = new Map(); for (const r of rows) { f(r); if (!m.has(r.partyId)) m.set(r.partyId, []); m.get(r.partyId).push(r); } return m; };
  const gb = group(br, fix('PartyBranches')), ga = group(ad, fix('PartyADCodes')), gd = group(dbk, fix('PartyDrawbackAccounts'));
  const fp = fix('Parties');
  for (const p of ps) { fp(p); p.branches = gb.get(p.id) || []; p.adCodes = ga.get(p.id) || []; p.drawbackAccounts = gd.get(p.id) || []; }
  // the compact copy for the job / report screens: no null values, no createdAt / updatedAt (same as before)
  const drop = new Set(['createdAt', 'updatedAt']);
  const slim = (o) => { const r = {}; for (const k in o) { const v = o[k]; if (v === null || v === undefined || drop.has(k)) continue; r[k] = Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? slim(x) : x)) : v; } return r; };
  const json = Buffer.from(JSON.stringify(ps));
  const compact = Buffer.from(JSON.stringify(ps.map(slim)));
  const gz = zlib.gzipSync(json, { level: 6 });
  const cgz = zlib.gzipSync(compact, { level: 6 });
  const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
  const out = { json: ab(json), compact: ab(compact), gz: ab(gz), cgz: ab(cgz), count: ps.length };
  parentPort.postMessage(out, [out.json, out.compact, out.gz, out.cgz]);
}).catch((e) => { parentPort.postMessage({ error: e.message || String(e) }); });
