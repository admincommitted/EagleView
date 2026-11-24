// report_party_field_lengths.js  (14-Nov-2026)
// READ-ONLY report: Party Master names / branch addresses longer than ICEGATE or AWB (IATA EDI) allow.
//   ICEGATE (BE / SB JSON): name 50, address 1 = 35, address 2 = 35, city 35, state 25, PIN 6
//   AWB / IATA EDI (FWB / XFWB): name 35, address 35 per line, city 17, state 9, postcode 9
// The database is opened read-only; nothing is changed. Output: ..\reports\party_field_lengths_<date>.csv (opens in Excel).
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = path.join(__dirname, 'database.sqlite');
const OUT_DIR = path.join(__dirname, '..', 'reports');
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const OUT = path.join(OUT_DIR, 'party_field_lengths_' + stamp + '.csv');

const db = new sqlite3.Database(DB, sqlite3.OPEN_READONLY, (e) => { if (e) { console.error('Cannot open the database: ' + e.message); process.exit(1); } });
const all = (sql) => new Promise((ok, bad) => db.all(sql, (e, r) => (e ? bad(e) : ok(r))));
const len = (v) => String(v == null ? '' : v).trim().length;
const csv = (v) => { const t = String(v == null ? '' : v).replace(/\r?\n/g, ' ').trim(); return /[",]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };

(async () => {
  const rows = [];
  const add = (p, sr, field, value, limit, where, level) => rows.push([level, where, field, len(value), limit, p.code || '', p.name || '', p.taxId || '', sr, value]);

  const parties = await all('SELECT id, code, name, taxId FROM Parties');
  const byId = new Map(parties.map(p => [p.id, p]));
  for (const p of parties) {
    const n = len(p.name);
    if (n > 50) add(p, '', 'Party Name', p.name, 50, 'ICEGATE', 'ERROR - ICEGATE cuts it');
    else if (n > 35) add(p, '', 'Party Name', p.name, 35, 'AWB', 'AWB / IATA EDI keeps 35');
  }

  const branches = await all('SELECT partyId, branchSrNo, address1, address2, city, state, country, pinCode FROM PartyBranches');
  for (const b of branches) {
    const p = byId.get(b.partyId) || { code: '', name: '(party ' + b.partyId + ' missing)', taxId: '' };
    const sr = b.branchSrNo == null ? '' : String(b.branchSrNo);
    if (len(b.address1) > 35) add(p, sr, 'Address1', b.address1, 35, 'ICEGATE + AWB', 'ERROR - cut at 35');
    if (len(b.address2) > 35) add(p, sr, 'Address2', b.address2, 35, 'ICEGATE + AWB', 'ERROR - cut at 35');
    if (len(b.city) > 35) add(p, sr, 'City', b.city, 35, 'ICEGATE', 'ERROR - ICEGATE cuts it');
    else if (len(b.city) > 17) add(p, sr, 'City', b.city, 17, 'AWB', 'AWB / IATA EDI keeps 17');
    if (len(b.state) > 25) add(p, sr, 'State', b.state, 25, 'ICEGATE', 'ERROR - ICEGATE cuts it');
    const country = String(b.country || '').trim().toUpperCase(); // blank country: PIN rule not applied (often a foreign address)
    const pin = String(b.pinCode == null ? '' : b.pinCode).trim();
    if (country === 'IN' && pin && !/^\d{6}$/.test(pin)) add(p, sr, 'PIN', pin, 6, 'ICEGATE', 'ERROR - India PIN must be 6 digits');
    else if (country !== 'IN' && pin.length > 9) add(p, sr, 'Postcode', pin, 9, 'AWB', 'AWB / IATA EDI keeps 9');
  }
  db.close();

  rows.sort((a, b) => (a[0].startsWith('ERROR') === b[0].startsWith('ERROR') ? 0 : a[0].startsWith('ERROR') ? -1 : 1) || String(a[6]).localeCompare(String(b[6])));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const head = ['Level', 'Where it matters', 'Field', 'Length', 'Limit', 'Party Code', 'Party Name', 'IEC', 'Branch Sr No', 'Value'];
  fs.writeFileSync(OUT, '﻿' + [head, ...rows].map(r => r.map(csv).join(',')).join('\r\n') + '\r\n');

  const count = {}; for (const r of rows) { const k = r[2] + ' > ' + r[4] + ' (' + r[1] + ')'; count[k] = (count[k] || 0) + 1; }
  console.log('Parties checked: ' + parties.length + ', branches checked: ' + branches.length);
  Object.entries(count).sort().forEach(([k, v]) => console.log('  ' + k + ': ' + v));
  console.log('Rows in report: ' + rows.length);
  console.log('Report: ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
