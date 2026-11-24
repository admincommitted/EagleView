// Add the IATA special handling codes that are missing from the SPH master (SphMasters) - 11-Nov-2026.
// The master had 24 codes, so VALIDATE EDI said "ACT is not in the special handling master" for codes the AWB screen
// itself puts on (ACT), and CAO / DG class codes / security codes (SPX, SCO, SHR) could not be picked.
// Only codes that are not there yet are added; nothing is changed or deleted. --check only lists them.
// A full copy of the database is written to backups\ first. Stop the EagleView backend before running.
const path = require('path');
const fs = require('fs');
const sqlite3 = require(path.join(__dirname, 'node_modules', 'sqlite3'));

const DB = process.env.EDI_DB || path.join(__dirname, 'database.sqlite');
const DRY = process.argv.includes('--check');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const BACKUP = path.join(path.dirname(DB), '..', 'backups', 'database_before_sph_codes_' + stamp + '.sqlite');

const C = [
  ['DANGEROUS GOODS', [['CAO', 'CARGO AIRCRAFT ONLY'], ['EBI', 'LITHIUM ION BATTERIES EXCEPTED - PI 965 SECTION II'], ['EBM', 'LITHIUM METAL BATTERIES EXCEPTED - PI 968 SECTION II'],
    ['ELI', 'LITHIUM ION BATTERIES - PI 966 / 967 SECTION II'], ['ELM', 'LITHIUM METAL BATTERIES - PI 969 / 970 SECTION II'], ['ICE', 'DRY ICE'], ['MAG', 'MAGNETIZED MATERIAL'],
    ['RCL', 'CRYOGENIC LIQUID'], ['RCM', 'CORROSIVE'], ['RDS', 'DIAGNOSTIC SPECIMENS'], ['REQ', 'DANGEROUS GOODS IN EXCEPTED QUANTITIES'], ['RFG', 'FLAMMABLE GAS'],
    ['RFL', 'FLAMMABLE LIQUID'], ['RFS', 'FLAMMABLE SOLID'], ['RFW', 'DANGEROUS WHEN WET'], ['RIS', 'INFECTIOUS SUBSTANCE'], ['RLI', 'FULLY REGULATED LITHIUM ION BATTERIES'],
    ['RLM', 'FULLY REGULATED LITHIUM METAL BATTERIES'], ['RMD', 'MISCELLANEOUS DANGEROUS GOODS'], ['RNG', 'NON-FLAMMABLE NON-TOXIC GAS'], ['ROP', 'ORGANIC PEROXIDE'],
    ['ROX', 'OXIDIZER'], ['RPB', 'TOXIC SUBSTANCE'], ['RRE', 'RADIOACTIVE MATERIAL - EXCEPTED PACKAGES'], ['RRW', 'RADIOACTIVE MATERIAL - CATEGORY I WHITE'],
    ['RRY', 'RADIOACTIVE MATERIAL - CATEGORY II / III YELLOW'], ['RSB', 'POLYMERIC BEADS'], ['RSC', 'SPONTANEOUSLY COMBUSTIBLE'], ['RXS', 'EXPLOSIVES 1.4S']]],
  ['LIVE CARGO', [['AVC', 'LIVE CRUSTACEANS'], ['AVF', 'LIVE FISH'], ['AVX', 'BABY POULTRY'], ['HEG', 'HATCHING EGGS'], ['SPF', 'LABORATORY ANIMALS']]],
  ['TEMPERATURE SENSITIVE', [['ACT', 'ACTIVE TEMPERATURE CONTROLLED SYSTEM'], ['CRT', 'CONTROLLED ROOM TEMPERATURE +15 TO +25 C'], ['ERT', 'EXTENDED ROOM TEMPERATURE +2 TO +25 C'],
    ['FRO', 'FROZEN GOODS'], ['FRI', 'FROZEN GOODS SUBJECT TO VETERINARY INSPECTION']]],
  ['PERISHABLE', [['EAT', 'FOODSTUFFS'], ['PEA', 'HUNTING TROPHIES / SKINS / CITES ARTICLES'], ['PEF', 'FLOWERS'], ['PEP', 'FRUITS AND VEGETABLES']]],
  ['SIZE / WEIGHT', [['BIG', 'OUTSIZED'], ['VOL', 'VOLUME CARGO']]],
  ['SPECIAL', [['AOG', 'AIRCRAFT ON GROUND'], ['BUP', 'BULK UNITIZATION PROGRAMME'], ['COU', 'COURIER'], ['DIP', 'DIPLOMATIC MAIL'], ['FIL', 'UNDEVELOPED / UNEXPOSED FILM'],
    ['HUC', 'HUMAN REMAINS - CREMATED'], ['MUW', 'MUNITIONS OF WAR'], ['NWP', 'NEWSPAPERS / MAGAZINES'], ['OBX', 'OBNOXIOUS CARGO'], ['SWP', 'SPORTING WEAPONS'], ['VUN', 'VULNERABLE CARGO']]],
  ['E-AWB / E-FREIGHT', [['EAP', 'E-FREIGHT CONSIGNMENT WITH PAPER DOCUMENTS'], ['EAW', 'E-FREIGHT CONSIGNMENT WITHOUT DOCUMENTS'], ['ECC', 'E-AWB - NO PAPER AIR WAYBILL'], ['ECP', 'PAPER AIR WAYBILL']]],
  ['SECURITY', [['SPX', 'SECURE FOR PASSENGER AND ALL-CARGO AIRCRAFT'], ['SCO', 'SECURE FOR ALL-CARGO AIRCRAFT ONLY'], ['SHR', 'SECURE - HIGH RISK REQUIREMENTS'], ['NSC', 'NOT SECURED']]],
];

const db = new sqlite3.Database(DB);
const run = (sql, p = []) => new Promise((ok, no) => db.run(sql, p, function (e) { e ? no(e) : ok(this); }));
const all = (sql, p = []) => new Promise((ok, no) => db.all(sql, p, (e, r) => (e ? no(e) : ok(r))));

(async () => {
  try {
    await run('PRAGMA busy_timeout = 30000');
    const have = new Set((await all('SELECT code FROM SphMasters')).map(r => String(r.code || '').trim().toUpperCase()));
    const add = [];
    for (const [cat, list] of C) for (const [code, desc] of list) if (!have.has(code)) add.push([code, desc, cat]);
    console.log(`SPH master now: ${have.size} codes. To add: ${add.length}`);
    add.forEach(a => console.log(`  ${a[0]}  ${a[1]}  (${a[2]})`));
    if (DRY) { console.log('Check only - nothing changed.'); return db.close(); }
    if (!add.length) { console.log('Nothing to add.'); return db.close(); }
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    console.log('Backup: ' + BACKUP);
    await run("VACUUM INTO '" + BACKUP.replace(/'/g, "''") + "'");
    await run('BEGIN IMMEDIATE');
    for (const [code, desc, cat] of add) await run("INSERT OR IGNORE INTO SphMasters (code, description, category, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))", [code, desc, cat]);
    await run('COMMIT');
    console.log(`Done - ${add.length} codes added.`);
    db.close();
  } catch (e) {
    console.error('FAILED: ' + e.message);
    try { await run('ROLLBACK'); } catch (x) { /* nothing open */ }
    db.close(); process.exitCode = 1;
  }
})();
